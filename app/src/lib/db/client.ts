import { Pool } from "pg";

// 单例连接池（Next.js 开发期热重载下也只建一个）
const globalForPg = globalThis as unknown as { zenoPool?: Pool };

export const pool =
  globalForPg.zenoPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForPg.zenoPool = pool;

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
