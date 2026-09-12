/**
 * js/core/ai/ai-client.js
 *
 * GATEWAY ÚNICO DE IA DO LUMA (Luma Gemini Intelligence Layer) (§3, §5).
 *
 * Contrato único para todas as features:
 *   const result = await gAI.run('caption.generate', payload, opts);
 *   if (result.ok) { ... result.data ... } else { ... fallback ... }
 *
 * Nenhuma feature conhece:
 *  · URL do provedor
 *  · API Key
 *  · Headers
 *  · Nomes dos modelos
 *  · Detalhes de rede ou payloads brutos
 */

(function(){
  'use strict';

  let _activeControllers = new Map(); // requestId -> AbortController
  let _requestSequence = 0;

  function _getKey(){
    try {
      return (window.LUMA_CONFIG && window.LUMA_CONFIG.geminiApiKey)
        || window.LUMA_GEMINI_API_KEY
        || localStorage.getItem('luma_gemini_api_key')
        || '';
    } catch(e){
      return '';
    }
  }

  function _resolveModel(modelType){
    const cfg = window.AI_MODELS || {};
    if (modelType === 'vision') return cfg.vision || 'gemini-3.6-flash';
    if (modelType === 'reasoning') return cfg.reasoning || 'gemini-3.6-flash';
    if (modelType === 'embedding') return cfg.embedding || 'text-embedding-004';
    return cfg.fast || 'gemini-3.6-flash';
  }

  function _isFeatureEnabled(flagName){
    if (!flagName) return true;
    const flags = window.AI_FEATURES || {};
    return flags[flagName] !== false;
  }

  // Parser tolerante que limpa eventuais blocos ```json ... ```
  function _parseJsonSafe(text){
    if (typeof text !== 'string' || !text.trim()) return null;
    let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(s); } catch(e){}
    const i = s.search(/[[{]/);
    const j = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (i >= 0 && j > i) {
      try { return JSON.parse(s.slice(i, j + 1)); } catch(e){}
    }
    return null;
  }

  async function _callGeminiApi(model, prompt, parts, schema, signal, key){
    const corpo = {
      contents: [
        {
          parts: [{ text: prompt }].concat(parts.map(p => ({
            inlineData: { mimeType: p.mimeType, data: p.data }
          })))
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    if (schema && schema.responseSchema) {
      corpo.generationConfig.responseSchema = schema.responseSchema;
    }

    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);

    const res = await fetch(endpoint, {
      method: 'POST',
      signal: signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });

    return res;
  }

  const gAI = {
    isReady: function(task){
      const key = _getKey();
      if (!key) return false;
      if (!task) return true;
      const reg = window.gAiRegistry && window.gAiRegistry.get(task);
      if (reg && reg.featureFlag && !_isFeatureEnabled(reg.featureFlag)) {
        return false;
      }
      return true;
    },

    isFeatureEnabled: function(flagName){
      return _isFeatureEnabled(flagName);
    },

    abort: function(identifier){
      if (typeof identifier === 'string' && _activeControllers.has(identifier)) {
        const c = _activeControllers.get(identifier);
        c.abort();
        _activeControllers.delete(identifier);
        return true;
      }
      // Se chamado sem id, aborta todas as chamadas ativas
      if (!identifier) {
        _activeControllers.forEach(c => c.abort());
        _activeControllers.clear();
        return true;
      }
      return false;
    },

    run: async function(task, payload, opts){
      opts = opts || {};
      const t0 = Date.now();
      const requestId = 'req_' + (++_requestSequence) + '_' + Date.now();
      const reg = window.gAiRegistry ? window.gAiRegistry.get(task) : null;

      // 1. Guarda de Feature Flag (§14)
      if (reg && reg.featureFlag && !_isFeatureEnabled(reg.featureFlag)) {
        if (window.gAiTelemetry) {
          window.gAiTelemetry.emit('ai_fallback_used', { task, reason: 'feature_disabled' });
        }
        return {
          ok: false,
          fallback: true,
          error: 'feature_disabled',
          meta: { task, requestId, cached: false, latencyMs: 0 }
        };
      }

      // 2. Guarda de Chave / Autenticação
      const key = _getKey();
      if (!key) {
        if (window.gAiTelemetry) {
          window.gAiTelemetry.emit('ai_fallback_used', { task, reason: 'missing_key' });
        }
        return {
          ok: false,
          fallback: true,
          error: 'missing_key',
          meta: { task, requestId, cached: false, latencyMs: 0 }
        };
      }

      // 3. Cache por tarefa (§12)
      const ttl = typeof opts.ttl === 'number' ? opts.ttl : (reg ? reg.defaultTtl : 0);
      const cacheKey = (window.gAiCache && ttl > 0 && opts.cache !== false)
        ? window.gAiCache.makeKey(task, payload)
        : null;

      if (cacheKey && window.gAiCache) {
        const cachedVal = window.gAiCache.get(task, cacheKey);
        if (cachedVal !== null) {
          if (window.gAiTelemetry) {
            window.gAiTelemetry.emit('ai_request_success', { task, latencyMs: 0, cached: true });
          }
          return {
            ok: true,
            data: cachedVal,
            meta: { task, requestId, cached: true, latencyMs: 0 }
          };
        }
      }

      // 4. Concorrência e AbortController (§11, §64)
      const ctrl = new AbortController();
      _activeControllers.set(requestId, ctrl);
      if (opts.callerController && typeof opts.callerController.abort === 'function') {
        // Vincula abort externo
        opts.callerController.signal.addEventListener('abort', () => ctrl.abort());
      }

      const timeoutMs = opts.timeoutMs || 45000;
      const timeoutTimer = setTimeout(() => ctrl.abort(), timeoutMs);

      const model = _resolveModel(reg ? reg.modelType : 'fast');
      const built = reg ? reg.build(payload) : { prompt: String(payload || ''), parts: [] };
      const schema = window.gAiSchemas ? window.gAiSchemas.get(task) : null;

      if (window.gAiTelemetry) {
        window.gAiTelemetry.emit('ai_request_started', { task, model });
      }

      try {
        let res = null;
        let attempt = 0;
        const maxAttempts = opts.retry === false ? 1 : 2; // Máximo 1 retry transitório (§10)

        while (attempt < maxAttempts) {
          attempt++;
          try {
            res = await _callGeminiApi(model, built.prompt, built.parts, schema, ctrl.signal, key);
            // Se recebeu 503 (High Demand) ou erro de rede transitório, tenta 1x com backoff
            if (res.status === 503 && attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, 1200));
              continue;
            }
            break;
          } catch(netErr) {
            if (netErr.name === 'AbortError') throw netErr;
            if (attempt >= maxAttempts) throw netErr;
            await new Promise(r => setTimeout(r, 1200));
          }
        }

        if (!res || !res.ok) {
          const status = res ? res.status : 0;
          const errDetail = res ? await res.text().catch(() => '') : 'no_response';
          console.warn(`[gAI] Chamada para '${task}' falhou com status ${status}:`, errDetail.slice(0, 160));

          if (window.gAiTelemetry) {
            window.gAiTelemetry.emit('ai_request_failed', { task, reason: 'http_' + status, model });
            window.gAiTelemetry.emit('ai_fallback_used', { task, reason: 'http_' + status });
          }

          return {
            ok: false,
            fallback: true,
            error: 'http_error_' + status,
            meta: { task, requestId, latencyMs: Date.now() - t0, cached: false, model }
          };
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsedJson = _parseJsonSafe(rawText);

        if (!parsedJson) {
          console.warn(`[gAI] Resposta para '${task}' não gerou JSON válido:`, rawText.slice(0, 100));
          if (window.gAiTelemetry) {
            window.gAiTelemetry.emit('ai_request_failed', { task, reason: 'json_parse_error', model });
            window.gAiTelemetry.emit('ai_fallback_used', { task, reason: 'json_parse_error' });
          }
          return {
            ok: false,
            fallback: true,
            error: 'json_parse_error',
            meta: { task, requestId, latencyMs: Date.now() - t0, cached: false, model }
          };
        }

        // 5. Validação Determinística do Luma (§7, §62)
        const validated = window.gAiSchemas
          ? window.gAiSchemas.validate(task, parsedJson, payload)
          : { ok: true, data: parsedJson };

        if (!validated.ok) {
          console.warn(`[gAI] Validação Luma reprovou saída para '${task}':`, validated.error);
          if (window.gAiTelemetry) {
            window.gAiTelemetry.emit('ai_request_failed', { task, reason: validated.error || 'schema_validation_failed', model });
            window.gAiTelemetry.emit('ai_fallback_used', { task, reason: 'schema_validation_failed' });
          }
          return {
            ok: false,
            fallback: true,
            error: validated.error || 'schema_validation_failed',
            meta: { task, requestId, latencyMs: Date.now() - t0, cached: false, model }
          };
        }

        // 6. Gravação em Cache (§12)
        if (cacheKey && window.gAiCache && ttl > 0) {
          window.gAiCache.set(task, cacheKey, validated.data, ttl);
        }

        const latency = Date.now() - t0;
        if (window.gAiTelemetry) {
          window.gAiTelemetry.emit('ai_request_success', { task, latencyMs: latency, cached: false, model });
        }

        return {
          ok: true,
          data: validated.data,
          meta: {
            task: task,
            requestId: requestId,
            latencyMs: latency,
            cached: false,
            model: model
          }
        };

      } catch(e) {
        const isAbort = e && e.name === 'AbortError';
        const reason = isAbort ? 'timeout_or_aborted' : (e.message || 'exception');
        console.warn(`[gAI] Falha na execução da task '${task}':`, reason);

        if (window.gAiTelemetry) {
          window.gAiTelemetry.emit('ai_request_failed', { task, reason, model });
          window.gAiTelemetry.emit('ai_fallback_used', { task, reason });
        }

        return {
          ok: false,
          fallback: true,
          error: reason,
          meta: { task, requestId, latencyMs: Date.now() - t0, cached: false, model }
        };
      } finally {
        clearTimeout(timeoutTimer);
        _activeControllers.delete(requestId);
      }
    }
  };

  window.gAI = gAI;
})();
