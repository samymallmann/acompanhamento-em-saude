-- =============================================================================
-- SEED APENAS DO FINANCEIRO — 2 eventos fictícios
--
-- ⚠️  NUNCA RODAR NO PROJETO DE PRODUÇÃO.
--
-- Use ESTE arquivo se você já rodou o seed.sql antes e só quer os eventos.
-- Rodar o seed.sql inteiro de novo NÃO sobrescreve nada: ele faz INSERT, então
-- criaria uma segunda Maria, um segundo João e uma segunda Terezinha, com os
-- atendimentos duplicados junto.
--
-- Este arquivo é seguro de rodar mais de uma vez? NÃO. Rodar duas vezes cria
-- dois "Chá de bebê da Ana". Se isso acontecer, é só marcar o repetido como
-- inativo pela própria tela.
-- =============================================================================

do $$
declare
  v_user_id  uuid;
  v_evento_1 uuid;
  v_evento_2 uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;

  if v_user_id is null then
    raise exception
      'Nenhuma conta encontrada em auth.users. Crie uma conta no painel antes de rodar o seed.';
  end if;

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
  -- Total esperado de produtos: R$ 134,80
  -- (as três fitas de 0,10 estão aí de propósito: em JavaScript,
  --  0.1+0.1+0.1 dá 0.30000000000000004. Somado no banco, dá 0,30 exato.)

  insert into public.compras_lote_evento (evento_id, descricao, texto_nota, valor_total, created_by)
  values (
    v_evento_1,
    'Mercado Extra — materiais',
    E'MERCADO EXTRA LTDA\nCUPOM FISCAL 004512\n\n1x Papel crepom rosa    4,90\n3x Cartolina branca     2,30\n2x Cola bastão          7,80\n1x Fita dupla face     11,40\n\nTOTAL                  42,30',
    42.30, v_user_id
  );
  -- Total geral esperado do evento: R$ 177,10

  -- Evento 2: sem data e só com compra em lote, para testar o "sem data no fim
  -- da lista" (F12) e a seção de produtos vazia.
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

  raise notice 'Seed do financeiro concluído: 2 eventos e 7 lançamentos criados.';
end;
$$;
