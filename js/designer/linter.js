/**
 * js/designer/linter.js
 *
 * Design System Linter & Auditor de Layout do Luma Designer.
 * Varre as camadas em busca de erros estéticos, Safe Zones e otimizações de performance.
 */

/* ══ TESTE DE ESTRESSE — "com 32 caracteres, o produto invade o preço" ══
   O `maxLen` limita CARACTERE; o layout quebra em PIXEL. O designer autoriza 32 caracteres no
   campo e não tem como saber, olhando a prancheta com os valores de exemplo, que aos 32 o
   título encosta no preço. Isso só aparecia quando a arte já estava publicada e o franqueado
   reclamava — tarde demais.
   Aqui a arte é montada com o texto MAIS LONGO que o franqueado pode digitar (`gStressValues`)
   sobre a geometria ORIGINAL. O checklist audita o contrato que o designer publicou, mas não
   executa nem oferece o Auto-layout — a acomodação é exclusiva do runtime do franqueado.
   ⚠ Só acusa par que NÃO se sobrepõe no estado de exemplo: selo atrás de texto é desenho do
   designer, não estrago do franqueado. Precisão acima de recall — é a doutrina do checklist. */
function _dLinterEstresse() {
  const out = [];
  if (typeof gApplyRelativeAnchors !== 'function' || typeof gStressValues !== 'function') return out;
  if (typeof gInkRect !== 'function' || typeof dSimUsedVars !== 'function') return out;
  /* No assistente de publicação, o limite que vale é o que o designer acabou de escolher
     ali — não o maxLen antigo de dVars. Campo travado não recebe valor arbitrário do
     franqueado e, portanto, não deve gerar um falso pior caso. */
  const linterAlvo=document.getElementById('d-linter-issues');
  /* dPublishOpen renderiza o modal um instante ANTES de adicionar `.open`; o alvo dentro do
     modal é a prova confiável de que estamos auditando a publicação, sem reaproveitar
     permissões antigas no checklist lateral do Estúdio. */
  const pubAberto=!!(linterAlvo&&linterAlvo.closest('#d-publish-modal')
    &&typeof dPubPermissoes!=='undefined');
  const varsTeste=(dVars||[]).map(v=>{
    const p=pubAberto&&dPubPermissoes&&dPubPermissoes[v.name];
    return p?Object.assign({},v,{maxLen:p.maxLen>0?Number(p.maxLen):0,_pubEdit:p.edit!==false})
            :Object.assign({},v,{_pubEdit:true});
  });
  const usados = dSimUsedVars().filter(vn => {
    const v = varsTeste.find(x => x.name === vn);
    if(v&&v._pubEdit===false)return false;
    return !v || v.type !== 'image';
  });
  if (!usados.length) return out;

  const ab = (typeof dGetActiveAB === 'function') ? dGetActiveAB() : null;
  const base = DFMT_SIZES[dFmt] || DFMT_SIZES.story;
  const cv = { w: (ab && ab.w) || base.w, h: (ab && ab.h) || base.h };
  const defaults = (typeof gVarDefaults === 'function') ? gVarDefaults() : null;

  // Audita a arte DESENHADA, sem a acomodação exclusiva do runtime do franqueado.
  const montar = (dados) => {
    const r = gApplyRelativeAnchors(dLayers.map(l => ({...l})), dados, defaults);
    const cx = document.createElement('canvas').getContext('2d');
    const mapa = {};
    r.forEach(l => {
      if (l.visible === false) return;
      let f = l._fit;
      if (l.type === 'text' && !f) {
        let t = l.content || '';
        if (l.isVar || /\{\{/.test(t)) t = gInterpolate(t, dados, { defaults });
        f = gFitTextLayer(l, t, cx);
      }
      mapa[l.id] = { l, f, r: gInkRect(l, f) };
    });
    return mapa;
  };

  const exemplo = {};
  usados.forEach(vn => { exemplo[vn] = gFieldSampleValue(varsTeste.find(x => x.name === vn) || { name: vn }); });
  const estresse = Object.assign({},exemplo,gStressValues(usados,varsTeste));
  const antes = montar(exemplo);
  const depois = montar(estresse);

  // Quais campos entram no aviso e com quantos caracteres — é o número que o designer controla.
  const limites = usados.map(vn => {
    const v = varsTeste.find(x => x.name === vn);
    return { vn, label: (v && (v.label || v.name)) || vn, n: (v && v.maxLen > 0) ? v.maxLen : 0 };
  });
  const camposDa = (l) => limites.filter(x => String(l.content || '').includes('{{' + x.vn + '}}'));
  const comLimite = (l) => {
    const cs = camposDa(l);
    const cn = cs.filter(c => c.n > 0);
    if (cn.length === 1) return `com ${cn[0].n} caracteres em “${cn[0].label}”`;
    if (cn.length > 1) return `no limite dos campos ${cn.map(c => '“' + c.label + '”').join(' e ')}`;
    return 'com um texto longo';
  };
  const nome = (l) => l.name || l.id;
  const cruza = (a, b) => {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox <= 2 || oy <= 2) return 0;
    return (ox * oy) / Math.max(1, Math.min(a.w * a.h, b.w * b.h));
  };

  const textos = Object.values(depois).filter(o => o.l.type === 'text');
  const jaVisto = new Set();

  // (a) colisão: dois textos que não se tocavam no exemplo e se sobrepõem no pior caso
  for (let i = 0; i < textos.length; i++) {
    for (let j = i + 1; j < textos.length; j++) {
      const A = textos[i], B = textos[j];
      const antesA = antes[A.l.id], antesB = antes[B.l.id];
      if (!antesA || !antesB) continue;
      if (cruza(antesA.r, antesB.r) > 0.02) continue;         // já se sobrepunham no desenho
      if (cruza(A.r, B.r) < 0.04) continue;                   // roçar de 2px não é invasão
      // Quem é o culpado: o que tem campo com limite (o texto que cresceu).
      const culpado = camposDa(A.l).length ? A : (camposDa(B.l).length ? B : A);
      const vitima  = (culpado === A) ? B : A;
      const chave = 'col:' + culpado.l.id + '>' + vitima.l.id;
      if (jaVisto.has(chave)) continue;
      jaVisto.add(chave);
      out.push({
        type: 'warning',
        title: 'O pior caso não cabe',
        desc: `${comLimite(culpado.l)}, “${nome(culpado.l)}” invade “${nome(vitima.l)}”. É um texto que o franqueado pode digitar hoje. Reduza o limite do campo ou aumente a caixa.`,
        layerId: culpado.l.id,
        layerName: culpado.l.name
      });
    }
  }

  // (b) o texto saiu da prancheta — nos QUATRO lados. O eixo X importa porque point text não
  //     quebra linha: um nome de produto longo simplesmente corre para fora da arte.
  const _fugas = (rr) => {
    const f = [];
    if (rr.y < -2) f.push('pelo topo');
    if (rr.y + rr.h > cv.h + 2) f.push('pelo pé');
    if (rr.x < -2) f.push('pela esquerda');
    if (rr.x + rr.w > cv.w + 2) f.push('pela direita');
    return f;
  };
  Object.values(depois).forEach(o => {
    if (o.l.type !== 'text' || !camposDa(o.l).length) return;
    const antesO = antes[o.l.id];
    if (!antesO) return;
    const jaEscapava = new Set(_fugas(antesO.r));             // sangra por desenho
    const saiu = _fugas(o.r).filter(f => !jaEscapava.has(f));
    if (!saiu.length) return;
    // Point text não quebra nem encolhe sozinho: o conserto é outro, e vale dizer qual.
    const conserto = (o.l.textBox !== 'box' && saiu.some(f => /esquerda|direita/.test(f)))
      ? 'Esta camada é texto de ponto: ela não quebra linha nem reduz a fonte sozinha. Transforme em caixa de parágrafo ou reduza o limite do campo.'
      : 'Reduza o limite do campo ou dê mais espaço ao bloco.';
    out.push({
      type: 'warning',
      title: 'O pior caso não cabe',
      desc: `${comLimite(o.l)}, “${nome(o.l)}” sai da arte ${saiu.join(' e ')}. ${conserto}`,
      layerId: o.l.id,
      layerName: o.l.name
    });
  });

  // (c) nem encolhendo até o piso coube na própria caixa
  Object.values(depois).forEach(o => {
    if (o.l.type !== 'text' || !o.f || !o.f.estourou || !camposDa(o.l).length) return;
    if (antes[o.l.id] && antes[o.l.id].f && antes[o.l.id].f.estourou) return;   // já estourava
    out.push({
      type: 'warning',
      title: 'O pior caso não cabe',
      desc: `${comLimite(o.l)}, “${nome(o.l)}” não cabe na caixa nem reduzindo a fonte até o limite da hierarquia. O texto sairia cortado ou espremido.`,
      layerId: o.l.id,
      layerName: o.l.name
    });
  });

  return out;
}

function dRunLinter() {
  const container = document.getElementById('d-linter-issues');
  if (!container) return [];
  
  if (!dLayers || dLayers.length === 0) {
    container.innerHTML = `
      <div class="dl-empty" role="status">
        <span class="dl-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><path d="m9 15 3-3m0 0 3-3m-3 3 3 3m-3-3L9 9"/></svg>
        </span>
        <strong>Nada para revisar ainda</strong>
        <span>Adicione uma camada à prancheta para iniciar a análise.</span>
      </div>`;
    return [];
  }
  
  const issues = [];
  const _ab = (typeof dGetActiveAB === 'function') ? dGetActiveAB() : null;
  const isStory = _ab ? (_ab.w === 1080 && _ab.h === 1920) : (dFmt === 'story');
  
  dLayers.forEach(l => {
    if (!l.visible) return; // ignora ocultas para evitar falsos positivos
    
    // 1. ERRO CRÍTICO: Preço Riscado Órfão
    const hasPrecoDe = l.id === 'precoDe' || (l.content && l.content.includes('{{precoDe}}'));
    if (hasPrecoDe) {
      // Verifica se existe alguma regra condicional que oculte a camada se precoDe for vazio
      const hasCondition = dLayers.some(other => 
        other.rules && other.rules.some(r => r && r.var === 'precoDe' && r.when === 'empty' && r.then === 'hide')
      );
      if (!hasCondition) {
        issues.push({
          type: 'error',
          title: 'Preço Riscado Órfão',
          desc: 'Se o franqueado não oferecer desconto, o preço original continuará aparecendo na arte final. Adicione uma regra condicional para ocultar esta camada quando precoDe estiver vazio.',
          layerId: l.id,
          layerName: l.name,
          autoFix: 'addHideRule',
          autoFixParam: 'precoDe'
        });
      }
    }
    
    // 2. ERRO CRÍTICO: R$ Duplicado
    if (l.type === 'text' && l.content) {
      // Procura por termos como "R$ {{precoPor}}" ou "R$ {{precoDe}}"
      const currencyMatches = l.content.matchAll(/R\$\s*\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
      for (const m of currencyMatches) {
        const varName = m[1];
        const v = dVars.find(x => x.name === varName);
        if (v && (v.type === 'currency' || v.type === 'number')) {
          issues.push({
            type: 'error',
            title: 'Prefixo R$ Duplicado',
            desc: `A caixa de texto contém "R$ {{${varName}}}" fixo no design, mas a variável já está configurada como formato financeiro (que injeta "R$" automaticamente). Remova o "R$" fixo da camada de texto.`,
            layerId: l.id,
            layerName: l.name,
            autoFix: 'removeRsPrefix',
            autoFixParam: varName
          });
        }
      }
    }
    
    // 3. ALERTA: Fora de Safe Zone no Stories (F-09)
    // `l.name` pode não existir (camada montada à mão, import antigo): sem o String() um
    // .toLowerCase() em undefined derrubava o dRunLinter inteiro — o checklist sumia da tela
    // por causa de uma camada sem nome, sem dizer por quê.
    const _nome = String(l.name || '').toLowerCase();
    if (isStory && l.type !== 'group' && _nome !== 'background' && _nome !== 'bg') {
      const isCriticalElement = l.type === 'text' || l.id === 'logo' || _nome.includes('logo') || _nome.includes('marca');
      if (isCriticalElement) {
        const topDangerZone = 250;
        const bottomDangerZone = 1920 - 250;
        const isHeaderObstructed = l.y < topDangerZone;
        const isFooterObstructed = (l.y + l.h) > bottomDangerZone;
        
        if (isHeaderObstructed) {
          issues.push({
            type: 'warning',
            title: 'Obstrução na Safe Zone Superior',
            desc: 'Esta camada está localizada nos primeiros 250px verticais. A foto de perfil e os traços de progresso do Stories do Instagram vão cobrir este conteúdo.',
            layerId: l.id,
            layerName: l.name
          });
        }
        if (isFooterObstructed) {
          issues.push({
            type: 'warning',
            title: 'Obstrução na Safe Zone Inferior',
            desc: 'Esta camada está localizada nos últimos 250px verticais. A barra de digitação de Direct e o botão de compartilhar do Stories vão cobrir este conteúdo.',
            layerId: l.id,
            layerName: l.name
          });
        }
      }
    }
    
    // 4. ALERTA: Limite Recomendado Muito Curto (Layout Estreito)
    if (l.type === 'text' && l.textBox === 'box') {
      const boundField = dLayerBoundField(l);
      const v = boundField ? dVars.find(x => x.name === boundField) : null;
      if (v) {
        const isCriticalField = ['produto', 'categoria', 'oferta', 'brinde', 'validade'].some(c => v.name.toLowerCase().includes(c));
        const recommendedLimit = gCalculateRecommendedCharLimit(l);
        if (isCriticalField && recommendedLimit < 35) {
          issues.push({
            type: 'warning',
            title: 'Caixa de Texto Estreita',
            desc: `O limite recomendado para este campo é muito curto (${recommendedLimit} car.) para nomes de produtos e validades típicos. Aumente a largura da caixa de texto ou reduza a fonte padrão para evitar que o texto encolha demais no celular do franqueado.`,
            layerId: l.id,
            layerName: l.name
          });
        }
      }
    }
    
    // 5. OTIMIZAÇÃO: Imagem Gigante
    // ⚠ Esta regra nunca disparou: testava `l.url`, mas camadas image/frame guardam a fonte em
    // `l.imgUrl` (`layers.js:382,390,408`). Regra morta desde sempre, achada na revisão pró-1.0.
    if ((l.type === 'image' || l.type === 'frame') && l.imgUrl) {
      const imgEl = document.querySelector(`[data-id="${l.id}"] img`);
      if (imgEl && imgEl.naturalWidth) {
        const originalW = imgEl.naturalWidth;
        const scale = originalW / l.w;
        if (originalW > 1800 && scale > 4) {
          issues.push({
            type: 'info',
            title: 'Imagem com Resolução Excessiva',
            desc: `A imagem tem resolução física muito grande (${originalW}px de largura) para o espaço de exibição (${Math.round(l.w)}px). Comprima a imagem para reduzir o peso da campanha.`,
            layerId: l.id,
            layerName: l.name
          });
        }
      }
    }

    /* 6. ALERTA: Texto Fixo que Deveria Ser Campo
       O ESPELHO do painel Campos. Lá o designer leva o campo até a arte; aqui o Luma aponta a
       camada que ficou cravada na mão e vai sair com o valor velho na primeira promoção nova —
       hoje isso só aparece quando o franqueado reclama.
       ⚠ PRECISÃO acima de recall: checklist que grita demais ninguém lê. Só acusa com sinal
       forte, e três filtros cortam o falso positivo clássico:
       · texto corrido (>60 car.) é disclaimer/assinatura — citar "R$" ali é normal;
       · rótulo ("Preço:", ou o texto igual ao próprio nome do campo) é legenda, não valor;
       · o nome da camada só conta quando o motor de sugestão tem CERTEZA (`auto:true`). */
    if (l.type === 'text' && l.content && !dLayerBoundField(l) && !gVarRegex().test(l.content)) {
      const txt = String(l.content).replace(/\s+/g, ' ').trim();
      if (txt && txt.length <= 60) {
        // Mesmo motor de sugestão do importador de PSD (psd-parse.js): consulta o dVars REAL
        // antes do dicionário fixo. Um segundo heurístico aqui divergiria do que o import faz.
        const sug = (typeof _dPsdSuggestVar === 'function') ? _dPsdSuggestVar(l.name, txt) : null;
        const porNome = (sug && sug.auto && dVars.some(v => v.name === sug.name)) ? sug.name : '';
        const porPreco = (/R\$\s*\d/.test(txt) && dVars.some(v => v.name === 'precoPor')) ? 'precoPor' : '';
        const alvo = porNome || porPreco;
        const v = alvo ? dVars.find(x => x.name === alvo) : null;
        const ehRotulo = !!v && (/[:：]\s*$/.test(txt)
          || String(v.label || '').toLowerCase() === txt.toLowerCase()
          || String(v.name || '').toLowerCase() === txt.toLowerCase());
        if (v && !ehRotulo) {
          issues.push({
            type: 'warning',
            title: 'Texto Fixo que Deveria Ser Campo',
            desc: `“${txt.slice(0, 40)}${txt.length > 40 ? '…' : ''}” está escrito na mão: na próxima promoção esta arte sai com o valor antigo. Ligue a camada no campo “${v.label || v.name}” — arraste o campo do painel Campos até ela, ou use o atalho aqui.`,
            layerId: l.id,
            layerName: l.name,
            autoFix: 'bindField',
            autoFixParam: alvo
          });
        }
      }
    }
  });

  // 7. O pior caso permitido pelo maxLen (roda uma vez, sobre a arte inteira)
  if (typeof _dLinterEstresse === 'function') issues.push(..._dLinterEstresse());

  if (issues.length === 0) {
    container.innerHTML = `
      <div class="dl-approved" role="status">
        <span class="dl-approved-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
        <span class="dl-approved-kicker">Revisão concluída</span>
        <strong>Layout pronto para publicar</strong>
        <span>Nenhum erro ou alerta de composição foi encontrado nesta prancheta.</span>
      </div>`;
    return issues;
  }

  const counts = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, { error: 0, warning: 0, info: 0 });
  const totalLabel = issues.length === 1 ? '1 ponto para revisar' : `${issues.length} pontos para revisar`;
  const summaryHtml = `
    <div class="dl-summary" role="status" aria-label="${totalLabel}">
      <div class="dl-summary-copy">
        <span>Resultado da análise</span>
        <strong>${totalLabel}</strong>
      </div>
      <div class="dl-summary-counts" aria-label="Contagem por severidade">
        ${counts.error ? `<span class="dl-count dl-count--error"><b>${counts.error}</b> ${counts.error === 1 ? 'erro' : 'erros'}</span>` : ''}
        ${counts.warning ? `<span class="dl-count dl-count--warning"><b>${counts.warning}</b> ${counts.warning === 1 ? 'alerta' : 'alertas'}</span>` : ''}
        ${counts.info ? `<span class="dl-count dl-count--info"><b>${counts.info}</b> ${counts.info === 1 ? 'ajuste' : 'ajustes'}</span>` : ''}
      </div>
    </div>`;

  const cardsHtml = issues.map(issue => {
    const severity = issue.type === 'error' ? 'error' : issue.type === 'warning' ? 'warning' : 'info';
    const badgeText = severity === 'error' ? 'Erro' : severity === 'warning' ? 'Alerta' : 'Otimização';
    const layerName = _dEsc(issue.layerName || 'Camada sem nome');
    const layerId = String(issue.layerId || '').replace(/'/g, '\\x27');
    const fixType = String(issue.autoFix || '').replace(/'/g, '\\x27');
    const fixParam = String(issue.autoFixParam || '').replace(/'/g, '\\x27');
    const fixBtn = issue.autoFix ? `
      <button class="dl-action dl-action--fix" onclick="dDadoLinterAutoFix('${layerId}', '${fixType}', '${fixParam}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.7 6.3 3 3M5 21l3.5-.7L19 9.8a2.1 2.1 0 0 0-3-3L5.7 17.2 5 21Z"/><path d="M12 3v4M3 12h4M5.6 5.6l2.8 2.8"/></svg>
        Corrigir
      </button>` : '';

    return `
      <article class="linter-card dl-issue dl-issue--${severity}">
        <div class="dl-issue-head">
          <span class="dl-severity"><span aria-hidden="true"></span>${badgeText}</span>
          <span class="dl-layer" title="Camada: ${layerName}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>
            ${layerName}
          </span>
        </div>
        <div class="dl-issue-body">
          <strong>${_dEsc(issue.title)}</strong>
          <p>${_dEsc(issue.desc)}</p>
        </div>
        <div class="dl-issue-actions">
          ${fixBtn}
          <button class="dl-action" onclick="dLinterFocusLayer('${layerId}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/></svg>
            Localizar
          </button>
        </div>
      </article>`;
  }).join('');

  container.innerHTML = summaryHtml + cardsHtml;
  return issues;
}

// Foca, seleciona e destaca a camada com problemas no Canvas
function dLinterFocusLayer(layerId) {
  if (typeof dSelLayer === 'function') {
    // Se o modal de publicação estiver aberto, fecha ele para liberar a visão do canvas
    const pubModal = document.getElementById('d-publish-modal');
    if (pubModal && pubModal.classList.contains('open')) {
      if (typeof dPublishClose === 'function') dPublishClose();
    }
    
    dSelLayer(layerId);
    
    // Rola e destaca visualmente no canvas
    const el = document.querySelector(`[data-id="${layerId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Efeito de pulso rápido para chamar a atenção
      el.classList.remove('rule-hover-highlight');
      void el.offsetWidth; // Força reflow
      el.classList.add('rule-hover-highlight');
      setTimeout(() => el.classList.remove('rule-hover-highlight'), 3000);
    }
  }
}

// Auto-correções automáticas
function dDadoLinterAutoFix(layerId, type, param) {
  const l = dLayers.find(x => x.id === layerId);
  if (!l) return;
  
  if (type === 'addHideRule') {
    dHistoryPush();
    if (!l.rules) l.rules = [];
    l.rules.push({
      var: param || 'precoDe',
      when: 'empty',
      then: 'hide'
    });
    gToast('Regra de ocultação condicional adicionada!');
  } 
  else if (type === 'bindField') {
    // Delega ao bind único (history, render, lista, props, unsaved e toast moram lá) — o mesmo
    // motor do arrasto e do botão "Usar". Um caminho de vínculo, três portas de entrada.
    if (typeof dLayerBindField === 'function') dLayerBindField(l.id, param);
  }
  else if (type === 'removeRsPrefix') {
    if (l.type === 'text' && l.content) {
      dHistoryPush();
      l.content = l.content.replace(new RegExp('R\\$\\s*\\{\\{\\s*' + param + '\\s*\\}\\}', 'gi'), `{{${param}}}`);
      gToast('Prefixo R$ fixo removido do texto!');
    }
  }
  
  dMarkUnsaved();
  dRenderCanvas();
  dRunLinter(); // re-analisa na hora!
  
  // Se o modal de publicação estiver aberto, atualiza ele na mesma hora
  const pubModal = document.getElementById('d-publish-modal');
  if (pubModal && pubModal.classList.contains('open')) {
    if (typeof dPublishRender === 'function') dPublishRender();
  }
  
  // Atualiza propriedades se for a selecionada
  if (dSelId === layerId && typeof dShowProps === 'function') {
    dShowProps(l);
  }
}
