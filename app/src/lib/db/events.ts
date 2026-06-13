import { query } from "./client";

// 埋点：驱动 docs/11 的度量（采纳率/澄清轮次/点击归因…）。失败不阻断主链路。
export async function logEvent(
  sessionId: string | null,
  type: string,
  payload: Record<string, any> = {},
  productId?: string,
  offerId?: string,
): Promise<void> {
  try {
    await query(
      `INSERT INTO events (session_id, type, payload, product_id, offer_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, type, JSON.stringify(payload), productId ?? null, offerId ?? null],
    );
  } catch (e) {
    // 埋点失败仅记录，不影响用户
    console.error("[events] logEvent failed:", (e as Error).message);
  }
}
