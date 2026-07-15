/**
 * js/designer/linter.js
 *
 * Design System Linter & Auditor de Layout do Luma Designer.
 * Varre as camadas em busca de erros estéticos, Safe Zones e otimizações de performance.
 */

function dRunLinter() {
  const container = document.getElementById('d-linter-issues');
  if (!container) return;
  
  if (!dLayers || dLayers.length === 0) {
    container.innerHTML = '<div style="font-size:11.5px;color:var(--d-text3);padding:10px 0;text-align:center">Nenhuma camada na prancheta para analisar.</div>';
    return;
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
    if (isStory && l.type !== 'group' && l.name.toLowerCase() !== 'background' && l.name.toLowerCase() !== 'bg') {
      const isCriticalElement = l.type === 'text' || l.id === 'logo' || l.name.toLowerCase().includes('logo') || l.name.toLowerCase().includes('marca');
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
    if ((l.type === 'image' || l.type === 'frame') && l.url) {
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
  });
  
  if (issues.length === 0) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;text-align:center;gap:12px;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;color:#10b981">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span style="font-size:12px;font-weight:700;color:var(--d-text)">Layout Perfeito!</span>
        <span style="font-size:11.5px;color:var(--d-text3);line-height:1.5">Nenhum erro crítico ou de respiro foi detectado no design system da prancheta. Pronto para publicação segura.</span>
      </div>`;
    return;
  }
  
  container.innerHTML = issues.map(issue => {
    const badgeColor = issue.type === 'error' ? '#ef4444' : issue.type === 'warning' ? '#f59e0b' : '#10b981';
    const bgOpacity = issue.type === 'error' ? 'rgba(239,68,68,0.04)' : issue.type === 'warning' ? 'rgba(245,158,11,0.04)' : 'rgba(16,185,129,0.04)';
    const borderColor = issue.type === 'error' ? 'rgba(239,68,68,0.15)' : issue.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';
    const badgeText = issue.type === 'error' ? '🔴 ERRO' : issue.type === 'warning' ? '🟡 ALERTA' : '🟢 OTIMIZAR';
    
    const fixBtn = issue.autoFix ? `<button class="d-btn-sec" style="font-size:10px;padding:3px 8px;height:auto;border-color:${badgeColor};color:${badgeColor}" onclick="dDadoLinterAutoFix('${issue.layerId}', '${issue.autoFix}', '${issue.autoFixParam || ''}')">🛠 Auto-corrigir</button>` : '';
    
    return `
      <div class="linter-card" style="background:${bgOpacity};border:1px solid ${borderColor};border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;transition:transform 0.15s ease;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:9.5px;font-weight:800;color:${badgeColor};letter-spacing:0.04em;text-transform:uppercase">${badgeText}</span>
          <span style="font-size:10px;color:var(--d-text3);font-style:italic;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_dEsc(issue.layerName)}">Camada: ${_dEsc(issue.layerName)}</span>
        </div>
        <div style="font-size:11.5px;font-weight:700;color:var(--d-text);margin-top:2px;">${issue.title}</div>
        <div style="font-size:10.5px;color:var(--d-text2);line-height:1.4">${_dEsc(issue.desc)}</div>
        <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">
          <button class="d-btn-sec" style="font-size:10px;padding:3px 8px;height:auto;" onclick="dLinterFocusLayer('${issue.layerId}')">🔍 Ir para camada</button>
          ${fixBtn}
        </div>
      </div>`;
  }).join('');
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
