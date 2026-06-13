-- Zeno · 初始数据库 schema（MVP / Sprint 0）
-- 对齐 docs/07-data-model.md 的「统一商品模型（Product + Offer）」+ 会话/归因/埋点。
-- 目标市场：US；货币：USD。需 Postgres 14+ 与 pgvector 扩展。
--
-- 运行：psql "$DATABASE_URL" -f db/migrations/0001_init.sql

CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector：向量检索
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- 关键词/型号模糊匹配
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- products：一个「商品实体」（跨平台同款已合并）。详见 docs/07 §1。
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  product_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title_canonical   TEXT        NOT NULL,
  brand             TEXT,
  model             TEXT,
  gtin              TEXT[]      DEFAULT '{}',          -- 条码/型号等强标识，用于同款合并
  category_path     TEXT[]      NOT NULL DEFAULT '{}', -- e.g. {electronics,audio,headphones}

  attributes        JSONB       NOT NULL DEFAULT '{}', -- 结构化属性（富化产出，可推理）
  fit_for           JSONB       NOT NULL DEFAULT '{}', -- {use_cases:[], personas:[], not_for:[]}
  review_summary    JSONB       NOT NULL DEFAULT '{}', -- {pros, cons, rating, rating_count, sources}
  relations         JSONB       NOT NULL DEFAULT '{}', -- {same_as, alternatives, accessories, upgrade_of}

  embedding         VECTOR(1024),                      -- 语义向量（Voyage/兼容；可空，缺省走结构化+关键词检索）
  quality_score     REAL        NOT NULL DEFAULT 0.5,  -- 供给质量分（docs/06 §4）
  enrichment_version TEXT,
  search_text       TEXT,                              -- 标题+属性拼接，供 trigram/全文兜底
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category   ON products USING GIN (category_path);
CREATE INDEX IF NOT EXISTS idx_products_attributes ON products USING GIN (attributes);
CREATE INDEX IF NOT EXISTS idx_products_fit_for    ON products USING GIN (fit_for);
CREATE INDEX IF NOT EXISTS idx_products_searchtext ON products USING GIN (search_text gin_trgm_ops);
-- 向量索引（pgvector）：余弦距离。数据量大后再调 lists/probes。
CREATE INDEX IF NOT EXISTS idx_products_embedding  ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────
-- offers：一个「购买渠道报价」（一个 product 可有多个）。详见 docs/07 §1。
-- commission_rate 仅用于结算与单位经济，**严禁进入排序**（docs/09）。
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
  offer_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id        UUID        NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  market            TEXT        NOT NULL DEFAULT 'US',     -- US / CN
  source            TEXT        NOT NULL,                  -- amazon_associates / cj / ...
  merchant          JSONB       NOT NULL DEFAULT '{}',     -- {id, name, trust_score}

  price_list        NUMERIC(12,2),
  price_current     NUMERIC(12,2),
  currency          TEXT        NOT NULL DEFAULT 'USD',
  deals             JSONB       NOT NULL DEFAULT '[]',     -- [{type, value, stackable}]
  final_price       NUMERIC(12,2),                         -- 到手价（含可叠加优惠）：排序/展示核心
  in_stock          BOOLEAN     NOT NULL DEFAULT true,
  shipping          JSONB       NOT NULL DEFAULT '{}',     -- {eta_days, fee}

  buy_url_template  TEXT        NOT NULL,                  -- 履约时注入归因参数（tag/SubID）
  attribution_scheme TEXT       NOT NULL DEFAULT 'amazon_tag',
  commission_rate   REAL,                                  -- 仅结算用；不入排序（docs/09）

  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_buyable_at TIMESTAMPTZ                          -- 可购买性校验时间（docs/05 §6）
);

CREATE INDEX IF NOT EXISTS idx_offers_product ON offers(product_id);
CREATE INDEX IF NOT EXISTS idx_offers_market  ON offers(market);
CREATE INDEX IF NOT EXISTS idx_offers_price   ON offers(final_price);

-- ─────────────────────────────────────────────────────────────
-- sessions：会话状态（docs/07 §4）。个人数据按区域驻留（docs/09）。
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  session_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_key          TEXT,                                  -- 匿名/哈希用户标识（MVP 可空）
  market            TEXT        NOT NULL DEFAULT 'US',
  need_spec         JSONB       NOT NULL DEFAULT '{}',     -- 当前 Need Spec（docs/05 §1, 12 §5）
  shown_product_ids UUID[]      NOT NULL DEFAULT '{}',     -- 已展示，避免重复
  stage             TEXT        NOT NULL DEFAULT 'clarifying',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- events：埋点（采纳/澄清轮次/点击归因…）。驱动 docs/11 度量。
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  event_id          BIGSERIAL PRIMARY KEY,
  session_id        UUID        REFERENCES sessions(session_id) ON DELETE SET NULL,
  type              TEXT        NOT NULL,                  -- need_understood|candidates_shown|clarify|click|...
  payload           JSONB       NOT NULL DEFAULT '{}',
  product_id        UUID,
  offer_id          UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events(type);
