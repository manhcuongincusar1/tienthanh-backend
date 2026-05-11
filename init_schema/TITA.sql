CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "full_name" character varying,
  "address" character varying,
  "username" character varying,
  "password" character varying,
  "salk" character varying,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "roles" (
  "id" SERIAL PRIMARY KEY,
  "title" character varying,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "users_roles" (
  "user_id" int,
  "role_id" int
);

CREATE TABLE "permissions" (
  "id" SERIAL PRIMARY KEY,
  "role_id" int,
  "component" character varying,
  "action" character varying,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "sales" (
  "id" SERIAL PRIMARY KEY,
  "user_id" int,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "customers" (
  "id" SERIAL PRIMARY KEY,
  "full_name" character varying,
  "address" character varying,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "sales_customers" (
  "sale_id" int,
  "customer_id" int
);

CREATE TABLE "customer_phones" (
  "customer_id" int,
  "phone" character varying
);

CREATE TABLE "branches" (
  "id" SERIAL PRIMARY KEY,
  "title" character varying,
  "address" text,
  "tax" character varying,
  "ward_id" int,
  "district_id" int,
  "province_city_id" int,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "sale_branch" (
  "sale_id" int,
  "branch_id" int
);


CREATE TABLE "real_estate_status" (
  "id" SERIAL PRIMARY KEY,
  "code" character varying UNIQUE,
  "title" character varying,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "real_estate_category" (
  "id" SERIAL PRIMARY KEY,
  "code" character varying UNIQUE,
  "title" character varying,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "real_estate_category_attribute" (
  "real_estate_category_id" int,
  "attribute_id" int
);

CREATE TABLE "real_estate_attribute" (
  "id" SERIAL PRIMARY KEY,
  "title" character varying,
  "type" character varying,
  "default_value" jsonb,
  "is_system" boolean,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "real_estate_attribute_set" (
  "id" SERIAL PRIMARY KEY,
  "title" character varying,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "re_set_re" (
  "attribute_set_id" int,
  "attribute_id" int
);

CREATE TABLE "real_estate" (
  "id" SERIAL PRIMARY KEY,
  "category_id" int,
  "title" character varying,
  "creator_sale_id" int,
  "sale_id" int,
  "ward_id" int,
  "districts_id" int,
  "province_city_id" int,
  "street_id" int,
  "real_estate_status_id" int,
  "created_at" timestamptz default now(),
  "modification_at" timestamptz default now(),
  "status" int2
);

CREATE TABLE "real_estate_form" (
  "id" SERIAL PRIMARY KEY,
  "real_estate_id" int
);

CREATE TABLE "real_estate_form_attribute" (
  "real_estate_form_id" int,
  "attribute_id" int
);

CREATE TABLE "real_estate_form_submission" (
  "real_estate_form_id" int,
  "value" jsonb
);

CREATE TABLE "real_estate_branch" (
  "branch_id" int,
  "real_estate_id" int
);

CREATE TABLE "sale_district" (
  "sale_id" int,
  "districts_id" int
);

CREATE TABLE "streets"
(
    "id"              SERIAL PRIMARY KEY,
    "ward_id"         int,
    "title"           varchar,
    "alias"           varchar,
    "created_at"      timestamp default now(),
    "modification_at" timestamp default now(),
    "status"          int2
);

CREATE TABLE "streets_translation"
(
    "id"              SERIAL PRIMARY KEY,
    "street_id"       int,
    "language_code"   varchar,
    "title"           varchar,
    "created_at"      timestamp default now(),
    "modification_at" timestamp default now(),
    "status"          int2
);

CREATE TABLE "wards"
(
    "id"              SERIAL PRIMARY KEY,
    "code"            varchar not null,
    "district_id"     int,
    "alias"           varchar,
    "title"           varchar,
    "created_at"      timestamp default now(),
    "modification_at" timestamp default now(),
    "status"          int2
);

CREATE TABLE "wards_translation"
(
    "id"              SERIAL PRIMARY KEY,
    "ward_id"         int,
    "language_code"   varchar,
    "title"           varchar,
    "created_at"      timestamp default now(),
    "modification_at" timestamp default now(),
    "status"          int2
);

CREATE TABLE "districts"
(
    "id"               SERIAL PRIMARY KEY,
    "code"             varchar not null,
    "province_city_id" int,
    "title"            varchar,
    "alias"            varchar,
    "created_at"       timestamp default now(),
    "modification_at"  timestamp default now(),
    "status"           int2
);

CREATE TABLE "districts_translation"
(
    "id"              SERIAL PRIMARY KEY,
    "district_id"     int,
    "language_code"   varchar,
    "title"           varchar,
    "created_at"      timestamp default now(),
    "modification_at" timestamp default now(),
    "status"          int2
);

CREATE TABLE "province_city"
(
    "id"              SERIAL PRIMARY KEY,
    "code"            varchar not null,
    "title"           varchar,
    "alias"           varchar,
    "created_at"      timestamp default now(),
    "modification_at" timestamp default now(),
    "status"          int2
);

CREATE TABLE "province_city_translation"
(
    "id"               SERIAL PRIMARY KEY,
    "province_city_id" int,
    "title"            varchar,
    "language_code"    varchar,
    "created_at"       timestamp default now(),
    "modification_at"  timestamp default now(),
    "status"           int2
);
