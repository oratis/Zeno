import { StreamEvent } from "@/lib/types";
import { understand } from "@/lib/ai/needspec";
import { retrieve } from "@/lib/retrieval/search";
import { rank } from "@/lib/ranking/rank";
import { logEvent } from "@/lib/db/events";

// 编排主循环（docs/05 §4）：理解 → 检索 → 排序 → 候选+理由。
// 以 async generator 流式产出事件；事实由 DB/工具提供，模型只理解与解释（抗幻觉）。
export async function* runAgent(userText: string, sessionId: string): AsyncGenerator<StreamEvent> {
  // 1) 理解需求
  yield { kind: "status", text: "理解你的需求…" };
  let need;
  try {
    need = await understand(userText);
  } catch (e) {
    yield { kind: "error", message: "需求理解失败，请换个说法再试。" };
    return;
  }
  await logEvent(sessionId, "need_understood", { need });

  // 假设优先：有高增益缺口就外显一个澄清问题，但仍按当前假设继续给候选
  if (need.clarify) yield { kind: "clarify", question: need.clarify };

  // 2) 检索候选池
  yield { kind: "status", text: "从全网检索候选…" };
  let pool;
  try {
    pool = await retrieve(need);
  } catch (e) {
    yield { kind: "error", message: "检索失败：" + (e as Error).message };
    return;
  }
  if (pool.length === 0) {
    yield { kind: "candidates", items: [], intro: "目前没有完全符合的商品。放宽一个约束（如预算或形态）我再帮你找。" };
    yield { kind: "done" };
    return;
  }

  // 3) 排序 + 解释（commission 不参与，见 rank.ts）
  yield { kind: "status", text: `命中 ${pool.length} 个，正在挑出最合适的并讲清理由…` };
  let result;
  try {
    result = await rank(need, pool);
  } catch (e) {
    yield { kind: "error", message: "排序失败：" + (e as Error).message };
    return;
  }

  await logEvent(sessionId, "candidates_shown", {
    count: result.candidates.length,
    product_ids: result.candidates.map((c) => c.product.product_id),
  });

  yield { kind: "candidates", items: result.candidates, intro: result.intro };
  yield { kind: "done" };
}
