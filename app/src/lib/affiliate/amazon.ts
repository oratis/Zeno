import { Offer } from "@/lib/types";

// 归因链接生成（docs/06 §2.3）。MVP：把 Associates tag 注入 buy_url_template。
// 接入 PA-API 后改为按 ASIN 取真值链接 + SubID 细分归因。
export function buildBuyUrl(offer: Offer): string {
  const tag = process.env.AFFILIATE_TAG ?? "zeno-20";
  return offer.buy_url_template.replace("{AFFILIATE_TAG}", encodeURIComponent(tag));
}

// FTC 披露文案（docs/09）：含返佣链接必须显著、清晰。
export const AFFILIATE_DISCLOSURE = "含返佣链接 · 返佣不影响以上排序";
