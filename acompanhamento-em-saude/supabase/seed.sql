-- =============================================================================
-- SEED — DADOS FICTÍCIOS PARA DESENVOLVIMENTO
--
-- ⚠️  NUNCA RODAR NO PROJETO DE PRODUÇÃO.
--
-- Todos os nomes, endereços e telefones abaixo são inventados. Nenhuma pessoa
-- real. Os valores clínicos são plausíveis mas fictícios, escolhidos para
-- exercitar as telas (inclusive alguns que disparam AVISO, não bloqueio).
--
-- Pré-requisito: já existir pelo menos uma conta criada no painel
-- (Authentication > Users) e o e-mail dela em usuarios_autorizados.
-- =============================================================================

do $$
declare
  v_user_id  uuid;
  v_idoso_1  uuid;
  v_idoso_2  uuid;
  v_idoso_3  uuid;
  v_evento_1 uuid;
  v_evento_2 uuid;
begin
  -- Pega a primeira conta existente para servir de autor dos dados fictícios.
  -- auth.uid() é NULL aqui porque o seed roda como service_role, sem sessão.
  select id into v_user_id from auth.users order by created_at limit 1;

  if v_user_id is null then
    raise exception
      'Nenhuma conta encontrada em auth.users. Crie uma conta no painel do Supabase (Authentication > Users) antes de rodar o seed.';
  end if;

  -- ---------------------------------------------------------------------------
  -- Idosos fictícios
  -- ---------------------------------------------------------------------------
  insert into public.idosos (nome, data_nascimento, genero, telefone, endereco, created_by)
  values ('Maria Aparecida da Silva', '1948-03-12', 'Feminino', '92988881111',
          'Rua das Flores, 123 - Centro', v_user_id)
  returning id into v_idoso_1;

  insert into public.idosos (nome, data_nascimento, genero, telefone, endereco, created_by)
  values ('João Batista Ferreira', '1952-11-04', 'Masculino', '92988882222',
          'Av. Amazonas, 456 - Adrianópolis', v_user_id)
  returning id into v_idoso_2;

  insert into public.idosos (nome, data_nascimento, genero, telefone, endereco, created_by)
  values ('Terezinha Gomes de Souza', '1945-07-21', 'Feminino', '92988883333',
          'Travessa São Jorge, 78 - Cachoeirinha', v_user_id)
  returning id into v_idoso_3;

  -- ---------------------------------------------------------------------------
  -- Maria: 3 atendimentos. Serve para testar o pré-preenchimento e a evolução
  -- do quadro — no 2º atendimento aparece hipertensão que não existia no 1º.
  -- É exatamente o caso que a ficha de papel não conseguia registrar.
  -- ---------------------------------------------------------------------------
  insert into public.registros (
    idoso_id, data_atendimento,
    cond_diabetes, cond_hipertensao,
    hf_diabetes, hf_diabetes_quem,
    usa_medicamentos, medicamentos_quais,
    fumante, fumante_passivo,
    pressao_sistolica, pressao_diastolica, frequencia_cardiaca,
    temperatura, saturacao, glicemia, glicemia_jejum,
    descricao, created_by
  ) values (
    v_idoso_1, current_date - 90,
    true, false,
    true, 'mãe',
    true, 'Metformina 850mg',
    false, false,
    128, 82, 76,
    36.4, 97, 110, 'Sim',
    'Primeiro atendimento. Relatou boa adesão ao medicamento.', v_user_id
  );

  insert into public.registros (
    idoso_id, data_atendimento,
    cond_diabetes, cond_hipertensao,
    hf_diabetes, hf_diabetes_quem,
    usa_medicamentos, medicamentos_quais,
    fumante, fumante_passivo,
    pressao_sistolica, pressao_diastolica, frequencia_cardiaca,
    temperatura, saturacao, glicemia, glicemia_jejum,
    descricao, created_by
  ) values (
    v_idoso_1, current_date - 45,
    true, true,
    true, 'mãe',
    true, 'Metformina 850mg, Losartana 50mg',
    false, false,
    142, 88, 80,
    36.6, 96, 132, 'Nao',
    'Iniciou Losartana. Orientada sobre horário das medicações.', v_user_id
  );

  insert into public.registros (
    idoso_id, data_atendimento,
    cond_diabetes, cond_hipertensao,
    hf_diabetes, hf_diabetes_quem,
    usa_medicamentos, medicamentos_quais,
    fumante, fumante_passivo,
    pressao_sistolica, pressao_diastolica, frequencia_cardiaca,
    temperatura, saturacao, glicemia, glicemia_jejum,
    descricao, created_by
  ) values (
    v_idoso_1, current_date - 7,
    true, true,
    true, 'mãe',
    true, 'Metformina 850mg, Losartana 50mg',
    false, false,
    134, 84, 74,
    36.5, 98, 118, 'Sim',
    'Retorno de rotina. Sem queixas.', v_user_id
  );

  -- ---------------------------------------------------------------------------
  -- João: 1 atendimento, com campos deliberadamente NÃO respondidos
  -- (usa_medicamentos e fumante_passivo NULL) para testar a diferença entre
  -- "respondeu Não" e "não foi perguntado" — decisão da Q5.
  -- ---------------------------------------------------------------------------
  insert into public.registros (
    idoso_id, data_atendimento,
    cond_hipertensao, cond_dislipidemia,
    hf_hipertensao, hf_hipertensao_quem,
    hf_outros, hf_outros_desc, hf_outros_quem,
    usa_medicamentos,
    fumante, fumante_passivo,
    pressao_sistolica, pressao_diastolica, frequencia_cardiaca,
    temperatura, saturacao,
    descricao, created_by
  ) values (
    v_idoso_2, current_date - 20,
    true, true,
    true, 'pai',
    true, 'AVC', 'avô paterno',
    null,
    true, null,
    138, 86, 82,
    36.8, 95,
    'Primeira avaliação. Glicemia não aferida nesta visita.', v_user_id
  );

  -- ---------------------------------------------------------------------------
  -- Terezinha: 1 atendimento com valor dentro do limite duro porém em faixa de
  -- AVISO (FC 38 bpm, abaixo dos 40 da faixa de aviso). Serve para conferir que
  -- o sistema pede confirmação sem impedir o salvamento — e sem emitir
  -- qualquer juízo clínico sobre o valor.
  -- ---------------------------------------------------------------------------
  insert into public.registros (
    idoso_id, data_atendimento,
    cond_asma,
    cond_outros, cond_outros_desc,
    usa_medicamentos, medicamentos_quais,
    fumante, fumante_passivo,
    pressao_sistolica, pressao_diastolica, frequencia_cardiaca,
    temperatura, saturacao, glicemia, glicemia_jejum,
    descricao, created_by
  ) values (
    v_idoso_3, current_date - 3,
    true,
    true, 'Artrose de joelho',
    true, 'Salbutamol spray, Dipirona se dor',
    false, true,
    126, 78, 38,
    36.2, 97, 95, 'NaoSei',
    'Valor de frequência cardíaca conferido e confirmado pela responsável.', v_user_id
  );

  -- ===========================================================================
  -- FINANCEIRO — 2 eventos fictícios (F14)
  -- ===========================================================================

  -- Evento 1: mistura produtos individuais e compra em lote, para conferir os
  -- três totais da tela. Inclui um brinde de valor zero (F10) e um item por
  -- peso com a unidade no nome (F7).
  insert into public.eventos (nome, data_evento, created_by)
  values ('Chá de bebê da Ana', current_date + 14, v_user_id)
  returning id into v_evento_1;

  insert into public.produtos_evento (evento_id, nome, quantidade, valor_unitario, created_by)
  values
    (v_evento_1, 'Vaso de flor',            2, 12.90, v_user_id),
    (v_evento_1, 'Lembrancinha de crochê', 20,  4.50, v_user_id),
    (v_evento_1, '2 kg de bala',            1, 18.70, v_user_id),
    (v_evento_1, 'Fita de cetim',           3,  0.10, v_user_id),
    (v_evento_1, 'Sacola doada',            5,  0.00, v_user_id);
  -- Total esperado de produtos: 25,80 + 90,00 + 18,70 + 0,30 + 0,00 = R$ 134,80
  -- (o 0,10 x 3 existe de propósito: em JavaScript, 0.1+0.1+0.1 dá
  --  0.30000000000000004. Somado no banco, dá 0.30 exato.)

  insert into public.compras_lote_evento (evento_id, descricao, texto_nota, valor_total, created_by)
  values (
    v_evento_1,
    'Mercado Extra — materiais',
    E'MERCADO EXTRA LTDA\nCUPOM FISCAL 004512\n\n1x Papel crepom rosa    4,90\n3x Cartolina branca     2,30\n2x Cola bastão          7,80\n1x Fita dupla face     11,40\n\nTOTAL                  42,30',
    42.30, v_user_id
  );

  -- Evento 2: só compra em lote e sem data, para testar o "sem data no fim da
  -- lista" (F12) e a seção de produtos vazia.
  insert into public.eventos (nome, created_by)
  values ('Páscoa 2026', v_user_id)
  returning id into v_evento_2;

  insert into public.compras_lote_evento (evento_id, descricao, texto_nota, valor_total, created_by)
  values (
    v_evento_2,
    'Atacadão — chocolates',
    E'ATACADAO\n\n30x Ovo de páscoa pequeno   6,50\n10x Cesta de vime          12,00\n\nTOTAL                     315,00',
    315.00, v_user_id
  );

  raise notice 'Seed concluído: 3 idosos, 5 registros, 2 eventos e 7 lançamentos fictícios criados.';
end;
$$;
