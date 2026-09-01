-- =============================================================================
-- 0013 — IMPORTAR FICHA DEIXA DE SER EXCLUSIVO DO ADMINISTRADOR
--
-- MUDANÇA: `is_admin()` vira `is_autorizado()` na função de importação.
--
-- POR QUE ERA RESTRITO:
-- importar grava atendimentos em nome de OUTRA pessoa — é a única exceção à
-- regra `created_by = auth.uid()` que existe no sistema. Concentrar isso no
-- administrador mantinha a exceção com um dono só.
--
-- POR QUE DEIXOU DE SER:
-- na prática, quem organiza o evento é quem importa, e obrigar a promover a
-- responsável a administradora só para isso trocava um risco por outro maior —
-- administrador também exclui atendido e mexe em acessos. Liberar a importação
-- é uma permissão mais estreita do que promover a admin.
--
-- O QUE ISSO CUSTA, escrito para não se perder:
-- qualquer pessoa autorizada passa a poder lançar um atendimento assinado por
-- outra. A etiqueta "por Fulano" continua verdadeira no caso normal, mas deixa
-- de ser à prova de má-fé dentro da equipe. Numa equipe pequena, toda ela
-- aprovada manualmente pela responsável, é uma troca defensável. Num grupo
-- grande ou aberto, não seria.
--
-- O que continua valendo, e é o que impede o pior:
--   * só quem está em usuarios_autorizados com ativo = true importa;
--   * o autor de cada atendimento precisa ser uma conta existente e ativa —
--     não dá para inventar um nome;
--   * duplicatas continuam sendo puladas pelo identificador;
--   * segue tudo ou nada.
--
-- Para reverter: troque is_autorizado() por is_admin() na linha marcada abaixo
-- e rode de novo. Nada mais precisa mudar.
-- =============================================================================

create or replace function public.importar_atendimentos(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     jsonb;
  v_autor    uuid;
  v_idoso_id uuid;
  v_reg_id   uuid;
  v_quem     text;
  v_data     text;

  v_idoso    public.idosos%rowtype;
  v_registro public.registros%rowtype;
  v_compl    jsonb;

  v_importados   integer := 0;
  v_pulados      integer := 0;
  v_cadastros    integer := 0;
  v_complementos integer := 0;
begin
  -- <<< ESTA É A LINHA QUE MUDOU (era public.is_admin()) >>>
  if not public.is_autorizado() then
    raise exception 'Você precisa ter acesso liberado para importar fichas de campo.';
  end if;

  if p_payload ->> 'origem' is distinct from 'ficha-campo' then
    raise exception 'Este texto não parece ser uma exportação de ficha de campo.';
  end if;

  if jsonb_typeof(p_payload -> 'atendimentos') is distinct from 'array' then
    raise exception 'A exportação não contém uma lista de atendimentos.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload -> 'atendimentos')
  loop
    v_quem := coalesce(v_item ->> 'nomeReferencia', 'sem nome');
    v_data := coalesce(v_item -> 'registro' ->> 'data_atendimento', 'sem data');
    v_reg_id := nullif(v_item ->> 'id', '')::uuid;

    if v_reg_id is null then
      raise exception 'Há um atendimento sem identificador no arquivo (%). Arquivo corrompido ou editado à mão.', v_quem;
    end if;

    if exists (select 1 from public.registros where id = v_reg_id) then
      v_pulados := v_pulados + 1;
      continue;
    end if;

    v_autor := nullif(v_item -> 'autor' ->> 'user_id', '')::uuid;

    if v_autor is null then
      raise exception
        'O atendimento de % (%) foi anotado por "%", que ainda não tem acesso ao sistema. Crie o acesso dessa pessoa na aba Acessos e importe o arquivo de novo.',
        v_quem, v_data, coalesce(nullif(v_item -> 'autor' ->> 'nome', ''), 'não informado');
    end if;

    if not exists (
      select 1 from public.usuarios_autorizados
       where user_id = v_autor and ativo = true
    ) then
      raise exception
        'O atendimento de % (%) está atribuído a alguém que não tem acesso ativo. Libere o acesso dessa pessoa e importe de novo.',
        v_quem, v_data;
    end if;

    v_idoso_id := nullif(v_item ->> 'idoso_id', '')::uuid;

    if v_idoso_id is null then
      v_idoso := jsonb_populate_record(null::public.idosos, v_item -> 'cadastroNovo');

      if coalesce(btrim(v_idoso.nome), '') = '' then
        raise exception 'Há um cadastro novo sem nome no arquivo (atendimento de %).', v_data;
      end if;

      v_idoso.id := gen_random_uuid();
      v_idoso.telefone := nullif(regexp_replace(coalesce(v_idoso.telefone, ''), '\D', '', 'g'), '');
      v_idoso.ativo := true;
      v_idoso.created_by := v_autor;
      v_idoso.created_at := now();
      v_idoso.updated_at := now();
      v_idoso.updated_by := null;

      insert into public.idosos select v_idoso.*;
      v_idoso_id := v_idoso.id;
      v_cadastros := v_cadastros + 1;

    else
      if not exists (select 1 from public.idosos where id = v_idoso_id) then
        raise exception
          'O atendimento de % (%) aponta para um cadastro que não existe mais. A ficha pode ter sido gerada antes de esse cadastro ser excluído.',
          v_quem, v_data;
      end if;

      v_compl := v_item -> 'cadastroComplemento';
      if v_compl is not null and jsonb_typeof(v_compl) = 'object' then
        update public.idosos set
          data_nascimento = coalesce(nullif(v_compl ->> 'nascimento','')::date, data_nascimento),
          genero          = coalesce(nullif(v_compl ->> 'genero','')::public.genero_enum, genero),
          telefone        = coalesce(
                              nullif(regexp_replace(coalesce(v_compl ->> 'telefone',''), '\D', '', 'g'), ''),
                              telefone),
          endereco        = coalesce(nullif(v_compl ->> 'endereco',''), endereco)
         where id = v_idoso_id;

        v_complementos := v_complementos + 1;
      end if;
    end if;

    v_registro := jsonb_populate_record(null::public.registros, v_item -> 'registro');

    v_registro.id         := v_reg_id;
    v_registro.idoso_id   := v_idoso_id;
    v_registro.ativo      := true;
    v_registro.created_by := v_autor;
    v_registro.created_at := now();
    v_registro.updated_at := now();
    v_registro.updated_by := null;

    begin
      insert into public.registros select v_registro.*;
    exception
      when check_violation then
        raise exception
          'O atendimento de % (%) tem valor fora do limite aceito. Confira as medições desse atendimento no arquivo.',
          v_quem, v_data;
      when not_null_violation then
        raise exception
          'O atendimento de % (%) está incompleto no arquivo.', v_quem, v_data;
    end;

    v_importados := v_importados + 1;
  end loop;

  return jsonb_build_object(
    'importados', v_importados,
    'pulados', v_pulados,
    'cadastros_novos', v_cadastros,
    'cadastros_completados', v_complementos
  );
end;
$$;

revoke all on function public.importar_atendimentos(jsonb) from public;
grant execute on function public.importar_atendimentos(jsonb) to authenticated;

comment on function public.importar_atendimentos(jsonb) is
  'Importa a exportação da ficha de campo, atribuindo cada atendimento a quem coletou. Qualquer pessoa autorizada. Tudo ou nada, pulando os já importados.';
