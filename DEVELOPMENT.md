# Zeno · 开发指南（Sprint 0 脚手架）

本仓库是 **monorepo**。MVP 配置：**市场 US · 品类数码 3C（无线/头戴耳机起步）· 技术栈 Next.js(TS) + Python 管道 + Postgres/pgvector**。
设计与计划见 [`docs/`](./docs/)，尤其 [13-执行启动](./docs/13-execution-kickoff.md)。

```
zeno/
├── app/        对话应用（Next.js + TypeScript）——理解→检索→排序→候选+理由→履约
├── pipeline/   富化管道（Python）——联盟接入→标准化→富化→去重→入库
├── db/         Postgres + pgvector：schema 迁移 + US 3C 种子数据
├── eval/       离线评测：黄金需求集 → 需求满足率/幻觉率
└── docs/       全部设计文档
```

> **细线（thin slice）目标**：一句真实需求 → 2–4 个真实可买候选 + 推荐理由 + 利益披露 + 带归因的购买链接。
> 用**种子数据**即可端到端跑通，无需 Amazon PA-API（接入是清晰标注的下一步）。

---

## 快速开始

前置：Node 20+、Python 3.11+、Postgres 14+（装 `pgvector` 扩展）。

```bash
# 0. 配置环境
cp .env.example .env        # 填 DATABASE_URL、ANTHROPIC_API_KEY

# 1. 建库 + 灌种子（让细线可跑）
make db-reset

# 2. 启动对话应用
make app-install
make app-dev                # → http://localhost:3000

# 3.（可选）富化管道：把种子商品抽属性/向量
make pipeline-install
make pipeline-seed

# 4.（可选）离线评测
make eval
```

试一句：`通勤用、戴久了别夹耳朵、200 刀以内的耳机` → 应返回 2–3 个候选（含开放式/头戴）+ 理由 + 含返佣标注的购买链接。

---

## 架构对应（设计 → 代码）

| 设计模块（docs） | 代码位置 |
|---|---|
| 需求理解 Need Spec（05 §1 / 12 §5） | `app/src/lib/ai/needspec.ts` |
| 编排 Agent Loop（05 §4） | `app/src/lib/agent/loop.ts` |
| 混合检索（05 §2） | `app/src/lib/retrieval/search.ts` |
| 多目标排序 + 理由（05 §3） | `app/src/lib/ranking/rank.ts` |
| AI Gateway 分级模型（04 §3） | `app/src/lib/ai/gateway.ts` |
| 归因链接（06 §2.3） | `app/src/lib/affiliate/amazon.ts` |
| 统一商品模型（07） | `db/migrations/0001_init.sql` · `app/src/lib/types.ts` |
| 富化管道（05 §5 / 06 §2.2） | `pipeline/zeno_pipeline/` |
| 度量埋点（11） | `events` 表 · `app/src/lib/db/events.ts` |

---

## 不变量（任何改动都不可破，来自 docs/09）

- **佣金 `commission_rate` 不进入排序**——仅用于结算/单位经济。
- **真实可买优先于流畅**——展示前校验价格/库存，宁缺毋错。
- **利益披露**——含返佣链接必须显著标注（FTC）。
- **AI 披露**——明确告知用户在与 AI 交互、推荐可能有误。

---

## 下一步（Sprint 1，见 docs/13 §6）

1. 接 Amazon Associates / PA-API，替换种子为真实 US 3C 商品。
2. 接 Voyage 嵌入，启用向量检索（schema 已留 `embedding` 列）。
3. 扩充黄金需求集到 50+，把需求满足率/幻觉率跑出基线。
