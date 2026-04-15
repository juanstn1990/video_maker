import { Pool } from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://lalala:lalala@194.163.143.253:5432/lalala?sslmode=disable'

export const pool = new Pool({ connectionString: DATABASE_URL })

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watermark_records (
      id          SERIAL PRIMARY KEY,
      job_id      VARCHAR(255) NOT NULL,
      phone       VARCHAR(50)  NOT NULL,
      song_name   VARCHAR(500) NOT NULL,
      output_filename VARCHAR(500) NOT NULL,
      output_path TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  // Migration: add input_path column if it doesn't exist
  await pool.query(`
    ALTER TABLE watermark_records ADD COLUMN IF NOT EXISTS input_path TEXT
  `)
  console.log('DB: tabla watermark_records lista')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(500) NOT NULL DEFAULT 'Mi Video',
      config      JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  console.log('DB: tabla video_projects lista')
}
