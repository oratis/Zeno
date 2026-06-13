-- Zeno · 种子数据（US 3C / 头戴 + 入耳耳机）
-- 目的：让端到端细线在没有 Amazon PA-API 接入时也能本地跑通 demo。
-- 数据为「示意性」样本（属性结构真实、具体型号/价格仅作演示），非真实抓取。
-- 运行：psql "$DATABASE_URL" -f db/seed/0002_seed_3c.sql

-- 幂等：先清空种子（仅 demo 用）
TRUNCATE products, offers RESTART IDENTITY CASCADE;

WITH p AS (
  INSERT INTO products (title_canonical, brand, model, category_path, attributes, fit_for, review_summary, quality_score, search_text)
  VALUES
  (
    'AuraSound A5 Over-Ear ANC Headphones', 'AuraSound', 'A5',
    ARRAY['electronics','audio','over_ear_headphones'],
    '{"form_factor":"over_ear","noise_canceling":{"type":"active","level":0.85},"battery_hours":40,"weight_g":254,"wireless":true,"water_resistant":false}',
    '{"use_cases":["commute","office","travel"],"personas":["long_wear_comfort_seeker"],"not_for":["intense_sport"]}',
    '{"pros":[{"point":"comfortable for long wear","support":0.78,"n":1240}],"cons":[{"point":"slightly heavy","support":0.31,"n":1240}],"rating":4.6,"rating_count":1240,"sources":["amazon"]}',
    0.86, 'AuraSound A5 over ear active noise canceling headphones commute travel 40h comfortable'
  ),
  (
    'AuraSound Air Open-Ear Air-Conduction', 'AuraSound', 'Air',
    ARRAY['electronics','audio','open_ear'],
    '{"form_factor":"open_ear","noise_canceling":{"type":"none","level":0.0},"battery_hours":10,"weight_g":33,"wireless":true,"water_resistant":true}',
    '{"use_cases":["running","outdoor","awareness"],"personas":["ear_fatigue_avoider","athlete"],"not_for":["noisy_subway"]}',
    '{"pros":[{"point":"never blocks the ear","support":0.82,"n":640}],"cons":[{"point":"weak isolation","support":0.55,"n":640}],"rating":4.3,"rating_count":640,"sources":["amazon"]}',
    0.74, 'AuraSound Air open ear air conduction running outdoor sweatproof not in-ear no ear pain'
  ),
  (
    'NovaAudio Flagship Q ANC Over-Ear', 'NovaAudio', 'Q',
    ARRAY['electronics','audio','over_ear_headphones'],
    '{"form_factor":"over_ear","noise_canceling":{"type":"active","level":0.95},"battery_hours":30,"weight_g":268,"wireless":true,"water_resistant":false}',
    '{"use_cases":["commute","flight","focus"],"personas":["noise_canceling_maximalist"],"not_for":["budget"]}',
    '{"pros":[{"point":"best-in-class ANC","support":0.88,"n":2100}],"cons":[{"point":"clamps a bit","support":0.34,"n":2100}],"rating":4.7,"rating_count":2100,"sources":["amazon"]}',
    0.90, 'NovaAudio Q flagship active noise canceling over ear commute flight strong ANC'
  ),
  (
    'NovaAudio Buds Pro In-Ear ANC', 'NovaAudio', 'BudsPro',
    ARRAY['electronics','audio','in_ear'],
    '{"form_factor":"in_ear","noise_canceling":{"type":"active","level":0.8},"battery_hours":8,"weight_g":5,"wireless":true,"water_resistant":true}',
    '{"use_cases":["commute","gym","calls"],"personas":["portability_seeker"],"not_for":["ear_fatigue_avoider"]}',
    '{"pros":[{"point":"tiny and portable","support":0.8,"n":1500}],"cons":[{"point":"can fatigue ears over hours","support":0.42,"n":1500}],"rating":4.4,"rating_count":1500,"sources":["amazon"]}',
    0.81, 'NovaAudio Buds Pro in ear active noise canceling portable gym calls'
  ),
  (
    'EchoWave H2 Budget Over-Ear', 'EchoWave', 'H2',
    ARRAY['electronics','audio','over_ear_headphones'],
    '{"form_factor":"over_ear","noise_canceling":{"type":"passive","level":0.4},"battery_hours":50,"weight_g":240,"wireless":true,"water_resistant":false}',
    '{"use_cases":["home","study","casual"],"personas":["value_seeker","long_wear_comfort_seeker"],"not_for":["noisy_commute"]}',
    '{"pros":[{"point":"great value and battery","support":0.7,"n":900}],"cons":[{"point":"only passive isolation","support":0.6,"n":900}],"rating":4.2,"rating_count":900,"sources":["amazon"]}',
    0.7, 'EchoWave H2 budget over ear long battery 50h value home study not in-ear'
  ),
  (
    'EchoWave Bone-Conduction Sport', 'EchoWave', 'Bone',
    ARRAY['electronics','audio','open_ear'],
    '{"form_factor":"open_ear","noise_canceling":{"type":"none","level":0.0},"battery_hours":9,"weight_g":29,"wireless":true,"water_resistant":true}',
    '{"use_cases":["running","cycling","outdoor"],"personas":["ear_fatigue_avoider","athlete"],"not_for":["audiophile"]}',
    '{"pros":[{"point":"no ear discomfort, situational awareness","support":0.84,"n":520}],"cons":[{"point":"bass is light","support":0.5,"n":520}],"rating":4.1,"rating_count":520,"sources":["amazon"]}',
    0.69, 'EchoWave bone conduction sport open ear running cycling sweatproof not in-ear no ear pain'
  )
  RETURNING product_id, model
)
INSERT INTO offers (product_id, market, source, merchant, price_list, price_current, currency, deals, final_price, in_stock, shipping, buy_url_template, attribution_scheme, commission_rate, verified_buyable_at)
SELECT p.product_id, 'US', 'amazon_associates',
       '{"id":"amzn","name":"Amazon","trust_score":0.95}',
       v.price_list, v.price_current, 'USD', v.deals::jsonb, v.final_price, true,
       '{"eta_days":2,"fee":0}',
       'https://www.amazon.com/dp/' || v.asin || '?tag={AFFILIATE_TAG}',
       'amazon_tag', v.commission, now()
FROM p
JOIN (VALUES
  ('A5',      149.00, 129.00, '[{"type":"coupon","value":10,"stackable":true}]', 119.00, 'B0AURA5XXX', 0.04),
  ('Air',      99.00,  89.00, '[]',                                               89.00, 'B0AURAIRXX', 0.04),
  ('Q',       199.00, 179.00, '[]',                                              179.00, 'B0NOVAQXXX', 0.03),
  ('BudsPro',  99.00,  79.00, '[{"type":"coupon","value":10,"stackable":true}]',  69.00, 'B0NOVABPXX', 0.04),
  ('H2',       59.00,  45.00, '[]',                                               45.00, 'B0ECHOH2XX', 0.04),
  ('Bone',     69.00,  59.00, '[]',                                               59.00, 'B0ECHOBONE', 0.04)
) AS v(model, price_list, price_current, deals, final_price, asin, commission)
  ON v.model = p.model;
