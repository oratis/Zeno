"""商品富化（docs/05 §5）：把脏标题/描述抽成可推理的结构化属性 + 适用场景/人群。

事实只抽取、不编造（docs/05 §6）。无 ANTHROPIC_API_KEY 时退化为最小富化（仅 search_text）。
"""

from __future__ import annotations

import json
import os

from .models import Product

ENRICH_VERSION = "2026.06"

_SYSTEM = """你是 Zeno 的商品富化模块。把耳机商品的标题+描述抽成结构化 JSON：
{
 "attributes": {"form_factor": "over_ear|in_ear|open_ear", "noise_canceling": {"type":"active|passive|none","level":0..1}, "battery_hours": int, "weight_g": int, "wireless": bool, "water_resistant": bool},
 "fit_for": {"use_cases": [..], "personas": [..], "not_for": [..]}
}
只依据给定文本抽取，缺失字段省略，绝不编造参数。只输出 JSON。"""


def enrich(product: Product) -> Product:
    raw_desc = product.attributes.get("_raw_description", "")
    text = f"标题：{product.title_canonical}\n描述：{raw_desc}"

    enriched = _llm_enrich(text)
    if enriched:
        product.attributes = enriched.get("attributes", {})
        product.fit_for = enriched.get("fit_for", {})
    else:
        product.attributes = {k: v for k, v in product.attributes.items() if k != "_raw_description"}

    # search_text：标题 + 属性 + 场景，供 pg_trgm 关键词检索
    parts = [product.title_canonical, product.brand or "", " ".join(product.category_path)]
    parts += list(map(str, product.attributes.values()))
    parts += product.fit_for.get("use_cases", []) + product.fit_for.get("personas", [])
    product.search_text = " ".join(p for p in parts if p).lower()
    product.enrichment_version = ENRICH_VERSION
    # TODO(Voyage)：product.embedding = embed(product.search_text)
    return product


def _llm_enrich(text: str) -> dict | None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic

        client = anthropic.Anthropic()
        model = os.environ.get("ZENO_MODEL_FAST", "claude-haiku-4-5-20251001")
        msg = client.messages.create(
            model=model,
            max_tokens=600,
            temperature=0,
            system=_SYSTEM,
            messages=[{"role": "user", "content": text + "\n\n只输出 JSON。"}],
        )
        out = "".join(b.text for b in msg.content if b.type == "text")
        start, end = out.find("{"), out.rfind("}")
        return json.loads(out[start : end + 1]) if start >= 0 else None
    except Exception as e:  # noqa: BLE001
        print(f"[enrich] LLM 富化失败，退化为最小富化：{e}")
        return None
