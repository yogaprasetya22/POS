-- Migration 42: ringkasan shift ikut membawa nama shift + jam jadwal (untuk pengingat tutup shift di kasir).
do $$
declare def text := pg_get_functiondef('shift_summary(uuid)'::regprocedure);
begin
  if position('''by_method'', by_method);' in def) = 0 then raise exception 'patch shift_summary gagal: pola tidak ditemukan'; end if;
  execute replace(def, '''by_method'', by_method);',
    '''by_method'', by_method, ''shift_name'', sh.shift_name, ''planned_start'', to_char(sh.planned_start, ''HH24:MI''), ''planned_end'', to_char(sh.planned_end, ''HH24:MI''));');
end $$;
