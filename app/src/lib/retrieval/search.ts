import { query } from "@/lib/db/client";
import { NeedSpec, ProductWithOffer } from "@/lib/types";

// 混合检索（docs/05 §2）：结构化硬约束过滤 + 关键词/语义相似排序，召回候选池。
// MVP：用 pg_trgm 关键词相似度兜底；embedding 列已就绪，接入 Voyage 后可切向量召回。
// 召回宁多勿漏（漏召直接拉低需求满足率）——硬过滤只用最硬的（预算、排除形态）。
export async function retrieve(need: NeedSpec, limit = 12): Promise<ProductWithOffer[]> {
  const priceMax = need.price_max ?? null;
  const excludeFf = need.hard?.form_factor_exclude ?? [];

  // 检索文本：关键词 + 品类 + 场景，做相似度排序的查询串
  const queryText = [
    ...(need.keywords ?? []),
    need.category ?? "",
    ...(need.context?.use_cases ?? []),
    ...Object.keys(need.soft ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 200);

  const rows = await query<any>(
    `
    SELECT
      p.product_id, p.title_canonical, p.brand, p.model, p.category_path,
      p.attributes, p.fit_for, p.review_summary, p.quality_score,
      o.offer_id, o.market, o.source, o.merchant, o.price_current, o.final_price,
      o.currency, o.deals, o.in_stock, o.shipping, o.buy_url_template, o.commission_rate,
      GREATEST(similarity(p.search_text, $1), 0) AS sim
    FROM products p
    JOIN LATERAL (
      SELECT * FROM offers o2
      WHERE o2.product_id = p.product_id AND o2.in_stock
      ORDER BY o2.final_price ASC NULLS LAST
      LIMIT 1
    ) o ON true
    WHERE ($2::numeric IS NULL OR o.final_price <= $2)
      AND ( cardinality($3::text[]) = 0
            OR (p.attributes->>'form_factor') IS NULL
            OR (p.attributes->>'form_factor') <> ALL($3::text[]) )
    ORDER BY (0.6 * GREATEST(similarity(p.search_text, $1), 0) + 0.4 * p.quality_score) DESC
    LIMIT $4
    `,
    [queryText || "headphones", priceMax, excludeFf, limit],
  );

  return rows.map(mapRow);
}

function num(v: any): number | null {
  return v === null || v === undefined ? null : Number(v);
}

function mapRow(r: any): ProductWithOffer {
  return {
    product_id: r.product_id,
    title_canonical: r.title_canonical,
    brand: r.brand,
    model: r.model,
    category_path: r.category_path ?? [],
    attributes: r.attributes ?? {},
    fit_for: r.fit_for ?? {},
    review_summary: r.review_summary ?? {},
    quality_score: num(r.quality_score) ?? 0.5,
    offer: {
      offer_id: r.offer_id,
      product_id: r.product_id,
      market: r.market,
      source: r.source,
      merchant: r.merchant ?? {},
      price_current: num(r.price_current),
      final_price: num(r.final_price),
      currency: r.currency ?? "USD",
      deals: r.deals ?? [],
      in_stock: r.in_stock,
      shipping: r.shipping ?? {},
      buy_url_template: r.buy_url_template,
      commission_rate: num(r.commission_rate), // 不会传给排序器，见 rank.ts
    },
  };
}
