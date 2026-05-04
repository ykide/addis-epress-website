import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { config } from './config.js';
import { calculatePrice } from './pricing.js';
import { hasDatabase } from './db.js';

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

app.post('/v1/requests', (req, res) => {
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

  const response = {
    id: crypto.randomUUID(),
    status: 'RECEIVED',
    pricing,
    paymentStatus: 'pending',
    ...parsed.data,
    createdAt: new Date().toISOString()
  };

  return res.status(201).json(response);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});
