-- Bootstrap script — chạy 1 lần sau khi PG up.
-- Usage:
--   sudo -u postgres psql -v APP_PWD="'<strong-password>'" -f bootstrap.sql

\set ON_ERROR_STOP on

CREATE USER tita_app WITH ENCRYPTED PASSWORD :APP_PWD;

CREATE DATABASE tita_prod OWNER tita_app TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';

GRANT ALL PRIVILEGES ON DATABASE tita_prod TO tita_app;

\c tita_prod

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Confirm
SELECT current_database(), current_user, version();
