/**
 * js/calendario/conteudo.js
 *
 * CALENDÁRIO — o CONTEÚDO do calendário oficial de marketing da rede.
 * Este arquivo é só DADO: nenhuma função, nenhuma dependência. Quem o lê é
 * `calFetch()` em calendario.js — o ponto único de troca da fonte.
 *
 * ⚠ PROVENIÊNCIA: portado em 2026-09-03 do `MONTH_DATA` do calendário que a
 * operação publica hoje (calendario2026.deliverymuch.workers.dev). Não foi
 * digitado à mão — saiu de um script, para não divergir da fonte. Enquanto a
 * decisão #1 do 07_ROADMAP não sair (planilha? tabela? Yungas?), ESTE arquivo
 * é a fonte, e o rodapé do módulo diz isso na cara do franqueado.
 *
 * O que mudou na passagem, e por quê:
 *  · HTML REMOVIDO. Os textos vinham com <strong>. Abrir uma segunda via de
 *    escape para deixar tag passar é a brecha que o 03_ENGINEERING proíbe —
 *    então tudo virou texto puro e segue por gEsc como qualquer outro dado.
 *  · EMOJI REMOVIDO DO NOME (decisão do Ryan, 03/09): ícone no Luma é SVG
 *    (04_DESIGN_SYSTEM §10). "Semana do Cliente 💛" virou "Semana do Cliente".
 *  · O EMOJI DAS REGRAS VIROU MARCADOR. ✅ e ⚠️ carregavam significado, não
 *    decoração: viraram {t:'ok'|'alerta'} e a UI desenha o ícone em SVG.
 *  · VÍNCULO COM CAMPANHA DO CATÁLOGO SÓ ONDE É REAL. As campanhas-mãe de
 *    setembro não têm template publicado; apontar para uma campanha qualquer
 *    só pra ter botão seria mentir sobre onde estão as artes.
 *
 * Campos por evento: id, titulo, tipo, inicio, fim, bucket, escopo, banner,
 * camp, regra, resumo, cadastro, ativo, cadastrar[], exemplos[],
 * regras[{t,txt}], dica, disparos[], incentivo, alerta{titulo,texto}.
 *
 * Para atualizar: refaça o caminho (baixar o MONTH_DATA da fonte, normalizar)
 * em vez de editar aqui à mão — edição manual é o que faz o dado divergir.
 */

const CAL_CONTEUDO = {
  "2026-08": {
    "ano": 2026,
    "mes": 7,
    "dias": 31,
    "eventos": [
      {
        "id": "2026-08-combos-coca",
        "titulo": "Combos Coca-Cola",
        "tipo": "recorrente",
        "inicio": "2026-08-01",
        "fim": "2026-08-31",
        "bucket": "turbinar",
        "camp": "cc",
        "escopo": "Nacional",
        "regra": "A partir de R$ 3 off",
        "resumo": "Campanha recorrente focada em PEDIR EM GALERA. Combos com Coca-Cola pensados pra grupo — pizza família, lanches de mesa, combinado de sushi. Ticket médio alto, conversão alta em fim de semana e datas especiais.",
        "cadastro": "Cadastro ativo todo o mês",
        "ativo": "Mês inteiro · prioridade nos fins de semana",
        "cadastrar": [
          "Pizza grande/família + Coca 2L · prioridade máxima",
          "Hambúrguer (2+ un) + Coca",
          "Combinado de sushi familiar + Coca",
          "Esfihas em quantidade + Coca",
          "Porções pra dividir (frango, batata) + Coca",
          "Obrigatório incluir Coca-Cola no combo"
        ],
        "exemplos": [
          "Pizza família 8 fatias + Coca 2L (de R$ 95 por R$ 85) — incentivo R$ 1",
          "2 X-burgers + 2 batatas + Coca 2L (de R$ 90 por R$ 78) — incentivo R$ 1",
          "Combinado sushi 40 peças + Coca 2L (de R$ 145 por R$ 132) — incentivo R$ 1"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Foco em ticket médio alto — pelo menos R$ 50 por combo"
          },
          {
            "t": "",
            "txt": "Ordem de prioridade: 1. Pizza · 2. Hambúrguer · 3. Sushi · 4. Esfiha · 5. Porções"
          },
          {
            "t": "",
            "txt": "Coca-Cola tem que ser na versão FAMÍLIA (1,5L ou 2L)"
          },
          {
            "t": "",
            "txt": "Limite de 2 itens por carrinho"
          },
          {
            "t": "",
            "txt": "Incentivo franqueadora: R$ 1 fixo em ofertas a partir de R$ 3 off"
          },
          {
            "t": "alerta",
            "txt": "Atenção: o subsídio de R$ 1 vale apenas pra cidades investidas. Confirme com o seu consultor se a sua operação é elegível antes de cadastrar."
          }
        ],
        "dica": "Pedido em galera tem ticket 2-3x maior. Em datas especiais e fim de semana o combo pizza família + Coca explode. Tenha 1 combo de cada categoria publicado.",
        "incentivo": "R$ 1 fixo por oferta · apenas cidades investidas (confirme com o consultor)"
      },
      {
        "id": "2026-08-baratissimo",
        "titulo": "Baratíssimo",
        "tipo": "recorrente",
        "inicio": "2026-08-01",
        "fim": "2026-08-31",
        "bucket": "manutencao",
        "banner": "assets/banners/tr25.png",
        "camp": "tr25",
        "escopo": "Nacional",
        "regra": "Preço máximo de R$ 25",
        "resumo": "Pratos a até R$ 25 seguem na vitrine institucional. Foco em MARMITA na hora do almoço, todos os dias úteis.",
        "cadastro": "Cadastro permanente",
        "ativo": "Mês inteiro · pico no horário do almoço",
        "cadastrar": [
          "Marmitas · prioridade máxima — tradicional, fitness, executiva",
          "Pratos feitos a R$ 15-25",
          "Lanche simples + bebida a até R$ 25",
          "Esfiha, pastel, salgado em combo",
          "Porção compartilhável"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Também aparece no Eugênio"
          },
          {
            "t": "",
            "txt": "Destaque garantido na Home"
          }
        ],
        "dica": "Marmita ganha a hora do almoço. Cadastre 3-5 opções diferentes pra cobrir tradicional, fitness e executiva."
      },
      {
        "id": "2026-08-promo-turbinada",
        "titulo": "Promo Turbinada",
        "tipo": "recorrente",
        "inicio": "2026-08-01",
        "fim": "2026-08-31",
        "bucket": "turbinar",
        "banner": "assets/banners/pt.png",
        "camp": "pt",
        "escopo": "Nacional",
        "regra": "A partir de 50% off",
        "resumo": "Vitrine principal de 50%+ off. Use pra amplificar volume nos dias de pico do mês.",
        "cadastro": "Cadastro ativo todo o mês",
        "ativo": "Mês inteiro",
        "cadastrar": [
          "Produtos com desconto de 50% ou mais"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Também aparece no Eugênio"
          },
          {
            "t": "",
            "txt": "Destaque garantido na Home do app"
          }
        ],
        "dica": "Use pra surfar em dias de pico — 50% off vira chamariz forte. Nas datas especiais combine com a vitrine que fizer sentido pro dia (burger no Bacon, marmita no almoço, etc.)."
      },
      {
        "id": "2026-08-mais-vendidos",
        "titulo": "Mais Vendidos do App",
        "tipo": "recorrente",
        "inicio": "2026-08-01",
        "fim": "2026-08-31",
        "bucket": "manutencao",
        "banner": "assets/banners/mais-vendidos.png",
        "escopo": "Nacional",
        "regra": "A partir de 25% off",
        "resumo": "Vitrine dos preferidos do app — carros-chefe com 25%+ off, mês inteiro.",
        "cadastro": "Cadastro permanente",
        "ativo": "Mês inteiro",
        "cadastrar": [
          "Produtos campeões da sua loja",
          "\"Preferidos do app\" — itens com volume e nota alta",
          "Carros-chefe com desconto saudável",
          "Olhe o painel da Yungas: top 5 são candidatos óbvios"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Vitrine de \"preferidos\" — produtos com nota e volume comprovados"
          }
        ],
        "dica": "Espaço dos campeões da loja. Mantenha eles cadastrados pra estabilizar a base."
      },
      {
        "id": "2026-08-combao",
        "titulo": "Combão com Desconto",
        "tipo": "recorrente",
        "inicio": "2026-08-01",
        "fim": "2026-08-31",
        "bucket": "turbinar",
        "banner": "assets/banners/cd.png",
        "camp": "cd",
        "escopo": "Nacional",
        "regra": "10% a 30% off",
        "resumo": "Pedido pra galera — combos de 2+ itens, 10-30% off. Mesmo apelo do Combos Coca-Cola, mas sem obrigação da Coca.",
        "cadastro": "Cadastro permanente",
        "ativo": "Mês inteiro",
        "cadastrar": [
          "Combos pra galera com bebida à escolha",
          "2 burgers + 2 batatas, 2 pizzas brotinho, combo de esfihas",
          "2 pizzas grandes ou pizza + entrada",
          "Combinado de sushi familiar",
          "Combos de esfihas/salgados em quantidade",
          "Porções pra dividir + bebida opcional"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Também aparece no Eugênio"
          },
          {
            "t": "",
            "txt": "Importante: para operações não investidas"
          },
          {
            "t": "",
            "txt": "Argumento de \"pedir em galera\" — combo é pra grupo"
          }
        ],
        "dica": "Combão é o \"Combos Coca-Cola\" sem amarra de marca — mesma lógica de pedir em galera, você decide a bebida (ou pode nem ter)."
      },
      {
        "id": "2026-08-ofertas-favoritas",
        "titulo": "Ofertas Favoritas",
        "tipo": "recorrente",
        "inicio": "2026-08-01",
        "fim": "2026-08-31",
        "bucket": "manutencao",
        "banner": "assets/banners/ofertas-favoritas.png",
        "escopo": "Nacional",
        "regra": "A partir de 15% off",
        "resumo": "Vitrine de ofertas favoritas — os itens que o cliente ama e volta a pedir, com desconto que dá vontade. Roda o mês inteiro pra manter a base engajada e recomprando.",
        "cadastro": "Cadastro permanente",
        "ativo": "Mês inteiro",
        "cadastrar": [
          "Favoritos da casa · os pedidos que mais se repetem",
          "Itens de recompra · aquilo que o cliente pede toda semana",
          "Queridinhos com boa margem · desconto saudável sem apertar",
          "Mix variado pra cobrir almoço, jantar e lanche da tarde"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Também aparece no Eugênio"
          },
          {
            "t": "",
            "txt": "Foco em recompra — produtos que o cliente já ama"
          }
        ],
        "dica": "Ofertas Favoritas é a vitrine da fidelidade: mantém os queridinhos sempre com um descontinho pra puxar a recompra e estabilizar o faturamento no mês."
      },
      {
        "id": "2026-08-crm-cerveja",
        "titulo": "CRM: Dia da Cerveja",
        "tipo": "crm",
        "inicio": "2026-08-07",
        "fim": "2026-08-07",
        "escopo": "Nacional",
        "resumo": "Sexta 07/08 — Dia da Cerveja e ainda por cima sexta. Combo perfeito pra puxar bebida + petisco no jantar.",
        "disparos": [
          {
            "hora": "18:30",
            "tipo": "Jantar pico",
            "desc": "Push de Dia da Cerveja — cerveja gelada + petisco/porção pra começar a sexta. Destaca combos com bebida."
          }
        ]
      },
      {
        "id": "2026-08-crm-dia-pais",
        "titulo": "CRM: Dia dos Pais",
        "tipo": "crm",
        "inicio": "2026-08-09",
        "fim": "2026-08-09",
        "escopo": "Nacional",
        "resumo": "Domingo 09/08 — maior data do mês. Almoço e jantar em família, ticket médio alto.",
        "disparos": [
          {
            "hora": "11:30",
            "tipo": "Almoço pico",
            "desc": "Push principal — almoço em família de domingo. Churrasco, pizza família, combo pra galera."
          },
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push de jantar — última janela de pico do dia, reforça combos e sobremesa."
          }
        ]
      },
      {
        "id": "2026-08-crm-estudante",
        "titulo": "CRM: Dia do Estudante",
        "tipo": "crm",
        "inicio": "2026-08-11",
        "fim": "2026-08-11",
        "escopo": "Nacional",
        "resumo": "Terça 11/08 — Dia do Estudante. Fala com o público jovem, ticket baixo e combo simples.",
        "disparos": [
          {
            "hora": "18:30",
            "tipo": "Jantar pico",
            "desc": "Push brincando com \"quem tá estudando merece\" — lanche simples e Baratíssimo em destaque."
          }
        ]
      },
      {
        "id": "2026-08-crm-solteiro",
        "titulo": "CRM: Dia do Solteiro",
        "tipo": "crm",
        "inicio": "2026-08-15",
        "fim": "2026-08-15",
        "escopo": "Nacional",
        "resumo": "Sábado 15/08 — Dia do Solteiro. Pedido pra um, sem culpa, no sábado à noite.",
        "disparos": [
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push de \"solteiro também merece\" — combo individual, sobremesa e aquele mimo pra um."
          }
        ]
      },
      {
        "id": "2026-08-crm-pao-queijo",
        "titulo": "CRM: Dia do Pão de Queijo",
        "tipo": "crm",
        "inicio": "2026-08-17",
        "fim": "2026-08-17",
        "escopo": "Nacional",
        "resumo": "Segunda 17/08 — Dia do Pão de Queijo. Ativação leve no café da manhã / lanche da tarde.",
        "disparos": [
          {
            "hora": "15:30",
            "tipo": "Tarde",
            "desc": "Push de lanche da tarde — pão de queijo quentinho + café. Padarias e cafeterias em destaque."
          }
        ]
      },
      {
        "id": "2026-08-crm-gamer",
        "titulo": "CRM: Dia do Gamer",
        "tipo": "crm",
        "inicio": "2026-08-29",
        "fim": "2026-08-29",
        "escopo": "Nacional",
        "resumo": "Sábado 29/08 — Dia do Gamer. Sábado + público gamer = pedido pra maratona de jogo.",
        "disparos": [
          {
            "hora": "19:30",
            "tipo": "Jantar pico",
            "desc": "Push de \"combustível pra maratona\" — lanche, pizza, porção e bebida pra jogar a noite toda."
          }
        ]
      },
      {
        "id": "2026-08-crm-bacon",
        "titulo": "CRM: Dia do Bacon",
        "tipo": "crm",
        "inicio": "2026-08-31",
        "fim": "2026-08-31",
        "escopo": "Nacional",
        "resumo": "Segunda 31/08 — Dia do Bacon. Fecha o mês ativando burger e tudo que leva bacon.",
        "disparos": [
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push de Dia do Bacon — hambúrguer, hot dog e combos com bacon em destaque."
          }
        ]
      },
      {
        "id": "2026-08-crm-nutricionista",
        "titulo": "CRM: Dia do Nutricionista",
        "tipo": "crm",
        "inicio": "2026-08-31",
        "fim": "2026-08-31",
        "escopo": "Nacional",
        "resumo": "Segunda 31/08 — Dia do Nutricionista. Contraponto saudável no almoço: marmita fit, salada, bowl.",
        "disparos": [
          {
            "hora": "11:45",
            "tipo": "Almoço pico",
            "desc": "Push de opções saudáveis — marmita fitness, salada, bowl e prato balanceado pro almoço."
          }
        ]
      },
      {
        "id": "2026-08-dia-cerveja",
        "titulo": "Dia da Cerveja",
        "tipo": "especial",
        "inicio": "2026-08-07",
        "fim": "2026-08-07",
        "escopo": "Nacional",
        "resumo": "Sexta 07/08 — Dia da Cerveja, e ainda por cima sexta. Bom gancho pra puxar bebida + petisco no jantar.",
        "dica": "Post e push com cerveja gelada + porção. Destaca combos com bebida — sem cadastro extra, usa as vitrines vigentes."
      },
      {
        "id": "2026-08-dia-pais",
        "titulo": "Dia dos Pais",
        "tipo": "especial",
        "inicio": "2026-08-09",
        "fim": "2026-08-09",
        "escopo": "Nacional",
        "resumo": "Domingo 09/08 — 2ª maior data comercial do delivery no ano. Pico de tráfego e ticket médio.",
        "dica": "Operação plus no domingo. Estoque triplicado de proteína, cerveja e sobremesa. Escala com +motoboy garantido."
      },
      {
        "id": "2026-08-dia-estudante",
        "titulo": "Dia do Estudante",
        "tipo": "especial",
        "inicio": "2026-08-11",
        "fim": "2026-08-11",
        "escopo": "Nacional",
        "resumo": "Terça 11/08 — Dia do Estudante. Momento de brincar na comunicação com o público jovem.",
        "dica": "Post e Stories comunicando desconto pra \"quem tá estudando\". Combos simples e ticket baixo (Baratíssimo) rendem bem."
      },
      {
        "id": "2026-08-dia-solteiro",
        "titulo": "Dia do Solteiro",
        "tipo": "especial",
        "inicio": "2026-08-15",
        "fim": "2026-08-15",
        "escopo": "Nacional",
        "resumo": "Sábado 15/08 — Dia do Solteiro. Pedido pra um, sem culpa, no sábado à noite.",
        "dica": "Post e push de \"solteiro também merece\" — combo individual e aquele mimo. Sem cadastro extra, usa vitrines vigentes."
      },
      {
        "id": "2026-08-dia-pao-queijo",
        "titulo": "Dia do Pão de Queijo",
        "tipo": "especial",
        "inicio": "2026-08-17",
        "fim": "2026-08-17",
        "escopo": "Nacional",
        "resumo": "Segunda 17/08 — Dia do Pão de Queijo. Ativação leve no café da manhã / lanche da tarde.",
        "dica": "Post lúdico com pão de queijo quentinho + café. Padarias e cafeterias em destaque — sem cadastro extra."
      },
      {
        "id": "2026-08-dia-gamer",
        "titulo": "Dia do Gamer",
        "tipo": "especial",
        "inicio": "2026-08-29",
        "fim": "2026-08-29",
        "escopo": "Nacional",
        "resumo": "Sábado 29/08 — Dia do Gamer. Sábado + público gamer = pedido pra maratona de jogo.",
        "dica": "Post e push de \"combustível pra maratona\" — lanche, pizza e bebida pra jogar a noite toda. Usa vitrines vigentes."
      },
      {
        "id": "2026-08-dia-bacon",
        "titulo": "Dia do Bacon",
        "tipo": "especial",
        "inicio": "2026-08-31",
        "fim": "2026-08-31",
        "escopo": "Nacional",
        "resumo": "Segunda 31/08 — Dia do Bacon. Data divertida pra ativar burgers, hot dogs e tudo que leva bacon. Fecha o mês com apetite.",
        "dica": "Post e Stories com aquele close no bacon. Destaca combos de hambúrguer e itens com bacon nas vitrines — sem cadastro extra, usa o que já tá no ar."
      },
      {
        "id": "2026-08-dia-nutricionista",
        "titulo": "Dia do Nutricionista",
        "tipo": "especial",
        "inicio": "2026-08-31",
        "fim": "2026-08-31",
        "escopo": "Nacional",
        "resumo": "Segunda 31/08 — Dia do Nutricionista. Contraponto saudável no almoço: marmita fit, salada, bowl.",
        "dica": "Post e push com opções balanceadas — marmita fitness, salada e bowl. Convive bem com o Dia do Bacon: cada um no seu horário (almoço fit, jantar bacon)."
      }
    ]
  },
  "2026-09": {
    "ano": 2026,
    "mes": 8,
    "dias": 30,
    "eventos": [
      {
        "id": "2026-09-semana-cliente",
        "titulo": "Semana do Cliente · MÃE DO MÊS (nacional)",
        "tipo": "mae",
        "inicio": "2026-09-08",
        "fim": "2026-09-15",
        "bucket": "mae-novidade",
        "escopo": "Nacional",
        "regra": "A partir de 15% off no esquenta · 30% no Dia do Cliente (15/09)",
        "resumo": "Campanha-mãe de setembro · nacional (todas as operações, inclusive RS). São 7 dias de esquenta a partir de 15% off (08 a 14/09), fechando no Dia do Cliente (terça 15/09) com 30% off + live nas operações. Foco em PREÇO pra aumentar GMV — é a semana de reativar quem sumiu e premiar quem é fiel.",
        "cadastro": "Cadastro ativo a partir de 03/09",
        "ativo": "08/09 (ter) a 15/09 (ter) · 7 dias de esquenta, pico no Dia do Cliente (15/09)",
        "cadastrar": [
          "Todas as categorias · quanto mais variedade, melhor",
          "Carro-chefe · o mais pedido da loja com desconto que chama atenção",
          "Combo pra galera · pizza família, combo lanche, combinado",
          "Lanche + bebida e marmita/almoço de alto giro",
          "Sobremesa · pra fechar o pedido",
          "Mínimo de 4 produtos habilitados no carrossel"
        ],
        "exemplos": [
          "Carro-chefe da casa de R$ 48 por R$ 40 (17% off)",
          "Combo burger + batata + refri de R$ 42 por R$ 35 (17% off)",
          "Pizza família + Coca 2L de R$ 95 por R$ 80 (16% off)"
        ],
        "regras": [
          {
            "t": "ok",
            "txt": "Desconto mínimo: 15% off no esquenta (08 a 14/09)"
          },
          {
            "t": "",
            "txt": "Entrega grátis acima de valor mínimo durante a semana"
          },
          {
            "t": "ok",
            "txt": "Manter pelo menos 1 oferta ativa por dia durante todo o período"
          },
          {
            "t": "alerta",
            "txt": "Mínimo de 4 produtos habilitados (carrossel na home do app)"
          },
          {
            "t": "",
            "txt": "Vale pra todas as categorias e formas de pagamento"
          },
          {
            "t": "",
            "txt": "Cadastre em [Semana do Cliente - 15% OFF]"
          },
          {
            "t": "",
            "txt": "Intensifica no Dia do Cliente (15/09), quando o off sobe pra 30%"
          }
        ],
        "dica": "Banner da campanha: \"E$quenta do Cliente · ATÉ 30% OFF\". A lógica é preço: 7 dias esquentando a base a 15%+ e o pico no dia 15 a 30% off, encerrando com live nas operações. Não economiza no off — é a data de agradecer quem pede na gente.",
        "alerta": {
          "titulo": "Campanha nacional — inclusive RS",
          "texto": "A Semana do Cliente vale pra todas as operações, inclusive o RS. No RS, ela emenda depois na Semana do Gaúcho (16 a 20/09)."
        }
      },
      {
        "id": "2026-09-dia-cliente-camp",
        "titulo": "Dia do Cliente · 30% OFF + LIVE (nacional)",
        "tipo": "mae",
        "inicio": "2026-09-15",
        "fim": "2026-09-15",
        "bucket": "mae-novidade",
        "escopo": "Nacional",
        "regra": "A partir de 30% off",
        "resumo": "Campanha OBRIGATÓRIA · nacional (todas as operações, inclusive RS). No dia 15/09 o desconto sobe: ofertas a partir de 30% off em todas as categorias. É o pico do mês e o encerramento da Semana do Cliente — com live nas operações.",
        "cadastro": "Cadastro ativo a partir de 03/09",
        "ativo": "Apenas no dia 15/09 (terça) · pico do mês + live",
        "cadastrar": [
          "Carro-chefe com desconto agressivo (30%+)",
          "Todas as categorias · itens de alto giro",
          "Combos pra galera pra puxar ticket",
          "Mínimo de 4 produtos habilitados"
        ],
        "exemplos": [
          "Carro-chefe de R$ 48 por R$ 33 (31% off)",
          "Combo burger + batata + refri de R$ 42 por R$ 29 (31% off)"
        ],
        "regras": [
          {
            "t": "alerta",
            "txt": "Campanha OBRIGATÓRIA (todas as operações, inclusive RS)"
          },
          {
            "t": "ok",
            "txt": "Desconto mínimo: 30% off"
          },
          {
            "t": "ok",
            "txt": "Manter pelo menos 1 oferta ativa no dia"
          },
          {
            "t": "",
            "txt": "Live nas operações encerrando a Semana do Cliente"
          },
          {
            "t": "",
            "txt": "Cadastre em [Dia do Cliente - 30% OFF]"
          },
          {
            "t": "",
            "txt": "Mínimo 4 produtos habilitados no carrossel"
          }
        ],
        "dica": "É o dia mais forte do mês e fecha a Semana do Cliente com live nas operações. App abastecido, carrossel no ar desde o esquenta e carro-chefe a 30%+. Combina com Promo Turbinada (50% off) pra dobrar a exposição na Home. No RS, emenda no dia seguinte com a Semana do Gaúcho."
      },
      {
        "id": "2026-09-semana-gaucho",
        "titulo": "Semana do Gaúcho · MÃE DO MÊS (só RS)",
        "tipo": "mae",
        "inicio": "2026-09-16",
        "fim": "2026-09-20",
        "bucket": "mae-novidade",
        "escopo": "Só RS",
        "regra": "A partir de 15% off · 30% no Dia do Gaúcho (20/09)",
        "resumo": "Campanha do RS que emenda logo após o Dia do Cliente. São 5 dias (16 a 20/09), no clima da Semana Farroupilha, com pico no Dia do Gaúcho (domingo 20/09). É uma semana nichada: em vez de colocar todo o app do RS no modo gaudério, puxa quem realmente tem fit — xis, carne, linguiça, cerveja e típicas.",
        "cadastro": "Cadastro ativo a partir de 02/09",
        "ativo": "16/09 (qua) a 20/09 (dom) · 5 dias, após o Dia do Cliente · pico no Dia do Gaúcho (20/09)",
        "cadastrar": [
          "Xis gaudério · o protagonista da data no RS",
          "Carne, linguiça e churrasco · cortes e combos",
          "Pão, cuca e comidas típicas da região",
          "Cerveja pra acompanhar",
          "Mercado: kit churrasco, erva mate, pão de alho",
          "Mínimo de 4 produtos habilitados no carrossel"
        ],
        "exemplos": [
          "Xis gaudério de R$ 40 por R$ 34 (15% off)",
          "Kit churrasco de R$ 120 por R$ 102 (15% off)"
        ],
        "regras": [
          {
            "t": "alerta",
            "txt": "Campanha OBRIGATÓRIA pra operações do RS"
          },
          {
            "t": "",
            "txt": "Semana nichada — destaca só lojas/produtos com fit gaudério"
          },
          {
            "t": "ok",
            "txt": "Desconto mínimo: 15% off"
          },
          {
            "t": "ok",
            "txt": "Manter pelo menos 1 oferta ativa por dia"
          },
          {
            "t": "",
            "txt": "Cadastre em [Semana do Gaúcho - 15% OFF]"
          },
          {
            "t": "",
            "txt": "Mínimo 4 produtos habilitados (carrossel na home)"
          }
        ],
        "dica": "Banner: \"loco de boa · ATÉ 30% OFF\". No RS a Semana do Cliente (08–15) emenda na do Gaúcho (16–20). Trabalha bandeira, cuia e chapéu em 2º plano e coloca as comidas típicas com desconto em destaque. Xis é o protagonista. Dia do Gaúcho (20/09) é o pico, com 30% off.",
        "alerta": {
          "titulo": "Exclusiva do RS — emenda na Semana do Cliente",
          "texto": "No RS a operação faz as duas: Semana do Cliente (08 a 15/09, nacional) e, na sequência, a Semana do Gaúcho (16 a 20/09). Nas demais regiões só a Semana do Cliente."
        }
      },
      {
        "id": "2026-09-dia-gaucho-camp",
        "titulo": "Dia do Gaúcho · 30% OFF (só RS)",
        "tipo": "mae",
        "inicio": "2026-09-20",
        "fim": "2026-09-20",
        "bucket": "mae-novidade",
        "escopo": "Só RS",
        "regra": "A partir de 30% off",
        "resumo": "Pico da Semana do Gaúcho. No dia 20/09 (Revolução Farroupilha) o desconto sobe pra 30% off em xis, churrasco e comidas típicas. Só RS.",
        "cadastro": "Cadastro ativo a partir de 02/09",
        "ativo": "Apenas no dia 20/09 (domingo)",
        "cadastrar": [
          "Xis, churrasco e comidas típicas",
          "Mínimo de 4 produtos habilitados"
        ],
        "exemplos": [
          "Xis de R$ 40 por R$ 28 (30% off)"
        ],
        "regras": [
          {
            "t": "ok",
            "txt": "Desconto mínimo: 30% off"
          },
          {
            "t": "ok",
            "txt": "Recomendado manter pelo menos 1 oferta ativa no dia"
          },
          {
            "t": "",
            "txt": "Cadastre em [Dia do Gaúcho - 30% OFF]"
          },
          {
            "t": "",
            "txt": "Mínimo 4 produtos habilitados"
          }
        ],
        "dica": "20/09 é feriado no RS (Revolução Farroupilha) — gente em casa, clima de churrasco. Desconto forte em xis e cortes puxa o volume do dia."
      },
      {
        "id": "2026-09-combos-coca",
        "titulo": "Combos Coca-Cola",
        "tipo": "recorrente",
        "inicio": "2026-09-01",
        "fim": "2026-09-30",
        "bucket": "turbinar",
        "camp": "cc",
        "escopo": "Nacional",
        "regra": "A partir de R$ 3 off",
        "resumo": "Campanha recorrente focada em PEDIR EM GALERA. Combos com Coca-Cola pensados pra grupo — pizza família, lanches de mesa, combinado de sushi. Ticket médio alto, conversão alta em fim de semana e datas especiais.",
        "cadastro": "Cadastro ativo todo o mês — reforçar no Dia do Cliente",
        "ativo": "Mês inteiro · prioridade no Dia do Cliente (15/09)",
        "cadastrar": [
          "Pizza grande/família + Coca 2L · prioridade máxima",
          "Hambúrguer (2+ un) + Coca",
          "Combinado de sushi familiar + Coca",
          "Esfihas em quantidade + Coca",
          "Porções pra dividir (frango, batata) + Coca",
          "Obrigatório incluir Coca-Cola no combo"
        ],
        "exemplos": [
          "Pizza família 8 fatias + Coca 2L (de R$ 95 por R$ 85) — incentivo R$ 1",
          "2 X-burgers + 2 batatas + Coca 2L (de R$ 90 por R$ 78) — incentivo R$ 1",
          "Combinado sushi 40 peças + Coca 2L (de R$ 145 por R$ 132) — incentivo R$ 1"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Foco em ticket médio alto — pelo menos R$ 50 por combo"
          },
          {
            "t": "",
            "txt": "Ordem de prioridade: 1. Pizza · 2. Hambúrguer · 3. Sushi · 4. Esfiha · 5. Porções"
          },
          {
            "t": "",
            "txt": "Coca-Cola tem que ser na versão FAMÍLIA (1,5L ou 2L)"
          },
          {
            "t": "",
            "txt": "Limite de 2 itens por carrinho"
          },
          {
            "t": "",
            "txt": "Incentivo franqueadora: R$ 1 fixo em ofertas a partir de R$ 3 off"
          }
        ],
        "dica": "Pedido em galera tem ticket 2-3x maior. No Dia do Cliente (15/09) e no feriado da Independência (07/09) o combo pizza família + Coca explode. Tenha 1 combo de cada categoria publicado.",
        "incentivo": "R$ 1 fixo por oferta (cidades elegíveis)"
      },
      {
        "id": "2026-09-baratissimo",
        "titulo": "Baratíssimo",
        "tipo": "recorrente",
        "inicio": "2026-09-01",
        "fim": "2026-09-30",
        "bucket": "manutencao",
        "banner": "assets/banners/tr25.png",
        "camp": "tr25",
        "escopo": "Nacional",
        "regra": "Preço máximo de R$ 25",
        "resumo": "Pratos a até R$ 25 seguem na vitrine institucional. Foco em MARMITA na hora do almoço, todos os dias úteis.",
        "cadastro": "Cadastro permanente",
        "ativo": "Mês inteiro · pico no horário do almoço",
        "cadastrar": [
          "Marmitas · prioridade máxima — tradicional, fitness, executiva",
          "Pratos feitos a R$ 15-25",
          "Lanche simples + bebida a até R$ 25",
          "Esfiha, pastel, salgado em combo",
          "Porção compartilhável"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Também aparece no Eugênio"
          },
          {
            "t": "",
            "txt": "Destaque garantido na Home"
          }
        ],
        "dica": "Marmita ganha a hora do almoço. Cadastre 3-5 opções diferentes pra cobrir tradicional, fitness e executiva."
      },
      {
        "id": "2026-09-promo-turbinada",
        "titulo": "Promo Turbinada",
        "tipo": "recorrente",
        "inicio": "2026-09-01",
        "fim": "2026-09-30",
        "bucket": "turbinar",
        "banner": "assets/banners/pt.png",
        "camp": "pt",
        "escopo": "Nacional",
        "regra": "A partir de 50% off",
        "resumo": "Vitrine principal de 50%+ off. Use pra amplificar volume nos dias de pico do mês.",
        "cadastro": "Cadastro ativo todo o mês",
        "ativo": "Mês inteiro",
        "cadastrar": [
          "Produtos com desconto de 50% ou mais"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Também aparece no Eugênio"
          },
          {
            "t": "",
            "txt": "Destaque garantido na Home do app"
          }
        ],
        "dica": "Use pra surfar em dias de pico — 50% off vira chamariz forte. No Dia do Cliente (15/09) combine com a vitrine do Especial Dia do Cliente pra dobrar a exposição na Home."
      },
      {
        "id": "2026-09-mais-vendidos",
        "titulo": "Mais Vendidos do App",
        "tipo": "recorrente",
        "inicio": "2026-09-01",
        "fim": "2026-09-30",
        "bucket": "manutencao",
        "banner": "assets/banners/mais-vendidos.png",
        "escopo": "Nacional",
        "regra": "A partir de 25% off",
        "resumo": "Vitrine dos preferidos do app — carros-chefe com 25%+ off, mês inteiro.",
        "cadastro": "Cadastro permanente",
        "ativo": "Mês inteiro",
        "cadastrar": [
          "Produtos campeões da sua loja",
          "\"Preferidos do app\" — itens com volume e nota alta",
          "Carros-chefe com desconto saudável",
          "Olhe o painel da Yungas: top 5 são candidatos óbvios"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Vitrine de \"preferidos\" — produtos com nota e volume comprovados"
          }
        ],
        "dica": "Espaço dos campeões da loja. Mantenha eles cadastrados pra estabilizar a base."
      },
      {
        "id": "2026-09-combao",
        "titulo": "Combão com Desconto",
        "tipo": "recorrente",
        "inicio": "2026-09-01",
        "fim": "2026-09-30",
        "bucket": "turbinar",
        "banner": "assets/banners/cd.png",
        "camp": "cd",
        "escopo": "Nacional",
        "regra": "10% a 30% off",
        "resumo": "Pedido pra galera — combos de 2+ itens, 10-30% off. Mesmo apelo do Combos Coca-Cola, mas sem obrigação da Coca.",
        "cadastro": "Cadastro permanente",
        "ativo": "Mês inteiro",
        "cadastrar": [
          "Combos pra galera com bebida à escolha",
          "2 burgers + 2 batatas, 2 pizzas brotinho, combo de esfihas",
          "2 pizzas grandes ou pizza + entrada",
          "Combinado de sushi familiar",
          "Combos de esfihas/salgados em quantidade",
          "Porções pra dividir + bebida opcional"
        ],
        "regras": [
          {
            "t": "",
            "txt": "Disponível em todas as categorias"
          },
          {
            "t": "",
            "txt": "Vale pra todas as formas de pagamento"
          },
          {
            "t": "",
            "txt": "Também aparece no Eugênio"
          },
          {
            "t": "",
            "txt": "Importante: para operações não investidas"
          },
          {
            "t": "",
            "txt": "Argumento de \"pedir em galera\" — combo é pra grupo"
          }
        ],
        "dica": "Combão é o \"Combos Coca-Cola\" sem amarra de marca — mesma lógica de pedir em galera, você decide a bebida (ou pode nem ter)."
      },
      {
        "id": "2026-09-crm-independencia",
        "titulo": "CRM: Independência",
        "tipo": "crm",
        "inicio": "2026-09-07",
        "fim": "2026-09-07",
        "escopo": "Nacional",
        "resumo": "Segunda 07/09 — feriado da Independência. Muita gente em casa e folga: bom dia pra almoço em família e combo pra galera.",
        "disparos": [
          {
            "hora": "11:30",
            "tipo": "Almoço pico",
            "desc": "Push de feriado — almoço em casa, combo pra galera e Combos Coca-Cola."
          },
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push de jantar do feriado — reforça Promo Turbinada e Mais Vendidos."
          }
        ]
      },
      {
        "id": "2026-09-crm-abre-cliente",
        "titulo": "CRM: Abre Semana do Cliente (esquenta)",
        "tipo": "crm",
        "inicio": "2026-09-08",
        "fim": "2026-09-08",
        "escopo": "Nacional",
        "resumo": "Terça 08/09 — abre o esquenta da Semana do Cliente (nacional). Anuncia os 7 dias de promo a partir de 15% off e a entrega grátis.",
        "disparos": [
          {
            "hora": "12:00",
            "tipo": "Almoço",
            "desc": "Push almoço — \"começou o E$quenta do Cliente\" a partir de 15% off. Chama pro carrossel."
          },
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push principal — prévia da semana + entrega grátis acima do valor mínimo."
          }
        ]
      },
      {
        "id": "2026-09-crm-dia-cliente",
        "titulo": "CRM: Dia do Cliente + Live",
        "tipo": "crm",
        "inicio": "2026-09-15",
        "fim": "2026-09-15",
        "escopo": "Nacional",
        "resumo": "Terça 15/09 — pico do mês (nacional, inclusive RS). Triplo disparo com o agradecimento, os 30% off e a chamada pra live.",
        "disparos": [
          {
            "hora": "11:30",
            "tipo": "Almoço pico",
            "desc": "Push principal — \"hoje é seu dia\" no almoço, com o carro-chefe a 30% off."
          },
          {
            "hora": "17:00",
            "tipo": "Tarde",
            "desc": "Push complementar — lembrete de que a oferta vai só até o fim do dia + chamada pra live."
          },
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push de jantar — última janela pra aproveitar o Dia do Cliente e a live nas operações."
          }
        ]
      },
      {
        "id": "2026-09-crm-abre-gaucho",
        "titulo": "CRM: Abre Semana do Gaúcho (RS)",
        "tipo": "crm",
        "inicio": "2026-09-16",
        "fim": "2026-09-16",
        "escopo": "Só RS",
        "resumo": "Quarta 16/09 — abre a Semana do Gaúcho no RS, emendando no Dia do Cliente. Cupons temáticos (GAUCHO, GAUDERIO, PAMPA) e comidas típicas.",
        "disparos": [
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push RS — \"loco de boa\": começou a Semana do Gaúcho, xis e típicas a partir de 15% off."
          }
        ]
      },
      {
        "id": "2026-09-crm-dia-gaucho",
        "titulo": "CRM: Dia do Gaúcho (RS)",
        "tipo": "crm",
        "inicio": "2026-09-20",
        "fim": "2026-09-20",
        "escopo": "Só RS",
        "resumo": "Domingo 20/09 — pico da Semana do Gaúcho, só nas operações do RS (feriado da Revolução Farroupilha).",
        "disparos": [
          {
            "hora": "11:30",
            "tipo": "Almoço pico",
            "desc": "Push RS — \"Dia do Gaúcho\": xis e churrasco com 30% off no almoço de domingo."
          },
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push RS de jantar — reforço do xis com desconto forte."
          }
        ]
      },
      {
        "id": "2026-09-crm-fim-mes",
        "titulo": "CRM: Fim de mês",
        "tipo": "crm",
        "inicio": "2026-09-28",
        "fim": "2026-09-28",
        "escopo": "Nacional",
        "resumo": "Segunda 28/09 — comunicação de fim de mês, engajar a base pra outubro (Dia das Crianças chegando).",
        "disparos": [
          {
            "hora": "19:00",
            "tipo": "Jantar pico",
            "desc": "Push genérico de fim de mês — carrossel Combão + Mais Vendidos."
          }
        ]
      },
      {
        "id": "2026-09-dia-independencia",
        "titulo": "Independência do Brasil",
        "tipo": "especial",
        "inicio": "2026-09-07",
        "fim": "2026-09-07",
        "escopo": "Nacional",
        "resumo": "Segunda 07/09 — feriado da Independência. Dia de folga e gente em casa: bom fluxo de almoço e jantar em família.",
        "dica": "Trata como fim de semana: escala reforçada, combo pra galera em destaque e Promo Turbinada no ar. Post leve nas redes celebrando a data."
      },
      {
        "id": "2026-09-dia-cliente",
        "titulo": "Dia do Cliente",
        "tipo": "especial",
        "inicio": "2026-09-15",
        "fim": "2026-09-15",
        "escopo": "Nacional",
        "resumo": "Terça 15/09 — maior data de agradecimento do varejo. Pico de tráfego do mês com 30% off (nacional, inclusive RS) e encerramento com live nas operações.",
        "dica": "Operação plus na terça: app abastecido, carrossel no ar desde o esquenta e desconto agressivo no carro-chefe. É o dia de reativar quem sumiu — e fecha com live."
      },
      {
        "id": "2026-09-dia-gaucho",
        "titulo": "Dia do Gaúcho (RS)",
        "tipo": "especial",
        "inicio": "2026-09-20",
        "fim": "2026-09-20",
        "escopo": "Só RS",
        "resumo": "Domingo 20/09 — Revolução Farroupilha, feriado no RS. Pico da Semana do Gaúcho, com 30% off em xis e churrasco.",
        "dica": "Só RS: escala reforçada de domingo, xis e churrasco em destaque no carrossel. Clima de Semana Farroupilha na comunicação."
      },
      {
        "id": "2026-09-inicio-primavera",
        "titulo": "Início da Primavera",
        "tipo": "especial",
        "inicio": "2026-09-23",
        "fim": "2026-09-23",
        "escopo": "Nacional",
        "resumo": "Quarta 23/09 — começo da primavera. Estação puxa pratos mais leves, sorvete, açaí e sobremesas geladas.",
        "dica": "Ativação de comunicação: destaque sorvete, açaí, sucos e pratos leves. Combina com Baratíssimo no almoço. Sem cadastro extra."
      },
      {
        "id": "2026-09-conteudo-pede-rango",
        "titulo": "Pede rango e assiste",
        "tipo": "social",
        "inicio": "2026-09-06",
        "fim": "2026-09-06",
        "escopo": "Nacional",
        "resumo": "Domingo 06/09 — pauta de conteúdo pras redes. Clima de domingo: pedir um rango e maratonar série/filme.",
        "dica": "Post/story leve de fim de semana. Sem cadastro nem oferta — é só conteúdo de rede social."
      },
      {
        "id": "2026-09-conteudo-hot-dog",
        "titulo": "Dia do Hot Dog",
        "tipo": "social",
        "inicio": "2026-09-09",
        "fim": "2026-09-09",
        "escopo": "Nacional",
        "resumo": "Quarta 09/09 — Dia do Hot Dog. Pauta de conteúdo pras redes.",
        "dica": "Post/story celebrando o hot dog. Sem cadastro nem oferta — é só conteúdo de rede social."
      },
      {
        "id": "2026-09-conteudo-milkshake",
        "titulo": "Dia do Milkshake",
        "tipo": "social",
        "inicio": "2026-09-10",
        "fim": "2026-09-10",
        "escopo": "Nacional",
        "resumo": "Quinta 10/09 — Dia do Milkshake. Pauta de conteúdo pras redes.",
        "dica": "Post/story com aquele close no milkshake. Sem cadastro nem oferta — é só conteúdo de rede social."
      },
      {
        "id": "2026-09-conteudo-sorvete",
        "titulo": "Dia do Sorvete",
        "tipo": "social",
        "inicio": "2026-09-23",
        "fim": "2026-09-23",
        "escopo": "Nacional",
        "resumo": "Quarta 23/09 — Dia do Sorvete, no comecinho da primavera. Pauta de conteúdo pras redes.",
        "dica": "Post/story de sorvete casando com a chegada da primavera. Sem cadastro nem oferta — é só conteúdo de rede social."
      }
    ]
  }
};
