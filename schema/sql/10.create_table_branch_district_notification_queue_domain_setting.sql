create table branch_district
(
    branch_id   uuid,
    province_id integer,
    district_id integer
);

DROP TABLE IF EXISTS notification_queue;
create table notification_queue
(
    id              uuid        default uuid_generate_v4(),
    real_estate_id  uuid,
    status          smallint,
    infoData        jsonb,
    created_at      timestamptz default now(),
    modification_at timestamptz default now()
);

create table domain_setting
(
    domain_title varchar(250),
    branches     jsonb
)