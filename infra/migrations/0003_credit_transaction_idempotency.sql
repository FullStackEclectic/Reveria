create unique index credit_transactions_task_type_once_idx
on credit_transactions(task_id, transaction_type)
where task_id is not null;
