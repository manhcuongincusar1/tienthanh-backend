alter table import_queue
    add info varchar(255),
    add file_name varchar(255),
    add type            integer not null default 1,
    add error_file_path text
;
alter table export_queue
    add file_name varchar(255),
    add type integer not null default 1
;
