"""统一商品模型（对齐 docs/07 与 db/migrations/0001_init.sql）。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class Offer(BaseModel):
    market: str = "US"
    source: str = "amazon_associates"
    merchant: dict = Field(default_factory=dict)
    price_list: float | None = None
    price_current: float | None = None
    currency: str = "USD"
    deals: list[dict] = Field(default_factory=list)
    final_price: float | None = None  # 到手价：排序/展示核心
    in_stock: bool = True
    shipping: dict = Field(default_factory=dict)
    buy_url_template: str = ""
    attribution_scheme: str = "amazon_tag"
    commission_rate: float | None = None  # ⚠️ 仅结算用，不入排序（docs/09）


class Product(BaseModel):
    title_canonical: str
    brand: str | None = None
    model: str | None = None
    gtin: list[str] = Field(default_factory=list)
    category_path: list[str] = Field(default_factory=list)

    # 富化产出（enrich 阶段填充）
    attributes: dict = Field(default_factory=dict)
    fit_for: dict = Field(default_factory=dict)
    review_summary: dict = Field(default_factory=dict)
    relations: dict = Field(default_factory=dict)

    embedding: list[float] | None = None  # 接 Voyage 后填充
    quality_score: float = 0.5
    enrichment_version: str | None = None
    search_text: str | None = None

    offers: list[Offer] = Field(default_factory=list)
