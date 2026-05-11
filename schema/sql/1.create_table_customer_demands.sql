CREATE TABLE customer_demands
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
	price_to numeric(6,2),
	price_from numeric(6,2),
	districts_id integer,
    province_city_id integer,
	status smallint,
    customer_id uuid,
	type integer,
    uses character varying COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    modification_at timestamp with time zone DEFAULT now(),
    CONSTRAINT customer_demands_pkey PRIMARY KEY (id)
)
