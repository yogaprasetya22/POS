do $$
declare def text := pg_get_functiondef('shift_summary(uuid)'::regprocedure);
begin
  execute replace(def, '''by_method'', by_method, ''shift_name'', sh.shift_name, ''planned_start'', to_char(sh.planned_start, ''HH24:MI''), ''planned_end'', to_char(sh.planned_end, ''HH24:MI''));',
    '''by_method'', by_method);');
end $$;
