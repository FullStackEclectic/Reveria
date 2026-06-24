create unique index workflow_templates_task_type_version_idx
    on workflow_templates(task_type, version);

insert into workflow_templates (
    name,
    task_type,
    input_schema,
    output_schema,
    workflow_steps,
    version,
    enabled
)
values
(
    '客户 brief 分析',
    'brief_analysis',
    '{
        "type": "object",
        "required": ["brief"],
        "properties": {
            "brief": { "type": "string" }
        }
    }'::jsonb,
    '{
        "type": "object",
        "required": ["summary", "audience", "directions", "risks"],
        "properties": {
            "summary": { "type": "string" },
            "audience": { "type": "array" },
            "directions": { "type": "array" },
            "risks": { "type": "array" }
        }
    }'::jsonb,
    '[
        { "name": "提炼客户 brief", "type": "text_generation" },
        { "name": "结构化受众、方向和风险", "type": "json_normalize" }
    ]'::jsonb,
    1,
    true
),
(
    '品牌风格提取',
    'brand_style_extract',
    '{
        "type": "object",
        "required": ["brand_materials"],
        "properties": {
            "brand_materials": { "type": "string" }
        }
    }'::jsonb,
    '{
        "type": "object",
        "required": ["colors", "fonts", "visual_keywords", "tone_of_voice", "forbidden_styles", "style_prompt"],
        "properties": {
            "colors": { "type": "array" },
            "fonts": { "type": "array" },
            "visual_keywords": { "type": "array" },
            "tone_of_voice": { "type": "string" },
            "forbidden_styles": { "type": "array" },
            "style_prompt": { "type": "string" }
        }
    }'::jsonb,
    '[
        { "name": "解析品牌材料", "type": "text_generation" },
        { "name": "生成可复用风格提示词", "type": "brand_kit_update" }
    ]'::jsonb,
    1,
    true
),
(
    '三套创意方向',
    'creative_directions',
    '{
        "type": "object",
        "required": ["brief", "target_platforms"],
        "properties": {
            "brief": { "type": "string" },
            "style_prompt": { "type": "string" },
            "target_platforms": { "type": "array" }
        }
    }'::jsonb,
    '{
        "type": "object",
        "required": ["directions"],
        "properties": {
            "directions": { "type": "array" }
        }
    }'::jsonb,
    '[
        { "name": "生成创意方向候选", "type": "text_generation" },
        { "name": "按平台适配标题和视觉提示词", "type": "platform_adapt" }
    ]'::jsonb,
    1,
    true
)
on conflict (task_type, version) do nothing;
