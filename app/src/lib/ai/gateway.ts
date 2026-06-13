import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ── AI Gateway（对齐 docs/04 §3）─────────────────────────────────────
// 模型无关 + 默认最强 Claude，按任务分级以平衡质量/延迟/成本。
// 事实（价格/库存/参数）一律由工具/DB 提供，模型只做"理解与解释"（docs/05 §6 抗幻觉）。

export type Tier = "fast" | "balanced" | "deep";

const MODELS: Record<Tier, string> = {
  // 可经 env 覆盖；默认采用当前最强 Claude 族（模型 ID 以接入时官方为准）
  fast: process.env.ZENO_MODEL_FAST ?? "claude-haiku-4-5-20251001", // 抽取/富化/分类
  balanced: process.env.ZENO_MODEL_BALANCED ?? "claude-sonnet-4-6", // 主对话/排序解释
  deep: process.env.ZENO_MODEL_DEEP ?? "claude-opus-4-8", // 难推理/争议对比
};

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

interface CompleteOpts {
  tier?: Tier;
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function complete(opts: CompleteOpts): Promise<string> {
  const { tier = "balanced", system, prompt, maxTokens = 1024, temperature = 0.2 } = opts;
  const res = await anthropic().messages.create({
    model: MODELS[tier],
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// 让模型产出结构化 JSON，并用 zod 校验；失败重试一次（带纠错提示）。
export async function completeJSON<T>(
  schema: z.ZodType<T>,
  opts: CompleteOpts,
): Promise<T> {
  const base = `${opts.prompt}\n\n仅输出符合要求的 JSON，不要任何解释或代码围栏。`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await complete({ ...opts, prompt: base, temperature: 0 });
    const json = extractJSON(raw);
    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;
    if (attempt === 1) {
      throw new Error("completeJSON: 校验失败 — " + parsed.error.message);
    }
  }
  throw new Error("completeJSON: unreachable");
}

function extractJSON(raw: string): unknown {
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return {};
  }
}
