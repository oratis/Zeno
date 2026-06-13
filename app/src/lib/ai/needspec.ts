import { NeedSpec, NeedSpecSchema } from "@/lib/types";
import { completeJSON } from "./gateway";

// understand：一句话 → Need Spec（docs/05 §1、docs/12 §4-6）
// 体现"假设优先 + 隐性推断 + 仅问高增益问题"。
const SYSTEM = `你是 Zeno 的需求理解模块。把用户的购物需求解析成结构化 Need Spec。
原则：
1) 假设优先：能合理推断的就推断并填入，不要为了问而问。
2) 隐性推断：把口语线索翻译成约束，并在 implicit 里记录 note + evidence（引用用户原话依据）。
   例："戴久了耳朵疼" → hard.form_factor_exclude 含 "in_ear"，且 soft.comfort_long_wear 高。
3) 软偏好用 0..1 权重表达相对重视度（如 noise_canceling、comfort_long_wear、portability、value）。
4) 仅当存在"会显著改变推荐"的高信息增益缺口时，clarify 给一个简短澄清问题；否则 clarify 置 null。
5) 不要臆造价格/库存/具体型号——只理解需求，不编造事实。
品类示例取值：form_factor ∈ {in_ear, over_ear, open_ear}。`;

export async function understand(userText: string, priorNeed?: NeedSpec): Promise<NeedSpec> {
  const prompt = `用户需求：「${userText}」
${priorNeed ? `已知的先前 Need Spec（在此基础上更新）：\n${JSON.stringify(priorNeed)}` : ""}

输出 Need Spec JSON，字段：category, price_max, hard{form_factor_exclude[], must[], exclude[]}, soft{维度:权重}, context{use_cases[], buyer}, implicit[{note, evidence}], keywords[], clarify。`;

  return completeJSON<NeedSpec>(NeedSpecSchema, {
    tier: "fast",
    system: SYSTEM,
    prompt,
    maxTokens: 700,
  });
}
