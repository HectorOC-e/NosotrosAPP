-- Creator-only writer: stores/updates the API key in Vault and upserts ai_settings.
create or replace function public.set_ai_config(p_provider text, p_model text, p_key text)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_role text;
  v_secret_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  select couple_id, partner_role into v_couple, v_role
  from public.profiles where id = v_uid;

  if v_couple is null then
    raise exception 'Sin pareja' using errcode = 'P0001';
  end if;
  if v_role is distinct from 'creador' then
    raise exception 'Solo el creador puede configurar la IA' using errcode = '42501';
  end if;

  select api_key_secret_id into v_secret_id
  from public.ai_settings where couple_id = v_couple;

  if p_key is not null and btrim(p_key) <> '' then
    if v_secret_id is null then
      v_secret_id := vault.create_secret(
        btrim(p_key),
        'ai_key_' || v_couple::text,
        'OpenRouter key for couple ' || v_couple::text
      );
    else
      perform vault.update_secret(v_secret_id, btrim(p_key));
    end if;
  end if;

  insert into public.ai_settings (couple_id, provider, model, api_key_secret_id, updated_by, updated_at)
  values (
    v_couple,
    coalesce(nullif(btrim(p_provider), ''), 'openrouter'),
    nullif(btrim(p_model), ''),
    v_secret_id,
    v_uid,
    now()
  )
  on conflict (couple_id) do update
    set provider = excluded.provider,
        model = excluded.model,
        api_key_secret_id = coalesce(excluded.api_key_secret_id, public.ai_settings.api_key_secret_id),
        updated_by = excluded.updated_by,
        updated_at = now();
end;
$$;

revoke all on function public.set_ai_config(text, text, text) from public, anon;
grant execute on function public.set_ai_config(text, text, text) to authenticated;

-- Service-role-only reader: returns provider/model + decrypted key. Never grant to authenticated.
create or replace function public.get_couple_ai_key(p_couple_id uuid)
returns table(provider text, model text, api_key text)
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  return query
  select s.provider, s.model, ds.decrypted_secret
  from public.ai_settings s
  left join vault.decrypted_secrets ds on ds.id = s.api_key_secret_id
  where s.couple_id = p_couple_id;
end;
$$;

revoke all on function public.get_couple_ai_key(uuid) from public, anon, authenticated;
grant execute on function public.get_couple_ai_key(uuid) to service_role;
