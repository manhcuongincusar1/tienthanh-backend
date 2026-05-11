Drop table if exists broker_phones;
CREATE TABLE broker_phones
(
    broker_id uuid,
    phone_number character varying COLLATE pg_catalog."default",
    status integer,
    is_main boolean,
    created_at timestamp with time zone DEFAULT now(),
    modification_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    CONSTRAINT broker_phones_pkey PRIMARY KEY (id)
)