/**
 * js/core/sound.js
 *
 * Motor de Sound Design Sintetizado (Web Audio API) do Luma.
 * Zero dependências de rede, 0 KB de arquivo MP3, latência zero (0ms).
 * Oferece feedback tátil elegante para momentos de conquista e utilidade:
 *   1. gPlayBatchCompleteSound() — Conclusão de geração em lote (Luma Sheets)
 *   2. gPlayExportSuccessSound() — Conclusão de download/exportação de arte (PNG/PDF/PSD)
 *   3. gPlayPublishSuccessSound() — Publicação de template pelo designer
 *   4. gPlayPhotoSnapSound()      — Upload & Encaixe de imagem no chat
 */

(function(){
  function _gGetAudioCtx() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  // 1. Conclusão de geração em lote (Luma Sheets) — Duplo Chime (Dó5 523Hz ➔ Sol5 784Hz)
  window.gPlayBatchCompleteSound = function() {
    try {
      const ctx = _gGetAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      [ { f: 523.25, t: 0 }, { f: 783.99, t: 0.14 } ].forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.f, now + note.t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now + note.t);

        gain.gain.setValueAtTime(0.001, now + note.t);
        gain.gain.exponentialRampToValueAtTime(0.15, now + note.t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.50);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + note.t);
        osc.stop(now + note.t + 0.55);
      });

      setTimeout(() => { try { ctx.close(); } catch (e){} }, 900);
    } catch (e) {}
  };

  // 2. Exportação Concluída / Download de Arte (Apple-style Chime Mi5 659Hz ➔ Lá5 880Hz)
  window.gPlayExportSuccessSound = function() {
    try {
      const ctx = _gGetAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      [ { f: 659.25, t: 0 }, { f: 880.00, t: 0.12 } ].forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.f, now + note.t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now + note.t);

        gain.gain.setValueAtTime(0.001, now + note.t);
        gain.gain.exponentialRampToValueAtTime(0.16, now + note.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.45);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + note.t);
        osc.stop(now + note.t + 0.50);
      });

      setTimeout(() => { try { ctx.close(); } catch (e){} }, 800);
    } catch (e) {}
  };

  // 3. Publicação de Template pelo Designer (Lá4 440Hz ➔ Dó#5 554Hz ➔ Mi5 659Hz)
  window.gPlayPublishSuccessSound = function() {
    try {
      const ctx = _gGetAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      [ { f: 440.00, t: 0 }, { f: 554.37, t: 0.10 }, { f: 659.25, t: 0.22 } ].forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.f, now + note.t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now + note.t);

        gain.gain.setValueAtTime(0.001, now + note.t);
        gain.gain.exponentialRampToValueAtTime(0.18, now + note.t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.60);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + note.t);
        osc.stop(now + note.t + 0.65);
      });

      setTimeout(() => { try { ctx.close(); } catch (e){} }, 1000);
    } catch (e) {}
  };

  // 4. Upload & Encaixe de Imagem no Chat (Photo Snap Pop — 60ms tátil)
  window.gPlayPhotoSnapSound = function() {
    try {
      const ctx = _gGetAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.05);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);

      setTimeout(() => { try { ctx.close(); } catch (e){} }, 200);
    } catch (e) {}
  };
})();
