drop table if exists real_estate_historical;
create table real_estate_historical
(
    id         uuid        default uuid_generate_v4(),
    meta_data  jsonb,
    creator_id uuid,
    created_at timestamptz default now()
)