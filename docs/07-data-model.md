# 07 · 数据模型与商品知识图谱

> 关联文档：[AI 引擎](./05-ai-engine.md) · [供给侧](./06-supply-side.md) · [系统架构](./04-system-architecture.md) · [合规](./09-trust-safety-compliance.md)

数据模型是 Zeno 的核心资产。它要解决两个问题：①把**异构全网商品**统一成可推理的知识；②把**用户需求与记忆**结构化以驱动个性化匹配。以下 schema 为**设计示意**（字段示例，非最终）。

---

## 1. 统一商品模型（Universal Product Model）

把来自不同平台的同一商品，建模为 **一个商品实体（Product）+ 多个购买报价（Offer）**。这是"跨平台比到手价"的数据基础。

```jsonc
// Product —— 一个"商品实体"（跨平台同款已合并）
{
  "product_id": "zeno_prod_8f3a...",        // Zeno 内部主键
  "title_canonical": "XX 头戴式主动降噪耳机 第3代",
  "category_path": ["电子", "音频", "头戴耳机"],
  "brand": "XX",
  "gtin": ["06901234567890"],               // 条码/型号等强标识，用于同款合并
  "model": "WH-XX3",

  // —— 结构化属性（富化产出，可推理）——
  "attributes": {
    "form_factor": "over_ear",
    "noise_canceling": { "type": "active", "level": 0.85 },
    "battery_hours": 40,
    "weight_g": 254,
    "wireless": true,
    "water_resistant": false
  },

  // —— 适用场景 / 人群（语义匹配用）——
  "fit_for": {
    "use_cases": ["commute", "office", "travel"],
    "personas": ["long_wear_comfort_seeker"],
    "not_for": ["intense_sport"]
  },

  // —— 口碑提炼（带样本量与出处，不臆造）——
  "review_summary": {
    "pros": [ { "point": "佩戴久不夹耳", "support": 0.78, "n": 1240 } ],
    "cons": [ { "point": "略重", "support": 0.31, "n": 1240 } ],
    "rating": 4.6, "rating_count": 1240,
    "sources": ["taobao", "jd"]
  },

  // —— 语义向量（多视角）——
  "embeddings": { "semantic": "<vec>", "usecase": "<vec>" },

  // —— 关系（知识图谱边的冗余镜像）——
  "relations": {
    "same_as": ["zeno_prod_..."],           // 同款
    "alternatives": ["zeno_prod_..."],       // 替代/平替
    "accessories": ["zeno_prod_..."],        // 配件/兼容
    "upgrade_of": "zeno_prod_..."            // 升级/降级
  },

  "quality_score": 0.82,                     // 供给质量分（[06]）
  "enrichment_version": "2026.06",
  "updated_at": "2026-06-13T..."
}
```

```jsonc
// Offer —— 一个"购买渠道报价"（一个 Product 可有多个）
{
  "offer_id": "zeno_offer_...",
  "product_id": "zeno_prod_8f3a...",
  "market": "CN",                            // CN / US
  "source": "jd_union",                      // 联盟/直连来源
  "merchant": { "id": "...", "name": "...", "trust_score": 0.9 },

  // —— 价格与到手价（近实时）——
  "price": { "list": 1199, "current": 999, "currency": "CNY" },
  "deals": [ { "type": "coupon", "value": 100, "stackable": true } ],
  "final_price": 899,                        // 到手价（含可叠加优惠）
  "in_stock": true,
  "shipping": { "eta_days": 2, "fee": 0 },

  // —— 履约 / 归因 ——
  "buy_url_template": "...",                  // 履约时注入跟单标识
  "attribution": { "scheme": "subunionid" }, // PID/SubID/uid/tag
  "commission_rate": 0.04,                   // 仅用于结算，不入排序([09])

  "fetched_at": "2026-06-13T...",
  "verified_buyable_at": "2026-06-13T..."    // 可购买性校验时间
}
```

> **要点**：`final_price`（到手价）是排序与展示的核心；`commission_rate` **仅用于结算与单位经济**，被制度性地**排除在排序信号之外**（[09](./09-trust-safety-compliance.md)）。

---

## 2. 商品知识图谱（Product Knowledge Graph）

商品不是孤立条目，而是**节点与关系的网络**，支撑"场景推理""平替""兼容""收窄"等能力。

**节点类型**：`Product` · `Category` · `Attribute` · `Brand` · `UseCase(场景)` · `Persona(人群)` · `Merchant`

**关系（边）类型**：
```
Product ──same_as──▶ Product          // 跨平台同款
Product ──alternative_of──▶ Product    // 平替/替代
Product ──compatible_with──▶ Product   // 配件/兼容
Product ──upgrade_of──▶ Product        // 升级/降级
Product ──fits──▶ UseCase / Persona    // 适用场景/人群
Product ──belongs_to──▶ Category
Product ──has──▶ Attribute
Product ──sold_by──▶ Merchant
```

**本体（Ontology）**：类目体系、属性字典、场景/人群词表，构成跨市场可复用的**本体层**（[04 §5](./04-system-architecture.md) 中作为"非个人核心资产"跨区共享）。

**用途**：
- 检索时做关系推理（"小户型适合的收纳"、"X 的平替"）。
- 对比时按品类自动选维度。
- 收窄时保证候选**有意义地不同**（取自不同取舍点）。
- 供给治理时识别同款最低到手价。

---

## 3. 用户需求与记忆模型（Need & Memory）

### 3.1 需求规格（Need Spec，会话级）
见 [05 §1](./05-ai-engine.md)。会话内的当前需求结构（hard/soft/implicit/context + 待澄清项）。

### 3.2 用户长期记忆（User Memory，跨会话）
```jsonc
{
  "user_id": "...",
  "market": "CN",
  "preferences": {
    "brands_pref": [], "brands_avoid": [],
    "budget_bands": { "headphones": [0, 1000] },
    "style": [], "values": ["性价比", "环保"]
  },
  "attributes": { "sizes": { "shoe": 42 }, "skin_type": "sensitive" },
  "rejections": [ { "product_id": "...", "reason": "too_heavy", "at": "..." } ],
  "purchases": [ { "product_id": "...", "at": "..." } ],   // 去重/复购信号
  "watchlist": [ { "product_id": "...", "target_price": 799 } ],
  "consent": { "personalization": true, "retention_days": 365 },  // [09]
  "updated_at": "..."
}
```

**治理（关键，[09](./09-trust-safety-compliance.md)）**
- 用户可**查看 / 编辑 / 导出 / 删除**全部记忆。
- 记忆**按区域驻留**（CN/US 不跨境），个人数据不进入跨区共享层。
- 个性化基于**明确同意**；可一键关闭个性化。
- 拒绝/购买信号用于"避免重复推荐"，而非用于操纵。

---

## 4. 会话状态（Conversation State）

```jsonc
{
  "session_id": "...", "user_id": "...", "market": "CN",
  "need_spec": { /* 见 05 §1 */ },
  "turn_history": [ /* 多轮：输入/动作/候选/选择 */ ],
  "shown_candidates": ["zeno_prod_..."],     // 已展示，避免重复
  "constraints_locked": ["price_max=1000", "form_factor!=in_ear"],
  "stage": "comparing",                       // clarifying|narrowing|comparing|deciding
  "ttl": "..."
}
```

---

## 5. 归因数据模型（Attribution）

```jsonc
{
  "click_id": "...", "session_id": "...", "user_id_hashed": "...",
  "offer_id": "...", "product_id": "...",
  "market": "CN", "source": "jd_union",
  "attribution_param": "subunionid=...",
  "clicked_at": "...",
  // —— 回收（与联盟报表匹配）——
  "matched_order": { "order_id": "...", "gmv": 899, "commission": 36, "status": "settled" },
  "reconciled_at": "..."
}
```
- 用户标识在归因中**哈希/脱敏**，遵循本地隐私法（[09](./09-trust-safety-compliance.md)）。
- 归因数据进入**财务/单位经济**（[08](./08-business-model.md)）与**对账**，**不进入排序**。

---

## 6. 数据治理总览

| 主题 | 策略 |
|------|------|
| **同款合并** | 用 GTIN/型号/标题向量 + 属性一致性合并跨平台同款（[06 §2.2](./06-supply-side.md)） |
| **新鲜度** | 内容最终一致；价格/库存近实时；展示前可购买性校验（[05 §6](./05-ai-engine.md)） |
| **质量** | `quality_score` 驱动排序权重与展示（[06 §4](./06-supply-side.md)） |
| **隐私/驻留** | 个人数据按 CN/US 区域隔离驻留，可查/改/删/导出（[09](./09-trust-safety-compliance.md)） |
| **中立** | `commission_rate` 仅结算用，排序屏蔽佣金信号（[09](./09-trust-safety-compliance.md)） |
| **可复用资产** | 本体/知识图谱 schema/评测集为非个人资产，跨区共享（[04 §5](./04-system-architecture.md)） |
| **血缘/版本** | 富化/索引带版本号，支持回归与回滚（[11](./11-metrics.md)） |

> **一句话**：商品侧追求"把全网异构供给变成可推理的统一知识"，用户侧追求"在严格隐私治理下把需求与偏好结构化"，两者在排序处相遇——而佣金永远不在这场相遇里说话。
