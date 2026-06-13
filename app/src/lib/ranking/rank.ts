import { z } from "zod";
import { Candidate, NeedSpec, ProductWithOffer } from "@/lib/types";
import { completeJSON } from "@/lib/ai/gateway";
import { buildBuyUrl } from "@/lib/affiliate/amazon";

// 多目标排序（docs/05 §3）：从候选池选出最适合的 2–4 个 + 可解释理由。
// ⚠️ 中立铁律（docs/09）：commission_rate 绝不传给排序器，也不作为任何信号。
// 排序信号 = 需求契合 / 商品质量 / 到手价价值 / 真实可买；不含佣金、不含竞价。

const RankOut = z.object({
  intro: z.string(),
  picks: z
    .array(
      z.object({
        product_id: z.string(),
        why: z.string(),
        tradeoff: z.string(),
        matched: z.array(z.string()).default([]),
      }),
    )
    .max(4),
});

const SYSTEM = `你是 Zeno 的排序与解释模块，只为买家利益服务。
从候选池里选出最适合该 Need Spec 的 2–4 个，并解释。规则：
- 绝不推荐违反硬约束的商品（超预算、命中 form_factor_exclude / exclude）。
- 候选之间要有"有意义的不同"（不同取舍点），便于用户对比，别给近似重复。
- why：对应到用户的具体约束/场景，讲清"为什么是它"。
- tradeoff：坦白它的代价/短板（没有完美解就说取舍）。
- matched：3–5 个命中点短语（chips）。
- intro：一句话总览（如"按你的'久戴不夹耳 + 通勤'，这 3 个最合适"）。
- 若没有很合适的，就选最接近的并在 why/tradeoff 里坦白差在哪。
- 只依据给到的数据，不臆造参数/价格。`;

export async function rank(need: NeedSpec, pool: ProductWithOffer[]): Promise<{ intro: string; candidates: Candidate[] }> {
  if (pool.length === 0) return { intro: "", candidates: [] };

  // 中立视图：剥离 commission_rate / 任何渠道偏好，只给买家关心的事实
  const neutral = pool.map((p) => ({
    product_id: p.product_id,
    title: p.title_canonical,
    brand: p.brand,
    category: p.category_path,
    attributes: p.attributes,
    fit_for: p.fit_for,
    rating: p.review_summary?.rating,
    rating_count: p.review_summary?.rating_count,
    pros: p.review_summary?.pros?.map((x) => x.point),
    cons: p.review_summary?.cons?.map((x) => x.point),
    final_price: p.offer.final_price,
    currency: p.offer.currency,
  }));

  try {
    const out = await completeJSON(RankOut, {
      tier: "balanced",
      system: SYSTEM,
      prompt: `Need Spec：\n${JSON.stringify(need)}\n\n候选池：\n${JSON.stringify(neutral)}\n\n输出 {intro, picks:[{product_id, why, tradeoff, matched[]}]}（picks 最多 4 个）。`,
      maxTokens: 1100,
    });
    const byId = new Map(pool.map((p) => [p.product_id, p]));
    const candidates: Candidate[] = out.picks
      .map((pk) => {
        const p = byId.get(pk.product_id);
        if (!p) return null;
        return {
          product: p,
          why: pk.why,
          tradeoff: pk.tradeoff,
          matched: pk.matched,
          buy_url: buildBuyUrl(p.offer),
        } as Candidate;
      })
      .filter((c): c is Candidate => c !== null);
    if (candidates.length > 0) return { intro: out.intro, candidates };
  } catch (e) {
    console.error("[rank] LLM ranking failed, falling back:", (e as Error).message);
  }

  return ruleFallback(need, pool);
}

// 规则兜底：契合度(软偏好 vs 属性) + 价值 + 质量；保证服务可用。
function ruleFallback(need: NeedSpec, pool: ProductWithOffer[]): { intro: string; candidates: Candidate[] } {
  const scored = pool
    .map((p) => ({ p, s: fitScore(need, p) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  const candidates = scored.map(({ p }) => ({
    product: p,
    why: `匹配你的${need.context?.use_cases?.join("/") || "需求"}；评分 ${p.review_summary?.rating ?? "-"}。`,
    tradeoff: (p.review_summary?.cons?.[0]?.point as string) || "无明显短板数据。",
    matched: Object.keys(need.soft ?? {}).slice(0, 4),
    buy_url: buildBuyUrl(p.offer),
  }));
  return { intro: "（规则兜底）按契合度与到手价，给你这几个：", candidates };
}

function fitScore(need: NeedSpec, p: ProductWithOffer): number {
  let s = p.quality_score;
  const attrs = p.attributes || {};
  if (need.soft?.noise_canceling && attrs.noise_canceling?.level)
    s += need.soft.noise_canceling * attrs.noise_canceling.level;
  if (need.price_max && p.offer.final_price) s += p.offer.final_price <= need.price_max ? 0.3 : -0.5;
  return s;
}
