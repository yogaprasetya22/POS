-- Stok bahan & resep terintegrasi dengan menu.
-- products.portions = sisa porsi dari stok bahan (min tiap bahan: stok / takaran resep).
-- NULL = menu tanpa resep (tidak dilacak, dianggap selalu tersedia). is_available tetap override manual.
alter table products add column portions int;

create function refresh_portions(p_product uuid) returns void
language sql volatile security definer set search_path = public as $$
  update products set portions = (
    select floor(min(greatest(i.stock, 0) / r.qty))::int
    from recipes r join ingredients i on i.id = r.ingredient_id
    where r.product_id = products.id)
  where id = p_product
$$;
revoke execute on function refresh_portions(uuid) from public, anon, authenticated;

create function trg_recipes_portions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform refresh_portions(old.product_id); end if;
  if tg_op <> 'DELETE' then perform refresh_portions(new.product_id); end if;
  return null;
end $$;
create trigger recipes_portions after insert or update or delete on recipes
  for each row execute function trg_recipes_portions();

create function trg_ingredients_portions() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  for pid in select product_id from recipes where ingredient_id = new.id loop
    perform refresh_portions(pid);
  end loop;
  return null;
end $$;
create trigger ingredients_portions after update of stock on ingredients
  for each row when (old.stock is distinct from new.stock) execute function trg_ingredients_portions();

-- isi awal untuk resep yang sudah ada
select refresh_portions(product_id) from (select distinct product_id from recipes) x;

-- Satu-satunya tempat harga dihitung: kini juga menolak menu yang bahannya habis / tidak cukup.
create or replace function price_lines(p_store uuid, p_lines jsonb, out items jsonb, out total int)
language plpgsql stable security definer set search_path = public as $$
declare
  l jsonb; c jsonb; g jsonb; opt jsonb; choices jsonb;
  p products; qty int; unit int; n int;
begin
  items := '[]'; total := 0;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 50 then
    raise exception 'invalid lines';
  end if;
  for l in select value from jsonb_array_elements(p_lines) loop
    select * into p from products where id = (l->>'product_id')::uuid and store_id = p_store;
    if not found or not p.is_available or p.portions = 0 then
      raise exception 'Menu tidak tersedia: %', coalesce(p.name, l->>'product_id');
    end if;
    qty := (l->>'qty')::int;
    if qty is null or qty not between 1 and 99 then raise exception 'invalid qty'; end if;
    if p.portions is not null and qty > p.portions then
      raise exception 'Stok bahan % tinggal % porsi', p.name, p.portions;
    end if;

    unit := p.price; choices := '[]';
    for c in select value from jsonb_array_elements(coalesce(l->'choices', '[]')) loop
      select o.value into opt
        from jsonb_array_elements(p.modifiers) grp, jsonb_array_elements(grp.value->'options') o
        where grp.value->>'name' = c->>'group' and o.value->>'name' = c->>'option';
      if opt is null then raise exception 'invalid modifier: %', c; end if;
      unit := unit + (opt->>'price')::int;
      choices := choices || jsonb_build_object('group', c->>'group', 'option', c->>'option', 'price', (opt->>'price')::int);
    end loop;

    for g in select value from jsonb_array_elements(p.modifiers) loop
      select count(*) into n from jsonb_array_elements(choices) x where x->>'group' = g->>'name';
      if (coalesce((g->>'required')::boolean, false) and n = 0)
         or (not coalesce((g->>'multiple')::boolean, false) and n > 1) then
        raise exception 'Pilihan "%" tidak valid untuk %', g->>'name', p.name;
      end if;
    end loop;

    items := items || jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'qty', qty, 'unit_price', unit,
      'choices', choices, 'note', left(coalesce(l->>'note', ''), 200), 'subtotal', unit * qty);
    total := total + unit * qty;
  end loop;
end $$;
