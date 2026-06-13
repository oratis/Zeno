"""联盟接入 + 标准化（docs/06 §2.1-2.2）。

MVP：
- `raw_seed()` 给几条"原始联盟条目"样本，演示标准化→富化→入库流程（无需外部凭证）。
- `AmazonIngest` 是 Amazon Associates / PA-API 的接入占位，接通后替换 seed。
"""

from __future__ import annotations

from .models import Offer, Product


def raw_seed() -> list[dict]:
    """模拟联盟 feed 的原始条目（字段脏、未结构化）——交给 normalize + enrich 处理。"""
    return [
        {
            "title": "AuraSound A5 Wireless Over-Ear Headphones, Active Noise Cancelling, 40H",
            "brand": "AuraSound",
            "asin": "B0AURA5XXX",
            "price": 129.00,
            "list_price": 149.00,
            "coupon": 10.0,
            "category": "Electronics > Headphones > Over-Ear",
            "description": "Over-ear ANC headphones, 40-hour battery, plush earcups for long listening sessions. 254g.",
            "rating": 4.6,
            "rating_count": 1240,
            "commission_rate": 0.04,
        },
        {
            "title": "AuraSound Air Open-Ear Air Conduction Earphones, Sweatproof, Running",
            "brand": "AuraSound",
            "asin": "B0AURAIRXX",
            "price": 89.00,
            "list_price": 99.00,
            "coupon": 0.0,
            "category": "Electronics > Headphones > Open-Ear",
            "description": "Open-ear design never blocks the ear canal, ideal for running with awareness. IPX5. 33g.",
            "rating": 4.3,
            "rating_count": 640,
            "commission_rate": 0.04,
        },
    ]


def normalize(raw: dict) -> Product:
    """原始条目 → 统一商品模型（仅结构对齐；属性/场景由 enrich 阶段填充）。"""
    list_price = raw.get("list_price")
    price = raw.get("price")
    coupon = raw.get("coupon") or 0.0
    final_price = round((price or 0) - coupon, 2) if price is not None else None

    category_path = [c.strip().lower().replace("-", "_").replace(" ", "_") for c in raw.get("category", "").split(">") if c.strip()]

    offer = Offer(
        market="US",
        source="amazon_associates",
        merchant={"id": "amzn", "name": "Amazon", "trust_score": 0.95},
        price_list=list_price,
        price_current=price,
        currency="USD",
        deals=[{"type": "coupon", "value": coupon, "stackable": True}] if coupon else [],
        final_price=final_price,
        in_stock=True,
        shipping={"eta_days": 2, "fee": 0},
        buy_url_template=f"https://www.amazon.com/dp/{raw.get('asin','')}?tag={{AFFILIATE_TAG}}",
        attribution_scheme="amazon_tag",
        commission_rate=raw.get("commission_rate"),
    )

    return Product(
        title_canonical=raw.get("title", "").strip(),
        brand=raw.get("brand"),
        category_path=category_path,
        review_summary={
            "rating": raw.get("rating"),
            "rating_count": raw.get("rating_count"),
            "sources": ["amazon"],
        },
        offers=[offer],
        # 原始描述临时挂在 attributes._raw，供 enrich 使用，富化后清除
        attributes={"_raw_description": raw.get("description", "")},
    )


class AmazonIngest:
    """Amazon Associates / Product Advertising API 接入（Sprint 1）。

    TODO(接入)：需要 Associates Tag + PA-API 凭证（AccessKey/SecretKey）。
    用 SearchItems/GetItems 按品类拉取 US 3C 商品，映射为上面的 raw dict。
    """

    def fetch(self, category: str) -> list[dict]:
        raise NotImplementedError(
            "Amazon PA-API 未接入：请配置 PA-API 凭证后实现 fetch()，"
            "在此之前用 raw_seed() 跑通流程。"
        )
