drop table if exists export_queue;
create table export_queue
(
    id                uuid        default uuid_generate_v4(),
    file_path         text,
    user_id           uuid,
    meta_data         jsonb,
    status            int2        default 1,
    created_at        timestamptz default now(),
    modification_date timestamptz default now()
);
drop table if exists import_queue;
create table import_queue
(
    id                uuid        default uuid_generate_v4(),
    file_path         text,
    user_id           uuid,
    errors            jsonb,
    status            int2        default 1,
    created_at        timestamptz default now(),
    modification_date timestamptz default now()

);

