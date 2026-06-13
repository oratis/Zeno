import { z } from "zod";

// ── 统一商品模型（对齐 docs/07 与 db schema）─────────────────────────
export interface Product {
  product_id: string;
  title_canonical: string;
  brand: string | null;
  model: string | null;
  category_path: string[];
  attributes: Record<string, any>;
  fit_for: { use_cases?: string[]; personas?: string[]; not_for?: string[] };
  review_summary: {
    pros?: { point: string; support?: number; n?: number }[];
    cons?: { point: string; support?: number; n?: number }[];
    rating?: number;
    rating_count?: number;
    sources?: string[];
  };
  quality_score: number;
}

export interface Offer {
  offer_id: string;
  product_id: string;
  market: string;
  source: string;
  merchant: { id?: string; name?: string; trust_score?: number };
  price_current: number | null;
  final_price: number | null; // 到手价：排序/展示核心
  currency: string;
  deals: { type: string; value: number; stackable?: boolean }[];
  in_stock: boolean;
  shipping: { eta_days?: number; fee?: number };
  buy_url_template: string;
  commission_rate: number | null; // ⚠️ 仅结算用，绝不进入排序（docs/09）
}

// product + 它最优的 offer，一起进入检索/排序
export interface ProductWithOffer extends Product {
  offer: Offer;
}

// ── Need Spec（对齐 docs/05 §1、docs/12 §5）──────────────────────────
// 用 zod 校验 LLM 输出；推断约束带 evidence，便于"谦逊外显"。
export const NeedSpecSchema = z.object({
  category: z.string().nullish(),
  price_max: z.number().nullish(),
  // 硬约束
  hard: z
    .object({
      form_factor_exclude: z.array(z.string()).default([]), // 如 ["in_ear"]
      must: z.array(z.string()).default([]),
      exclude: z.array(z.string()).default([]),
    })
    .default({ form_factor_exclude: [], must: [], exclude: [] }),
  // 软偏好：维度 → 权重(0..1)，如 { noise_canceling: 0.8, comfort_long_wear: 0.9 }
  soft: z.record(z.number()).default({}),
  context: z
    .object({
      use_cases: z.array(z.string()).default([]),
      buyer: z.enum(["self", "gift"]).default("self"),
    })
    .default({ use_cases: [], buyer: "self" }),
  // 隐性推断：从用户措辞推断的约束（谦逊、可否决）
  implicit: z
    .array(z.object({ note: z.string(), evidence: z.string() }))
    .default([]),
  keywords: z.array(z.string()).default([]),
  // 仅当存在高信息增益缺口时给一个澄清问题（否则 null，走"假设优先"）
  clarify: z.string().nullish(),
});

export type NeedSpec = z.infer<typeof NeedSpecSchema>;

// ── 排序输出：候选 + 可解释理由（docs/05 §3）─────────────────────────
export interface Candidate {
  product: ProductWithOffer;
  why: string; // 为什么是它（对应到用户约束）
  tradeoff: string; // 代价/取舍（坦白）
  matched: string[]; // 命中的关键点 chips
  buy_url: string; // 注入归因后的购买链接
}

// ── SSE 事件（服务端流式给前端）──────────────────────────────────────
export type StreamEvent =
  | { kind: "status"; text: string }
  | { kind: "clarify"; question: string }
  | { kind: "candidates"; items: Candidate[]; intro: string }
  | { kind: "error"; message: string }
  | { kind: "done" };
