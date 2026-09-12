/**
 * js/core/ai/ai-schemas.js
 *
 * Schemas e Validadores Determinísticos da Camada de IA.
 * Regra §7 e §62:
 * "GEMINI SUGERE. LUMA VALIDA. HUMANO DECIDE."
 * Output estruturado pelo modelo NÃO significa semanticamente correto.
 * Todo dado retornado é auditado e higienizado antes de entrar no estado da aplicação.
 */

(function(){
  'use strict';

  // Helper para remover emojis e caracteres de controle
  function _stripEmoji(text){
    if (typeof text !== 'string') return '';
    return text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
               .replace(/[ \t]{2,}/g, ' ')
               .trim();
  }

  const SCHEMAS = {
    'caption.generate': {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          promo: { type: 'STRING', description: 'Legenda comercial com foco na oferta e no app' },
          engajar: { type: 'STRING', description: 'Legenda descontraída que incentiva comentários ou marcação' },
          whatsapp: { type: 'STRING', description: 'Mensagem para lista de transmissão no WhatsApp com *negrito*' },
          caption: { type: 'STRING', description: 'Legenda principal (caso formato simplificado)' },
          style: { type: 'STRING', enum: ['promo', 'engajar', 'whatsapp'], description: 'Estilo da legenda' },
          usedFacts: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Lista de fatos reais fornecidos no prompt que foram citados na legenda'
          },
          warnings: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Avisos sobre dados faltantes ou omissões necessárias'
          }
        }
      },
      validate: function(data, payload){
        if (!data || typeof data !== 'object') return { ok: false, error: 'payload_not_object' };
        let caption = _stripEmoji(data.caption || data.promo || '');
        let promo = _stripEmoji(data.promo || caption);
        let engajar = _stripEmoji(data.engajar || '');
        let whatsapp = _stripEmoji(data.whatsapp || '');
        if (!caption && !promo && !engajar) return { ok: false, error: 'empty_caption' };

        // Blindagem contra alucinação de preços se não informados
        const precoDe = payload && (payload.precoDe || payload.de);
        const precoPor = payload && (payload.precoPor || payload.por || payload.preco);
        const cleanPrice = (s) => {
          if (!s) return '';
          if (!precoDe && !precoPor && /R\$\s*\d+/i.test(s)) {
            return s.replace(/R\$\s*\d+([.,]\d{2})?/gi, '').replace(/\s{2,}/g, ' ').trim();
          }
          return s;
        };

        caption = cleanPrice(caption);
        promo = cleanPrice(promo);
        engajar = cleanPrice(engajar);
        whatsapp = cleanPrice(whatsapp);

        return {
          ok: true,
          data: {
            caption: caption || promo,
            promo: promo || caption,
            engajar: engajar,
            whatsapp: whatsapp,
            style: ['promo', 'engajar', 'whatsapp'].includes(data.style) ? data.style : 'promo',
            usedFacts: Array.isArray(data.usedFacts) ? data.usedFacts.map(String).slice(0, 10) : [],
            warnings: Array.isArray(data.warnings) ? data.warnings.map(String).slice(0, 5) : []
          }
        };
      }
    },

    'copy.fit': {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          suggestions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING', description: 'Texto sugerido mais curto' },
                preservesMeaning: { type: 'BOOLEAN', description: 'Indica se manteve o sentido exato do original' }
              },
              required: ['text']
            }
          }
        },
        required: ['suggestions']
      },
      validate: function(data, payload){
        if (!data || !Array.isArray(data.suggestions)) return { ok: false, error: 'invalid_suggestions_array' };
        const maxLen = payload && typeof payload.maxLen === 'number' ? payload.maxLen : Infinity;
        const original = payload && payload.original ? String(payload.original).trim() : '';

        const validSuggestions = [];
        const seen = new Set();

        data.suggestions.forEach(item => {
          if (!item || typeof item.text !== 'string') return;
          const clean = _stripEmoji(item.text).trim();
          if (!clean || clean === original || seen.has(clean)) return;
          // Não aceita sugestões que ultrapassem o maxLen estrito quando fornecido
          if (clean.length > maxLen) return;
          seen.add(clean);
          validSuggestions.push({
            text: clean,
            preservesMeaning: item.preservesMeaning !== false,
            charCount: clean.length
          });
        });

        return {
          ok: validSuggestions.length > 0,
          data: {
            suggestions: validSuggestions.slice(0, 4)
          },
          error: validSuggestions.length === 0 ? 'no_fitting_suggestion' : null
        };
      }
    },

    'content.review': {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          issues: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                severity: { type: 'STRING', enum: ['warning', 'info'] },
                field: { type: 'STRING', description: 'Nome do campo ou componente onde há suspeita' },
                message: { type: 'STRING', description: 'Explicação amigável em português do que conferir' },
                evidence: { type: 'ARRAY', items: { type: 'STRING' } }
              },
              required: ['severity', 'field', 'message']
            }
          }
        },
        required: ['issues']
      },
      validate: function(data){
        if (!data || !Array.isArray(data.issues)) return { ok: true, data: { issues: [] } };
        // Filtrar opiniões estéticas proibidas (§39)
        const aestheticWords = /(bonito|feio|contraste|fonte maior|fonte menor|hierarquia visual|layout desequilibrado|harmonia|design ruim)/i;
        const cleanIssues = [];

        data.issues.forEach(iss => {
          if (!iss || !iss.message) return;
          if (aestheticWords.test(iss.message)) return; // descarta julgamento estético
          cleanIssues.push({
            severity: iss.severity === 'warning' ? 'warning' : 'info',
            field: String(iss.field || 'geral').slice(0, 60),
            message: _stripEmoji(String(iss.message)).slice(0, 200),
            evidence: Array.isArray(iss.evidence) ? iss.evidence.map(String).slice(0, 3) : []
          });
        });

        return {
          ok: true,
          data: { issues: cleanIssues.slice(0, 5) }
        };
      }
    },

    'image.validate': {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          valid: { type: 'BOOLEAN', description: 'Se a imagem condiz com a natureza esperada do campo' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          reason: { type: 'STRING', description: 'Explicação curta e humana' },
          detectedKind: { type: 'STRING', description: 'O que a imagem parece ser (logo, produto, prato, paisagem, print, documento)' }
        },
        required: ['valid', 'confidence', 'reason']
      },
      validate: function(data, payload){
        if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_image_response' };
        const conf = ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium';
        return {
          ok: true,
          data: {
            valid: !!data.valid,
            confidence: conf,
            reason: _stripEmoji(String(data.reason || '')).slice(0, 180),
            detectedKind: String(data.detectedKind || 'desconhecido').slice(0, 50),
            expectedField: payload && payload.fieldType ? String(payload.fieldType) : 'imagem'
          }
        };
      }
    },

    'psd.map': {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          mappings: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                layerId: { type: 'STRING', description: 'ID ou índice da camada no PSD' },
                suggestedField: { type: 'STRING', description: 'Nome canônico exato do campo no catálogo' },
                confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
                reason: { type: 'STRING', description: 'Por que o elemento parece ser esse campo' }
              },
              required: ['layerId', 'suggestedField', 'confidence']
            }
          }
        },
        required: ['mappings']
      },
      validate: function(data, payload){
        if (!data || !Array.isArray(data.mappings)) return { ok: false, error: 'invalid_mappings' };
        const validFields = payload && Array.isArray(payload.allowedFields) ? new Set(payload.allowedFields) : null;
        const validLayers = payload && Array.isArray(payload.allowedLayers) ? new Set(payload.allowedLayers.map(String)) : null;

        const cleanMappings = [];
        const seenLayers = new Set();

        data.mappings.forEach(m => {
          if (!m || m.layerId === undefined || !m.suggestedField) return;
          const lid = String(m.layerId);
          const fld = String(m.suggestedField).trim();

          if (seenLayers.has(lid)) return; // 1 camada, 1 campo
          if (validLayers && !validLayers.has(lid)) return; // camada não existe
          if (validFields && !validFields.has(fld)) return; // campo desconhecido (§24)

          seenLayers.add(lid);
          cleanMappings.push({
            layerId: lid,
            suggestedField: fld,
            confidence: ['high', 'medium', 'low'].includes(m.confidence) ? m.confidence : 'medium',
            reason: _stripEmoji(String(m.reason || '')).slice(0, 120)
          });
        });

        return {
          ok: cleanMappings.length > 0,
          data: { mappings: cleanMappings }
        };
      }
    },

    'metadata.suggest': {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          suggestedName: { type: 'STRING', description: 'Nome descritivo recomendado para o material se o atual for genérico' },
          suggestedTags: { type: 'ARRAY', items: { type: 'STRING' } },
          category: { type: 'STRING' },
          objective: { type: 'STRING' },
          contentType: { type: 'STRING' },
          products: { type: 'ARRAY', items: { type: 'STRING' } },
          semanticDescription: { type: 'STRING' }
        },
        required: ['suggestedTags', 'category']
      },
      validate: function(data, payload){
        if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_metadata' };
        const allowedCategories = payload && Array.isArray(payload.allowedCategories) ? new Set(payload.allowedCategories) : null;
        let cat = String(data.category || '').trim().toLowerCase();
        if (allowedCategories && !allowedCategories.has(cat)) {
          cat = payload.defaultCategory || 'geral';
        }

        const tags = Array.isArray(data.suggestedTags)
          ? [...new Set(data.suggestedTags.map(t => _stripEmoji(String(t)).toLowerCase().trim()).filter(Boolean))].slice(0, 6)
          : [];

        const suggestedName = _stripEmoji(String(data.suggestedName || '')).slice(0, 60);

        return {
          ok: true,
          data: {
            suggestedName: suggestedName,
            suggestedTags: tags,
            category: cat,
            objective: _stripEmoji(String(data.objective || '')).slice(0, 60),
            contentType: _stripEmoji(String(data.contentType || '')).slice(0, 60),
            products: Array.isArray(data.products) ? data.products.map(p => _stripEmoji(String(p))).slice(0, 5) : [],
            semanticDescription: _stripEmoji(String(data.semanticDescription || '')).slice(0, 240)
          }
        };
      }
    },

    'stress.generate': {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          cases: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                label: { type: 'STRING', enum: ['curto', 'comum', 'longo', 'limite'] },
                values: { type: 'OBJECT', description: 'Valores para cada campo testado' }
              },
              required: ['label', 'values']
            }
          }
        },
        required: ['cases']
      },
      validate: function(data, payload){
        if (!data || !Array.isArray(data.cases)) return { ok: false, error: 'invalid_cases' };
        const allowedFields = payload && Array.isArray(payload.fieldNames) ? new Set(payload.fieldNames) : null;

        const cleanCases = [];
        data.cases.forEach(c => {
          if (!c || typeof c.values !== 'object') return;
          const cleanVals = {};
          Object.keys(c.values).forEach(k => {
            if (allowedFields && !allowedFields.has(k)) return;
            cleanVals[k] = _stripEmoji(String(c.values[k] || '')).slice(0, 120);
          });
          cleanCases.push({
            label: ['curto', 'comum', 'longo', 'limite'].includes(c.label) ? c.label : 'comum',
            values: cleanVals
          });
        });

        return {
          ok: cleanCases.length > 0,
          data: { cases: cleanCases }
        };
      }
    },

    'search.expand': {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          normalizedIntent: { type: 'STRING', description: 'Intenção resumida da busca' },
          targetFormat: { type: 'STRING', enum: ['feed', 'story', 'banner', 'none'] },
          detectedProducts: { type: 'ARRAY', items: { type: 'STRING' } },
          semanticTags: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['normalizedIntent', 'targetFormat']
      },
      validate: function(data){
        if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_search_expansion' };
        return {
          ok: true,
          data: {
            normalizedIntent: _stripEmoji(String(data.normalizedIntent || '')).slice(0, 100),
            targetFormat: ['feed', 'story', 'banner'].includes(data.targetFormat) ? data.targetFormat : null,
            detectedProducts: Array.isArray(data.detectedProducts) ? data.detectedProducts.map(p => _stripEmoji(String(p)).toLowerCase()).slice(0, 5) : [],
            semanticTags: Array.isArray(data.semanticTags) ? data.semanticTags.map(t => _stripEmoji(String(t)).toLowerCase()).slice(0, 8) : []
          }
        };
      }
    }
  };

  const gAiSchemas = {
    has: function(task){
      return !!SCHEMAS[task];
    },

    get: function(task){
      return SCHEMAS[task] || null;
    },

    validate: function(task, data, payload){
      const s = SCHEMAS[task];
      if (!s || typeof s.validate !== 'function') {
        return { ok: true, data: data }; // task sem validador rígido
      }
      return s.validate(data, payload);
    }
  };

  window.gAiSchemas = gAiSchemas;
})();
