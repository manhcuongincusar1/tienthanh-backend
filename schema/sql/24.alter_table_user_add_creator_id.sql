alter table users add creator_id uuid default null;
update roles SET role = 'super_admin' where role='supper_admin';
update roles SET title = 'Super Admin' where title='Supper Admin';