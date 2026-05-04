import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { config } from './config.js';
import { calculatePrice } from './pricing.js';
import { hasDatabase, query } from './db.js';

const app = express();
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json());

const createRequestSchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(7),
  pickupAddress: z.string().min(3),
  dropoffAddress: z.string().min(3),
  packageType: z.string().min(2),
  weightKg: z.number().positive(),
  notes: z.string().optional().default(''),
  dimensionsCm: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive()
  }),
  distanceKm: z.number().positive(),
  scheduledFor: z.string().datetime().optional()
});

const assignDriverSchema = z.object({
  driverId: z.string().uuid(),
  note: z.string().max(300).optional().default('Assigned by admin')
});

const updateStatusSchema = z.object({
  toStatus: z.enum(['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']),
  note: z.string().max(300).optional().default('')
});

const mapRequestRow = (row) => ({
  id: row.id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  pickupAddress: row.pickup_address,
  dropoffAddress: row.dropoff_address,
  packageType: row.package_type,
  weightKg: Number(row.weight_kg),
  notes: row.notes,
  dimensionsCm: {
    length: Number(row.dimension_length_cm),
    width: Number(row.dimension_width_cm),
    height: Number(row.dimension_height_cm)
  },
  distanceKm: Number(row.distance_km),
  status: row.status,
  paymentStatus: row.payment_status,
  pricing: {
    totalBeforeVat: Number(row.total_before_vat),
    vatAmount: Number(row.vat_amount),
    grandTotal: Number(row.grand_total)
  },
  scheduledFor: row.scheduled_for,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ethio-express-api',
    hasDatabase: hasDatabase()
  });
});

app.post('/v1/requests/quote', (req, res) => {
  const parsed = z.object({ distanceKm: z.number().positive() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid distance payload.', details: parsed.error.flatten() });
  }

  return res.json({
    distanceKm: parsed.data.distanceKm,
    currency: 'ETB',
    ...calculatePrice({
      distanceKm: parsed.data.distanceKm,
      baseFeeEtb: config.baseFeeEtb,
      perKmFeeEtb: config.perKmFeeEtb,
      vatRate: config.vatRate
    })
  });
});

app.post('/v1/requests', async (req, res, next) => {
  try {
    if (!hasDatabase()) {
      return res.status(503).json({ error: 'Database unavailable. Set DATABASE_URL to enable request creation.' });
    }

    const parsed = createRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request payload.', details: parsed.error.flatten() });
    }

    const pricing = calculatePrice({
      distanceKm: parsed.data.distanceKm,
      baseFeeEtb: config.baseFeeEtb,
      perKmFeeEtb: config.perKmFeeEtb,
      vatRate: config.vatRate
    });

    const id = crypto.randomUUID();
    const statusHistoryId = crypto.randomUUID();

    const result = await query(
      `INSERT INTO delivery_requests (
        id, customer_name, customer_phone, pickup_address, dropoff_address,
        package_type, weight_kg, notes, dimension_length_cm, dimension_width_cm,
        dimension_height_cm, distance_km, status, total_before_vat, vat_amount,
        grand_total, payment_status, scheduled_for
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,
        $16,$17,$18
      ) RETURNING *`,
      [
        id,
        parsed.data.customerName,
        parsed.data.customerPhone,
        parsed.data.pickupAddress,
        parsed.data.dropoffAddress,
        parsed.data.packageType,
        parsed.data.weightKg,
        parsed.data.notes,
        parsed.data.dimensionsCm.length,
        parsed.data.dimensionsCm.width,
        parsed.data.dimensionsCm.height,
        parsed.data.distanceKm,
        'RECEIVED',
        pricing.totalBeforeVat,
        pricing.vatAmount,
        pricing.grandTotal,
        'pending',
        parsed.data.scheduledFor ?? null
      ]
    );

    await query(
      `INSERT INTO status_history (id, request_id, from_status, to_status, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [statusHistoryId, id, null, 'RECEIVED', 'Request created']
    );

    return res.status(201).json(mapRequestRow(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

app.get('/v1/admin/requests', async (req, res, next) => {
  try {
    if (!hasDatabase()) {
      return res.status(503).json({ error: 'Database unavailable. Set DATABASE_URL to enable admin features.' });
    }

    const querySchema = z.object({
      status: z.string().min(3).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0)
    });

    const parsedQuery = querySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Invalid query parameters.', details: parsedQuery.error.flatten() });
    }

    const { status, limit, offset } = parsedQuery.data;
    const params = [];

    let whereClause = '';
    if (status) {
      params.push(status.toUpperCase());
      whereClause = `WHERE status = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT * FROM delivery_requests
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      count: result.rows.length,
      items: result.rows.map(mapRequestRow)
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/v1/admin/requests/:id', async (req, res, next) => {
  try {
    if (!hasDatabase()) {
      return res.status(503).json({ error: 'Database unavailable. Set DATABASE_URL to enable admin features.' });
    }

    const idSchema = z.object({ id: z.string().uuid() });
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request id.', details: parsed.error.flatten() });
    }

    const requestResult = await query('SELECT * FROM delivery_requests WHERE id = $1', [parsed.data.id]);
    if (!requestResult.rows[0]) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const historyResult = await query(
      'SELECT id, from_status, to_status, note, changed_at FROM status_history WHERE request_id = $1 ORDER BY changed_at ASC',
      [parsed.data.id]
    );

    return res.json({
      ...mapRequestRow(requestResult.rows[0]),
      statusHistory: historyResult.rows.map((row) => ({
        id: row.id,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        note: row.note,
        changedAt: row.changed_at
      }))
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/admin/requests/:id/assign', async (req, res, next) => {
  try {
    if (!hasDatabase()) {
      return res.status(503).json({ error: 'Database unavailable. Set DATABASE_URL to enable admin features.' });
    }

    const idParsed = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!idParsed.success) {
      return res.status(400).json({ error: 'Invalid request id.', details: idParsed.error.flatten() });
    }

    const assignParsed = assignDriverSchema.safeParse(req.body);
    if (!assignParsed.success) {
      return res.status(400).json({ error: 'Invalid assignment payload.', details: assignParsed.error.flatten() });
    }

    const requestResult = await query('SELECT id, status FROM delivery_requests WHERE id = $1', [idParsed.data.id]);
    if (!requestResult.rows[0]) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const driverResult = await query('SELECT id, is_active FROM drivers WHERE id = $1', [assignParsed.data.driverId]);
    if (!driverResult.rows[0] || !driverResult.rows[0].is_active) {
      return res.status(400).json({ error: 'Driver not found or inactive.' });
    }

    await query(
      `INSERT INTO request_assignments (id, request_id, driver_id, note)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), idParsed.data.id, assignParsed.data.driverId, assignParsed.data.note]
    );

    const fromStatus = requestResult.rows[0].status;
    await query(
      `UPDATE delivery_requests
       SET status = 'ASSIGNED', updated_at = NOW()
       WHERE id = $1`,
      [idParsed.data.id]
    );

    await query(
      `INSERT INTO status_history (id, request_id, from_status, to_status, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), idParsed.data.id, fromStatus, 'ASSIGNED', assignParsed.data.note]
    );

    return res.status(200).json({ ok: true, requestId: idParsed.data.id, driverId: assignParsed.data.driverId, status: 'ASSIGNED' });
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/admin/requests/:id/status', async (req, res, next) => {
  try {
    if (!hasDatabase()) {
      return res.status(503).json({ error: 'Database unavailable. Set DATABASE_URL to enable admin features.' });
    }

    const idParsed = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!idParsed.success) {
      return res.status(400).json({ error: 'Invalid request id.', details: idParsed.error.flatten() });
    }

    const statusParsed = updateStatusSchema.safeParse(req.body);
    if (!statusParsed.success) {
      return res.status(400).json({ error: 'Invalid status payload.', details: statusParsed.error.flatten() });
    }

    const requestResult = await query('SELECT id, status FROM delivery_requests WHERE id = $1', [idParsed.data.id]);
    if (!requestResult.rows[0]) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const fromStatus = requestResult.rows[0].status;
    await query(
      `UPDATE delivery_requests
       SET status = $2, updated_at = NOW()
       WHERE id = $1`,
      [idParsed.data.id, statusParsed.data.toStatus]
    );

    await query(
      `INSERT INTO status_history (id, request_id, from_status, to_status, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), idParsed.data.id, fromStatus, statusParsed.data.toStatus, statusParsed.data.note || null]
    );

    return res.status(200).json({ ok: true, requestId: idParsed.data.id, fromStatus, toStatus: statusParsed.data.toStatus });
  } catch (error) {
    return next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});
