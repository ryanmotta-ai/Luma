/**
 * js/core/ai/ai-telemetry.js
 *
 * Telemetria local da Camada de IA.
 * Registra latência, sucesso/falha, fallbacks e taxa de aceite das sugestões
 * sem expor dados sensíveis ou sobrecarregar a rede.
 */

(function(){
  'use strict';

  const _EVENT_BUFFER_LIMIT = 50;
  const _eventBuffer = [];
  const _listeners = new Set();

  const VALID_EVENTS = new Set([
    'ai_request_started',
    'ai_request_success',
    'ai_request_failed',
    'ai_suggestion_accepted',
    'ai_suggestion_rejected',
    'ai_fallback_used'
  ]);

  const gAiTelemetry = {
    emit: function(eventName, data){
      if (!VALID_EVENTS.has(eventName)) return;

      const record = {
        event: eventName,
        task: data && data.task ? String(data.task) : 'unknown',
        latencyMs: data && typeof data.latencyMs === 'number' ? data.latencyMs : null,
        cached: !!(data && data.cached),
        model: data && data.model ? String(data.model) : null,
        reason: data && data.reason ? String(data.reason).slice(0, 160) : null,
        confidence: data && data.confidence ? String(data.confidence) : null,
        ts: Date.now()
      };

      if (_eventBuffer.length >= _EVENT_BUFFER_LIMIT) {
        _eventBuffer.shift();
      }
      _eventBuffer.push(record);

      // Notifica listeners locais (diagnóstico / CLI)
      _listeners.forEach(fn => {
        try { fn(record); } catch(e){}
      });

      // Integração com o canal global de métricas do Luma, se existir
      if (typeof window.gTrackEvent === 'function') {
        try {
          window.gTrackEvent(eventName, {
            task: record.task,
            latency_ms: record.latencyMs,
            cached: record.cached,
            model: record.model,
            reason: record.reason,
            confidence: record.confidence
          });
        } catch(e){}
      }
    },

    getRecent: function(limit){
      const n = typeof limit === 'number' ? Math.max(1, limit) : _EVENT_BUFFER_LIMIT;
      return _eventBuffer.slice(-n);
    },

    getStats: function(){
      let total = 0, success = 0, failed = 0, cached = 0, fallbacks = 0;
      let accepted = 0, rejected = 0;
      let totalLatency = 0, latencyCount = 0;

      for (let i = 0; i < _eventBuffer.length; i++) {
        const ev = _eventBuffer[i];
        if (ev.event === 'ai_request_started') total++;
        if (ev.event === 'ai_request_success') {
          success++;
          if (ev.latencyMs !== null) {
            totalLatency += ev.latencyMs;
            latencyCount++;
          }
          if (ev.cached) cached++;
        }
        if (ev.event === 'ai_request_failed') failed++;
        if (ev.event === 'ai_fallback_used') fallbacks++;
        if (ev.event === 'ai_suggestion_accepted') accepted++;
        if (ev.event === 'ai_suggestion_rejected') rejected++;
      }

      return {
        totalRequests: total,
        successCount: success,
        failedCount: failed,
        cachedCount: cached,
        fallbackCount: fallbacks,
        acceptedCount: accepted,
        rejectedCount: rejected,
        avgLatencyMs: latencyCount ? Math.round(totalLatency / latencyCount) : 0
      };
    },

    subscribe: function(fn){
      if (typeof fn === 'function') {
        _listeners.add(fn);
        return () => _listeners.delete(fn);
      }
      return () => {};
    },

    clear: function(){
      _eventBuffer.length = 0;
    }
  };

  window.gAiTelemetry = gAiTelemetry;
})();
