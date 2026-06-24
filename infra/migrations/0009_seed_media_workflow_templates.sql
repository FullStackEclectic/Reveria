insert into pricing_rules (
    name,
    task_type,
    unit,
    min_credits,
    enabled
)
select *
from (
    values
    (
        '小红书封面批量生成基础价',
        'xiaohongshu_cover_batch',
        'batch',
        120,
        true
    ),
    (
        '短视频脚本分镜基础价',
        'short_video_script_storyboard',
        'task',
        80,
        true
    )
) as seed(name, task_type, unit, min_credits, enabled)
where not exists (
    select 1
    from pricing_rules
    where pricing_rules.task_type = seed.task_type
      and pricing_rules.enabled = true
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
values
(
    '小红书封面批量生成',
    'xiaohongshu_cover_batch',
    '{
        "type": "object",
        "required": ["brief"],
        "properties": {
            "brief": { "type": "string" },
            "style_prompt": { "type": "string" },
            "count": { "type": "integer" }
        }
    }'::jsonb,
    '{
        "type": "object",
        "required": ["covers"],
        "properties": {
            "covers": { "type": "array" }
        }
    }'::jsonb,
    '[
        { "name": "提炼封面卖点", "type": "text_generation" },
        { "name": "批量生成标题、版式和图片提示词", "type": "cover_prompt_batch" },
        { "name": "保存为项目交付资产", "type": "asset_create" }
    ]'::jsonb,
    1,
    true
),
(
    '短视频脚本和分镜',
    'short_video_script_storyboard',
    '{
        "type": "object",
        "required": ["brief", "target_platforms"],
        "properties": {
            "brief": { "type": "string" },
            "style_prompt": { "type": "string" },
            "target_platforms": { "type": "array" },
            "duration_seconds": { "type": "integer" }
        }
    }'::jsonb,
    '{
        "type": "object",
        "required": ["hook", "script", "shots", "production_notes"],
        "properties": {
            "hook": { "type": "string" },
            "script": { "type": "string" },
            "shots": { "type": "array" },
            "production_notes": { "type": "array" }
        }
    }'::jsonb,
    '[
        { "name": "生成短视频脚本", "type": "text_generation" },
        { "name": "拆分镜头和画面提示词", "type": "storyboard" },
        { "name": "保存为项目交付资产", "type": "asset_create" }
    ]'::jsonb,
    1,
    true
)
on conflict (task_type, version) do nothing;
