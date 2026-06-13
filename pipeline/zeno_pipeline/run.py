"""管道 CLI：ingest → normalize → enrich → load。

用法：
    python -m zeno_pipeline.run --source seed          # 用种子样本跑通流程
    python -m zeno_pipeline.run --source seed --no-enrich
    python -m zeno_pipeline.run --source amazon        # 需先接入 PA-API
"""

from __future__ import annotations

import argparse

from dotenv import load_dotenv

from . import db
from .enrich import enrich
from .ingest import AmazonIngest, normalize, raw_seed


def main() -> None:
    load_dotenv()  # 读取根 .env
    ap = argparse.ArgumentParser(description="Zeno 供给富化管道")
    ap.add_argument("--source", choices=["seed", "amazon"], default="seed")
    ap.add_argument("--category", default="headphones")
    ap.add_argument("--no-enrich", action="store_true", help="跳过 LLM 富化（仅标准化）")
    args = ap.parse_args()

    # 1) ingest
    if args.source == "seed":
        raws = raw_seed()
    else:
        raws = AmazonIngest().fetch(args.category)

    # 2) normalize → 3) enrich
    products = [normalize(r) for r in raws]
    if not args.no_enrich:
        products = [enrich(p) for p in products]

    # 4) load
    conn = db.get_conn()
    try:
        ids = [db.load_product(conn, p) for p in products]
    finally:
        conn.close()

    print(f"✓ 处理 {len(products)} 个商品，入库 product_id：")
    for p, pid in zip(products, ids):
        print(f"  - {pid}  {p.title_canonical[:48]}  form_factor={p.attributes.get('form_factor','?')}")


if __name__ == "__main__":
    main()
