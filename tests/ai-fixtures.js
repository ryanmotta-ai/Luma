/**
 * tests/ai-fixtures.js
 *
 * Mock fixtures e dados sinteticos para as 8 tarefas da Camada de Inteligencia Gemini.
 * Usado para testes offline, CI e simulacoes sem consumo de cota.
 */

(function(){
  'use strict';

  const AI_FIXTURES = {
    'search.expand': {
      request: { query: 'quero um post de burger pro almoco' },
      response: {
        normalizedIntent: 'almoco com hamburguer artesanal',
        targetFormat: 'feed',
        detectedProducts: ['hamburguer', 'almoco'],
        semanticTags: ['burger', 'almoco', 'combo', 'delivery']
      }
    },

    'caption.generate': {
      request: {
        produto: 'X-Salada Especial',
        precoPor: '24,90',
        campanha: 'Festival do Burger',
        cidade: 'Santa Maria',
        formato: 'feed'
      },
      response: {
        promo: 'Bateu aquela fome? O X-Salada Especial esta saindo por apenas R$ 24,90 no app! Peca o seu e aproveite o Festival do Burger. #SantaMaria #DeliverySantaMaria #DeliveryMuch',
        engajar: 'Quem nao dispensa um lanche caprichado? Marca aqui quem vai pedir esse X-Salada com voce hoje! #SantaMaria #DeliverySantaMaria #DeliveryMuch',
        whatsapp: '*Festival do Burger no Delivery Much!*\nO X-Salada Especial esta saindo por apenas *R$ 24,90*. Corre pro app e faca seu pedido!',
        caption: 'O X-Salada Especial esta saindo por apenas R$ 24,90 no app! Peca o seu. #SantaMaria #DeliveryMuch'
      }
    },

    'copy.fit': {
      request: {
        original: 'Hamburguer Artesanal Completo com Bacon Crocante e Molho Especial',
        maxLen: 32,
        fieldName: 'produto'
      },
      response: {
        suggestions: [
          { text: 'Burger Artesanal com Bacon', preservesMeaning: true },
          { text: 'X-Bacon Artesanal Especial', preservesMeaning: true },
          { text: 'Burger Artesanal Especial', preservesMeaning: true }
        ]
      }
    },

    'content.review': {
      request: {
        fields: { produto: 'Pizza Grande', precoPor: '45,00' },
        campaign: 'Noite da Pizza',
        caption: 'Hamburguer delicioso por apenas R$ 25,00 no app!'
      },
      response: {
        issues: [
          {
            severity: 'warning',
            field: 'produto',
            message: 'A arte anuncia Pizza Grande, mas a legenda menciona Hamburguer.',
            evidence: ['Pizza Grande', 'Hamburguer']
          },
          {
            severity: 'warning',
            field: 'precoPor',
            message: 'O preco na arte e R$ 45,00, mas a legenda informa R$ 25,00.',
            evidence: ['45,00', '25,00']
          }
        ]
      }
    },

    'image.validate': {
      request: {
        fieldType: 'logo'
      },
      response: {
        valid: true,
        confidence: 'high',
        reason: 'A imagem contem um logotipo comercial com contraste adequado.',
        detectedKind: 'logo'
      }
    },

    'psd.map': {
      request: {
        allowedFields: ['produto', 'precoPor', 'precoDe', 'validade', 'foto_produto', 'logo'],
        layers: [
          { id: '0', type: 'text', name: 'Titulo Oferta', content: 'X-Burger Salada Especial' },
          { id: '1', type: 'text', name: 'Preco', content: 'R$ 29,90' },
          { id: '2', type: 'shape', name: 'Foto Sanduiche' }
        ]
      },
      response: {
        mappings: [
          { layerId: '0', suggestedField: 'produto', confidence: 'high', reason: 'Texto principal da oferta com nome do item' },
          { layerId: '1', suggestedField: 'precoPor', confidence: 'high', reason: 'Valor monetario formatado em destaque' },
          { layerId: '2', suggestedField: 'foto_produto', confidence: 'medium', reason: 'Camada de recorte para fotografia do produto' }
        ]
      }
    },

    'metadata.suggest': {
      request: {
        materialName: 'Arte 1',
        campaign: 'Promocoes de Verao',
        format: 'feed',
        texts: ['Super Combo Smash', 'R$ 19,90', 'Peca ja no Delivery Much']
      },
      response: {
        suggestedName: 'Super Combo Smash Burger',
        suggestedTags: ['smash', 'combo', 'promocao', 'hamburguer', 'delivery'],
        category: 'promocao',
        objective: 'Venda direta de combos com desconto',
        contentType: 'oferta_produto',
        products: ['Smash Burger'],
        semanticDescription: 'Oferta de combo smash burger promocional para feed.'
      }
    },

    'stress.generate': {
      request: {
        fields: [
          { name: 'produto', maxLen: 40 },
          { name: 'preco', maxLen: 12 }
        ],
        theme: 'hamburgueria e lanches'
      },
      response: {
        cases: [
          { label: 'curto', values: { produto: 'X-Burger', preco: 'R$ 19,90' } },
          { label: 'comum', values: { produto: 'X-Salada Duplo com Bacon', preco: 'R$ 28,50' } },
          { label: 'longo', values: { produto: 'Super X-Tudo Artesanal com Queijo Prato e Bacon', preco: 'R$ 49,90' } },
          { label: 'limite', values: { produto: 'Hamburguer Artesanal Prime Angus 220g Duplo Bacon', preco: 'R$ 129,00' } }
        ]
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AI_FIXTURES;
  }
  if (typeof window !== 'undefined') {
    window.AI_FIXTURES = AI_FIXTURES;
  }
})();
