"""入库（docs/06 §2.2 ⑦）。MVP：简单插入；dedup 同款合并待 Sprint 1。"""

from __future__ import annotations

import os

import psycopg
from psycopg.types.json import Json

from .models import Product


def get_conn() -> psycopg.Connection:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("缺少 DATABASE_URL（见根目录 .env.example）")
    return psycopg.connect(dsn)


def load_product(conn: psycopg.Connection, p: Product) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO products
              (title_canonical, brand, model, gtin, category_path,
               attributes, fit_for, review_summary, relations,
               quality_score, enrichment_version, search_text)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING product_id
            """,
            (
                p.title_canonical, p.brand, p.model, p.gtin, p.category_path,
                Json(p.attributes), Json(p.fit_for), Json(p.review_summary), Json(p.relations),
                p.quality_score, p.enrichment_version, p.search_text,
            ),
        )
        product_id = cur.fetchone()[0]
        for o in p.offers:
            cur.execute(
                """
                INSERT INTO offers
                  (product_id, market, source, merchant, price_list, price_current, currency,
                   deals, final_price, in_stock, shipping, buy_url_template,
                   attribution_scheme, commission_rate, verified_buyable_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                """,
                (
                    product_id, o.market, o.source, Json(o.merchant), o.price_list, o.price_current, o.currency,
                    Json(o.deals), o.final_price, o.in_stock, Json(o.shipping), o.buy_url_template,
                    o.attribution_scheme, o.commission_rate,
                ),
            )
    conn.commit()
    return str(product_id)
