insert into pricing_rules (
    name,
    task_type,
    unit,
    min_credits,
    enabled
)
values (
    '图片生成基础价',
    'image_generation',
    'image',
    80,
    true
);

insert into workflow_templates (
    name,
    task_type,
    input_schema,
    output_schema,
    workflow_steps,
    version,
    enabled
)
values (
    '图片生成',
    'image_generation',
    '{
        "type": "object",
        "required": ["prompt"],
        "properties": {
            "prompt": { "type": "string" },
            "size": { "type": "string" }
        }
    }'::jsonb,
    '{
        "type": "object",
        "properties": {
            "image_url": { "type": "string" },
            "b64_json": { "type": "string" },
            "revised_prompt": { "type": "string" }
        }
    }'::jsonb,
    '[
        { "name": "调用图片生成模型", "type": "image_generation" },
        { "name": "保存为项目资产", "type": "asset_create" }
    ]'::jsonb,
    1,
    true
)
on conflict (task_type, version) do nothing;
