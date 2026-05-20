alter table private.app_settings
add column if not exists near_safety_threshold_percent integer not null default 10;

update private.app_settings
set near_safety_threshold_percent = coalesce(near_safety_threshold_percent, 10)
where id = true;
