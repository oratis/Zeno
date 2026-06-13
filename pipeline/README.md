# pipeline · 供给富化管道（Python）

把联盟来的脏数据变成可推理的统一商品知识（docs/05 §5、docs/06 §2.2）：

```
ingest → normalize → enrich → (dedup) → load
```

- `ingest.py` — `raw_seed()` 演示样本；`AmazonIngest` 是 PA-API 接入占位（Sprint 1）。
- `models.py` — 统一 `Product` / `Offer`（对齐 db schema）。
- `enrich.py` — LLM 抽属性/场景/人群（Claude Haiku 级）；无 key 时退化为最小富化。
- `db.py` — 入库。
- `run.py` — CLI 编排。

```bash
make pipeline-install
make pipeline-seed              # = python -m zeno_pipeline.run --source seed
```

> dedup（跨平台同款合并）与 embedding（Voyage）是 Sprint 1 的明确 TODO。
