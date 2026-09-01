-- =============================================================================
-- 0012 — IMPORTAR A FICHA DE CAMPO
--
-- Fecha o ciclo do trabalho offline: a ficha gerada no sistema é preenchida no
-- evento sem internet, exportada como texto, e volta por aqui.
--
--
-- POR QUE UMA FUNÇÃO, E NÃO INSERTS PELO APLICATIVO:
--
-- por causa de UMA linha na policy de escrita dos registros:
--
--     with check (public.is_autorizado() and created_by = auth.uid())
--
-- Ela existe para impedir que alguém lance um atendimento no nome de outra
-- pessoa — é o que dá valor à etiqueta "por Fulano". Se a importação fosse um
-- insert comum, os 20 atendimentos que a voluntária coletou entrariam todos no
-- nome de quem importou, e a autoria viraria ficção.
--
-- Esta função abre uma exceção estreita e consciente a essa regra: o
-- ADMINISTRADOR, e só ele, pode gravar em nome de terceiros — mas apenas por
-- este caminho, apenas para contas que já existem, e apenas com o
-- identificador que a própria pessoa escolheu na ficha.
--
-- O custo é real e fica registrado: a partir daqui, "por Fulano" significa
-- "Fulano coletou, ou o administrador afirmou que Fulano coletou". Num sistema
-- com uma responsável e uma equipe pequena de voluntários, é uma troca que vale
-- a pena. Em outro contexto, poderia não valer.
--
--
-- TUDO OU NADA:
-- a função inteira roda numa transação. Se qualquer atendimento for recusado,
-- NADA entra e o erro diz qual foi. Meio importado é o pior estado possível —
-- ninguém saberia o que ficou de fora.
--
-- A exceção são as duplicatas, que são puladas em silêncio: o identificador de
-- cada atendimento nasce no celular, então "este já entrou" é uma constatação
-- segura. É isso que torna reimportar o mesmo arquivo inofensivo.
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
  if not public.is_admin() then
    raise exception 'Apenas o administrador pode importar fichas de campo.';
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

    -- ---------------------------------------------------------------
    -- Já importado? Pula. Esta checagem vem ANTES de tudo: sem ela,
    -- reimportar o arquivo criaria o cadastro novo uma segunda vez.
    -- ---------------------------------------------------------------
    if exists (select 1 from public.registros where id = v_reg_id) then
      v_pulados := v_pulados + 1;
      continue;
    end if;

    -- ---------------------------------------------------------------
    -- Quem coletou. Precisa ser uma conta que existe e está ativa.
    --
    -- A ficha guarda o identificador escolhido numa lista, não um nome
    -- digitado: nome digitado erra por acento, apelido e letra trocada, e
    -- atribuir prontuário à pessoa errada é pior que não atribuir.
    -- ---------------------------------------------------------------
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

    -- ---------------------------------------------------------------
    -- A pessoa atendida: já cadastrada, ou nasce agora.
    -- ---------------------------------------------------------------
    v_idoso_id := nullif(v_item ->> 'idoso_id', '')::uuid;

    if v_idoso_id is null then
      -- Cadastro novo, feito no evento.
      v_idoso := jsonb_populate_record(null::public.idosos, v_item -> 'cadastroNovo');

      if coalesce(btrim(v_idoso.nome), '') = '' then
        raise exception 'Há um cadastro novo sem nome no arquivo (atendimento de %).', v_data;
      end if;

      v_idoso.id := gen_random_uuid();
      -- Telefone é guardado só com dígitos, igual ao formulário do sistema.
      -- Sem isto, "(92) 98888-1111" digitado no campo entraria diferente de
      -- "92988881111" digitado na tela, e a mesma pessoa teria dois formatos.
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

      -- Complemento: só os campos que a pessoa preencheu ou corrigiu.
      -- `coalesce(novo, atual)` garante que campo ausente no arquivo NUNCA
      -- apaga o que já estava no banco.
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

    -- ---------------------------------------------------------------
    -- O atendimento.
    --
    -- jsonb_populate_record casa as chaves do JSON com as colunas da tabela e
    -- ignora o que não existir. Os campos de controle são sobrescritos DEPOIS,
    -- de propósito: assim um arquivo adulterado não consegue definir
    -- `created_by`, `ativo` nem `id` por conta própria.
    -- ---------------------------------------------------------------
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
        -- Os CHECKs do banco são a última linha de defesa, e a mensagem crua
        -- deles é ilegível. Traduzida, ela diz onde procurar no arquivo.
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


-- Mesmo raciocínio das outras funções SECURITY DEFINER: EXECUTE nasce liberado
-- para PUBLIC, o que aqui seria largo demais.
revoke all on function public.importar_atendimentos(jsonb) from public;
grant execute on function public.importar_atendimentos(jsonb) to authenticated;

comment on function public.importar_atendimentos(jsonb) is
  'Importa a exportação da ficha de campo, atribuindo cada atendimento a quem coletou. Só administrador. Tudo ou nada, pulando os já importados.';


-- =============================================================================
-- CONFERIR O QUE ENTROU, depois de importar:
--
--   select r.data_atendimento, i.nome as atendido, u.nome as coletou, r.created_at
--     from public.registros r
--     join public.idosos i on i.id = r.idoso_id
--     left join public.usuarios_autorizados u on u.user_id = r.created_by
--    order by r.created_at desc
--    limit 50;
--
-- `created_at` é o momento da importação; `data_atendimento` é o dia em que o
-- atendimento aconteceu de verdade. É a separação entre os dois que permite
-- lançar dias depois sem falsear a data.
-- =============================================================================
