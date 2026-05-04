import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = config.databaseUrl
  ? new Pool({ connectionString: config.databaseUrl })
  : null;

export const hasDatabase = () => Boolean(pool);

export const query = async (text, params = []) => {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return pool.query(text, params);
};
