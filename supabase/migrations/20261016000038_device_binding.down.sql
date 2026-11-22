-- Rollback Migration 38
drop function if exists device_check_pin(text, uuid, text);
drop function if exists device_staff(text);
drop function if exists staff_pin_status();
drop function if exists set_staff_pin(uuid, text);
drop function if exists unbind_device(uuid);
drop function if exists bind_device(text);
drop function if exists device_hash(text);
drop table if exists devices;
