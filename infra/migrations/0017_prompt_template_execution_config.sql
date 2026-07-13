alter table prompt_templates
    add column if not exists execution_config text not null default '';
