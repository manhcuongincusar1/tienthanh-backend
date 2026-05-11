alter table sales alter column type type varchar(50);

update sales set type = roles.role from users
inner join users_roles on users_roles.user_id = users.id
inner join roles on users_roles.role_id = roles.id
where sales.user_id = users.id;