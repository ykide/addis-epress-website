# Ethio Express MVP Plan (Backend + Admin)

## 1) Confirmed scope from your answers
- Launch city: **Addis Ababa**.
- Delivery types: **same-day + scheduled**.
- Fleet model: **employed drivers**.
- Delivery model in v1: **1 request = 1 delivery**.
- Customer request fields: name, phone, pickup, dropoff, package type, weight, notes, parcel dimensions.
- Customer tracking: yes, with status updates and optional tracking link via SMS.
- Pricing: **150 ETB base + 20 ETB/km + VAT**, with admin manual override.
- Payments: cash, bank transfer, mobile money; manually marked in admin.
- Notifications: SMS + email on **received, assigned, delivered**.
- Backend stack: Node.js + PostgreSQL on Render.
- Domains: `admin.ethio-express.com` and `api.ethio-express.com`.

---

## 2) Recommended architecture (fast MVP)

### Services
1. **Public website (existing)**
   - Keeps current look/content.
   - Add request form POST to API endpoint.

2. **API service (`api.ethio-express.com`)**
   - Node.js (Express or NestJS).
   - Handles requests, dispatch, pricing, status flow, payments, notifications.

3. **Admin web app (`admin.ethio-express.com`)**
   - React + Next.js (admin-only UI).
   - Dispatcher workflows: assign drivers, update statuses, pricing overrides, payment updates.

4. **PostgreSQL database (Render managed)**
   - Core persistence for requests, drivers, assignments, pricing snapshots, status history, notifications.

5. **Background worker (optional but recommended)**
   - Handles async jobs: SMS/email sending, retries, audit events.

---

## 3) Core workflows

### A) Request intake
1. User submits delivery form from public site.
2. API validates request and geocodes pickup/dropoff.
3. API computes distance and base quote.
4. API stores request with status `RECEIVED`.
5. SMS/email sent to customer: “Request received.”

### B) Dispatch & assignment
1. Dispatcher opens admin queue.
2. Selects available employed driver.
3. Assignment created; request status changes to `ASSIGNED`.
4. SMS/WhatsApp to driver with job summary.
5. SMS/email to customer: “Driver assigned.”

### C) Fulfillment status updates
- `RECEIVED` → `ASSIGNED` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED`
- Optional `CANCELLED` and `FAILED_DELIVERY`.

### D) Completion & payment
1. Driver (or dispatcher) marks delivered.
2. Proof-of-delivery upload is optional.
3. Admin sets payment status manually: pending/paid.
4. SMS/email to customer: “Delivered.”

---

## 4) Pricing model (v1)

**Formula:**

`total_before_vat = 150 + (20 × distance_km)`

`vat_amount = total_before_vat × VAT_RATE`

`grand_total = total_before_vat + vat_amount`

### Pricing controls in admin
- Auto-calculated price shown on request.
- Override amount allowed with mandatory reason.
- Save both **calculated price** and **final charged price** for audit/history.

---

## 5) Suggested database schema (v1)

### `delivery_requests`
- `id` (uuid)
- `customer_name`
- `customer_phone`
- `pickup_address`
- `dropoff_address`
- `pickup_lat`, `pickup_lng`
- `dropoff_lat`, `dropoff_lng`
- `package_type`
- `weight_kg`
- `dimension_length_cm`, `dimension_width_cm`, `dimension_height_cm`
- `notes`
- `distance_km`
- `base_fee`
- `per_km_fee`
- `vat_rate`
- `calculated_total`
- `final_total`
- `price_override_reason` (nullable)
- `status`
- `scheduled_for` (nullable)
- `created_at`, `updated_at`

### `drivers`
- `id` (uuid)
- `full_name`
- `phone`
- `email` (nullable)
- `vehicle_type` (nullable)
- `active` (bool)
- `created_at`, `updated_at`

### `request_assignments`
- `id` (uuid)
- `request_id` (fk)
- `driver_id` (fk)
- `assigned_by`
- `assigned_at`

### `status_history`
- `id` (uuid)
- `request_id` (fk)
- `from_status`
- `to_status`
- `changed_by`
- `changed_at`
- `note` (nullable)

### `payments`
- `id` (uuid)
- `request_id` (fk)
- `method` (cash/bank_transfer/mobile_money)
- `status` (pending/paid/failed)
- `reference` (nullable)
- `recorded_by`
- `recorded_at`

### `proof_of_delivery`
- `id` (uuid)
- `request_id` (fk)
- `image_url` (nullable)
- `recipient_name` (nullable)
- `recipient_phone` (nullable)
- `note` (nullable)
- `uploaded_at`

### `notifications`
- `id` (uuid)
- `request_id` (fk)
- `channel` (sms/email/whatsapp)
- `event_type` (received/assigned/delivered)
- `recipient`
- `provider_message_id` (nullable)
- `status` (queued/sent/failed)
- `error` (nullable)
- `created_at`

---

## 6) API endpoints (v1)

### Public endpoints
- `POST /v1/requests` — create delivery request.
- `GET /v1/track/:trackingCode` — customer tracking view.

### Admin endpoints
- `GET /v1/admin/requests` — list/filter requests.
- `GET /v1/admin/requests/:id` — request details.
- `POST /v1/admin/requests/:id/assign` — assign driver.
- `POST /v1/admin/requests/:id/status` — update status.
- `POST /v1/admin/requests/:id/price-override` — override final price.
- `POST /v1/admin/requests/:id/payment` — set payment status/method.
- `POST /v1/admin/requests/:id/proof` — upload proof (optional).

---

## 7) Admin panel pages
- Dashboard (today’s volume, pending assignments, delivered count).
- Requests list with filters (status/date/driver/payment).
- Request details drawer/page.
- Driver management page.
- Reports/export page (CSV first, PDF later).

---

## 8) Render deployment blueprint

### Render resources
1. `ethio-express-api` (Web Service)
2. `ethio-express-admin` (Web Service or Static + SSR as needed)
3. `ethio-express-db` (PostgreSQL)
4. Optional worker: `ethio-express-jobs`

### Env vars (API)
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN=https://admin.ethio-express.com,https://ethio-express.com`
- `BASE_FEE_ETB=150`
- `PER_KM_FEE_ETB=20`
- `VAT_RATE=0.15` (or current legal rate you confirm)
- SMS provider credentials
- Email provider credentials

### DNS
- `api.ethio-express.com` → API service
- `admin.ethio-express.com` → Admin service

---

## 9) Implementation phases

### Phase 1 (Week 1)
- Set up API project, DB schema, migrations.
- Build request intake + price calculation + status history.
- Build basic admin login (single admin for now) and request list.

### Phase 2 (Week 2)
- Driver assignment flow.
- Status update flow.
- SMS/email notifications for received/assigned/delivered.
- Payment manual status updates.

### Phase 3 (Week 3)
- Tracking link page.
- Optional proof-of-delivery upload.
- Dashboard + CSV exports.
- Hardening, QA, launch checklist.

---

## 10) Immediate next build decisions
1. Choose framework: **NestJS + Prisma** (recommended) or Express + Sequelize.
2. Choose SMS/WhatsApp provider available in Ethiopia.
3. Confirm VAT rate to apply in system.
4. Confirm map/distance provider (Google Maps or Mapbox).

