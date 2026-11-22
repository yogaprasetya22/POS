-- Rollback Migration 39
drop function if exists set_landing_theme(text);
drop table if exists platform_settings;
