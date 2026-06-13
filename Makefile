# Zeno · 开发任务入口
# 用法：make <target>。需先复制 .env.example 为 .env 并填好 DATABASE_URL / ANTHROPIC_API_KEY。

include .env
export

.PHONY: help db-init db-seed db-reset app-install app-dev pipeline-install pipeline-seed eval

help:
	@echo "Zeno targets:"
	@echo "  db-init          建表（pgvector schema）"
	@echo "  db-seed          灌入 US 3C 种子数据（让细线可本地跑通）"
	@echo "  db-reset         db-init + db-seed"
	@echo "  app-install      安装对话应用依赖（app/, Next.js）"
	@echo "  app-dev          启动对话应用（http://localhost:3000）"
	@echo "  pipeline-install 安装富化管道依赖（pipeline/, Python）"
	@echo "  pipeline-seed    用管道生成种子商品的属性/向量（可选，覆盖 SQL 种子）"
	@echo "  eval             跑离线评测（黄金需求集 → 需求满足率/幻觉率）"

db-init:
	psql "$(DATABASE_URL)" -f db/migrations/0001_init.sql

db-seed:
	psql "$(DATABASE_URL)" -f db/seed/0002_seed_3c.sql

db-reset: db-init db-seed

app-install:
	cd app && npm install

app-dev:
	cd app && npm run dev

pipeline-install:
	cd pipeline && python -m venv .venv && . .venv/bin/activate && pip install -e .

pipeline-seed:
	cd pipeline && . .venv/bin/activate && python -m zeno_pipeline.run --source seed

eval:
	cd eval && python run_eval.py
