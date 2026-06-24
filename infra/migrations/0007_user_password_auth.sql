alter table users
add column password_hash text;

create index users_email_status_idx on users(email, status);
