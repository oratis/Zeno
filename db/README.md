# db · Postgres + pgvector

统一商品模型（`products` / `offers`）+ 会话（`sessions`）+ 埋点（`events`）。对齐 [docs/07](../docs/07-data-model.md)。

```bash
# 需先装 pgvector 扩展（migration 里 CREATE EXTENSION vector）
make db-init     # 建表
make db-seed     # 灌 US 3C 种子（让细线无需 Amazon 即可跑通）
make db-reset    # = init + seed
```

要点：
- `products.embedding VECTOR(1024)` 已就绪（接 Voyage 后启用向量召回；当前走结构化 + pg_trgm 关键词）。
- `offers.commission_rate` **仅结算用，排序层不可读**（中立铁律，docs/09）。
- 种子数据为示意样本，非真实抓取——接 Amazon PA-API 后由 `pipeline/` 替换。
