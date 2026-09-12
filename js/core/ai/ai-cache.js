/**
 * js/core/ai/ai-cache.js
 *
 * Cache LRU em memória com TTL específico por tarefa para a Camada de IA.
 * Não polui o localStorage com dados pesados (regra de persistência da casa).
 */

(function(){
  'use strict';

  const _DEFAULT_CAP = 250;
  const _cache = new Map(); // key -> { val, exp, task, touched }

  function _hashStr(str){
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash >>> 0).toString(36);
  }

  function _canonicalJson(obj){
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(_canonicalJson).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + _canonicalJson(obj[k])).join(',') + '}';
  }

  const gAiCache = {
    makeKey: function(task, payload){
      try {
        const canonical = _canonicalJson(payload);
        return task + ':' + _hashStr(canonical);
      } catch(e){
        return task + ':' + Date.now();
      }
    },

    get: function(task, key){
      if (!key) return null;
      const entry = _cache.get(key);
      if (!entry) return null;
      if (entry.exp > 0 && Date.now() > entry.exp){
        _cache.delete(key);
        return null;
      }
      entry.touched = Date.now();
      return entry.val;
    },

    set: function(task, key, val, ttlMs){
      if (!key || val === undefined) return;
      if (ttlMs <= 0) return; // TTL zero ou negativo não cacheia

      if (_cache.size >= _DEFAULT_CAP) {
        // Poda o item mais antigo / menos recentemente tocado
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [k, item] of _cache.entries()) {
          if (item.exp > 0 && Date.now() > item.exp) {
            oldestKey = k;
            break;
          }
          if (item.touched < oldestTime) {
            oldestTime = item.touched;
            oldestKey = k;
          }
        }
        if (oldestKey) _cache.delete(oldestKey);
      }

      _cache.set(key, {
        val: val,
        exp: ttlMs ? (Date.now() + ttlMs) : 0,
        task: task,
        touched: Date.now()
      });
    },

    has: function(task, key){
      return gAiCache.get(task, key) !== null;
    },

    clear: function(task){
      if (!task) {
        _cache.clear();
        return;
      }
      for (const [k, item] of _cache.entries()) {
        if (item.task === task) _cache.delete(k);
      }
    },

    size: function(){
      return _cache.size;
    }
  };

  window.gAiCache = gAiCache;
})();
