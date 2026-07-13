alter table generation_tasks
    add column if not exists conversation_id varchar(120);

create index if not exists generation_tasks_project_conversation_idx
    on generation_tasks(project_id, conversation_id, created_at);
