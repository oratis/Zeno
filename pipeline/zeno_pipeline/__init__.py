"""Zeno 供给富化管道。

流程（docs/06 §2.2）：
    ingest（联盟接入）→ normalize（标准化为统一商品模型）
    → enrich（LLM 抽属性/场景/向量）→ dedup（同款合并）→ load（入库）

MVP：dedup 暂为占位；embedding 接 Voyage 后启用。富化对齐 docs/05 §5。
"""

__all__ = ["models", "ingest", "enrich", "db", "run"]
