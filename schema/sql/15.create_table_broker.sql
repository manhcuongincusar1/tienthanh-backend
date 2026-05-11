Drop table if exists brokers;
CREATE TABLE brokers
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    full_name character varying COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    modification_at timestamp with time zone DEFAULT now(),
    status smallint,
    creator_id uuid,
    branch_id uuid,
    CONSTRAINT brokers_pkey PRIMARY KEY (id)
)