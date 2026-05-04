import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(process.env.PORT, 3000),
  baseFeeEtb: toNumber(process.env.BASE_FEE_ETB, 150),
  perKmFeeEtb: toNumber(process.env.PER_KM_FEE_ETB, 20),
  vatRate: toNumber(process.env.VAT_RATE, 0.15),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  databaseUrl: process.env.DATABASE_URL ?? ''
};
