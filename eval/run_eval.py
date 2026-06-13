#!/usr/bin/env python3
"""离线评测（docs/05 §7, docs/11）：黄金需求集 → 需求满足率 / 硬约束违反率。

打到本地运行的对话应用（默认 http://localhost:3000/api/chat），解析候选并打分。
前置：make db-reset（灌种子）+ make app-dev（应用在跑）。
用法：python run_eval.py  [--base http://localhost:3000]
仅用标准库，无需安装依赖。
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path


def call(base: str, text: str) -> dict | None:
    body = json.dumps({"text": text}).encode()
    req = urllib.request.Request(
        f"{base}/api/chat", data=body, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode()
    cands = None
    for block in raw.split("\n\n"):
        line = block.strip()
        if not line.startswith("data:"):
            continue
        ev = json.loads(line[5:].strip())
        if ev.get("kind") == "candidates":
            cands = ev
    return cands


def form_factor(item: dict) -> str | None:
    return (item.get("product", {}).get("attributes", {}) or {}).get("form_factor")


def final_price(item: dict) -> float | None:
    return (item.get("product", {}).get("offer", {}) or {}).get("final_price")


def is_anc(item: dict) -> bool:
    nc = (item.get("product", {}).get("attributes", {}) or {}).get("noise_canceling", {})
    return isinstance(nc, dict) and nc.get("type") == "active"


def score_case(case: dict, ev: dict | None) -> dict:
    items = (ev or {}).get("items", [])
    violations: list[str] = []
    if not items:
        return {"id": case["id"], "n": 0, "fit": False, "violations": ["no_candidates"]}

    pmax = case.get("price_max")
    forbid = set(case.get("forbid_form_factor", []))
    for it in items:
        fp = final_price(it)
        if pmax is not None and fp is not None and fp > pmax:
            violations.append(f"price {fp} > {pmax}")
        if forbid and form_factor(it) in forbid:
            violations.append(f"form_factor {form_factor(it)} in forbidden")

    # 需求满足：顶部候选是否满足关键期望
    top = items[0]
    fit = True
    if "require_form_factor" in case:
        fit = form_factor(top) in set(case["require_form_factor"])
    if case.get("require_anc"):
        fit = fit and any(is_anc(it) for it in items)
    if pmax is not None:
        fit = fit and (final_price(top) is None or final_price(top) <= pmax)

    return {"id": case["id"], "n": len(items), "fit": fit, "violations": violations}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    args = ap.parse_args()

    cases = [json.loads(l) for l in Path(__file__).with_name("golden_needs.jsonl").read_text().splitlines() if l.strip()]
    results = []
    for c in cases:
        try:
            ev = call(args.base, c["query"])
        except Exception as e:  # noqa: BLE001
            print(f"  ! {c['id']} 调用失败：{e}（应用是否在跑？）")
            ev = None
        r = score_case(c, ev)
        results.append(r)
        mark = "✓" if r["fit"] and not r["violations"] else "✗"
        print(f"  {mark} {r['id']:<22} n={r['n']} fit={r['fit']} violations={r['violations']}")

    n = len(results)
    fit_rate = sum(1 for r in results if r["fit"]) / n if n else 0
    viol_rate = sum(1 for r in results if r["violations"]) / n if n else 0
    print("\n── 汇总 ──")
    print(f"  需求满足率（顶部候选满足期望）：{fit_rate:.0%}")
    print(f"  硬约束违反率（价格/形态越界）：{viol_rate:.0%}  ← 目标 0%（docs/11 反指标）")


if __name__ == "__main__":
    main()
