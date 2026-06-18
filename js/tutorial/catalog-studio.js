/**
 * js/tutorial/catalog-studio.js
 *
 * Tutoriais animados adicionais (franqueado + designer/Estúdio).
 * Estende o TUTORIALS de tutorial/catalog.js via Object.assign.
 * Depende de: tutorial/catalog.js (TUTORIALS), tutorial/mocks.js, tutorial/mocks-studio.js
 */

// Helper local: cena de intro no padrão da plataforma (ícone + título + resumo).
function _tutIntro(svgPath, titulo, resumo, grad){
  const g = grad || 'linear-gradient(135deg, var(--dm-orange-bg), rgba(255,185,0,.15))';
  return `
    <div class="tut-scene-content">
      <div style="text-align:center;max-width:480px">
        <div class="tut-finale-icon" style="margin:0 auto 24px;background:${g};color:var(--dm-orange-d);animation-delay:0s">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
        </div>
        <h3 style="font-family:'Roboto',sans-serif;font-weight:900;font-size:28px;letter-spacing:.02em;margin-bottom:10px;animation:tutFinaleFadeUp .5s .2s both;opacity:0">${titulo}</h3>
        <p style="font-size:14px;color:var(--text-3);line-height:1.6;animation:tutFinaleFadeUp .5s .35s both;opacity:0">${resumo}</p>
      </div>
    </div>`;
}
// Helper: grade de linhas atalho (tecla + descrição) animadas em sequência.
function _tutKeyRows(rows){
  return `<div class="tut-scene-content"><div style="display:flex;flex-direction:column;gap:8px;width:380px">
    ${rows.map((r,i)=>`<div style="display:flex;align-items:center;gap:12px;background:#222;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 12px;opacity:0;animation:tutFinaleFadeUp .4s ${0.1+i*0.08}s both">
      <span style="min-width:90px;text-align:right">${tutKey(r[0])}</span>
      <span style="font-size:12px;color:#E8E8E8;font-family:'Roboto',sans-serif">${r[1]}</span>
    </div>`).join('')}
  </div></div>`;
}

Object.assign(TUTORIALS, {

  /* ═══════════ FRANQUEADO ═══════════ */

  'enviar-foto': {
    title: 'Como enviar a foto do produto',
    description: 'enviar e trocar a foto do produto nas suas artes.',
    scenes: [
      { id:'intro', duration:3200, tooltip:null,
        build: ()=>_tutIntro('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
          'A foto é sua', 'Quando o material tem uma moldura de foto, você sobe a imagem do SEU produto. Veja como.') },
      { id:'upload', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div class="tut-mock-upload" id="tut-ef-up">
            <div class="tut-mock-upload-icon">⬆</div>
            <div class="tut-mock-upload-title">Toque para enviar uma foto</div>
            <div class="tut-mock-upload-sub">ou arraste a imagem aqui · PNG/JPG até 4MB</div>
          </div></div>`,
        tooltip:{ text:'Toque na área de upload e escolha a foto do produto no seu aparelho.', target:'#tut-ef-up', placement:'bottom' },
        after: ()=>{ tutSceneTimeout(()=>tutMoveCursor('#tut-ef-up','click'), 1400); } },
      { id:'preview', duration:4000,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;align-items:center;gap:14px">
            <div style="position:relative;width:150px;height:150px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#C81818,#FF9000);box-shadow:0 8px 24px rgba(0,0,0,.15)">
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:38px">🍔</div>
              <div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:6px;display:flex;justify-content:space-between;align-items:center">
                <span>✓ Foto enviada</span>${tutChip('Trocar',{id:'tut-ef-trocar'})}
              </div>
            </div>
          </div></div>`,
        tooltip:{ text:'Deu certo! Se quiser, dá pra trocar a foto a qualquer momento no botão "Trocar".', target:'#tut-ef-trocar', placement:'right' } },
      { id:'dicas', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:12px">
            ${['☀️ Boa luz','🎯 Produto centralizado','🆕 Foto recente e nítida'].map((t,i)=>`<div style="width:130px;background:#fff;border:1.5px solid #f0f0f0;border-radius:10px;padding:16px 12px;text-align:center;opacity:0;animation:tutFinaleFadeUp .5s ${0.15+i*0.18}s both"><div style="font-size:26px;margin-bottom:8px">${t.split(' ')[0]}</div><div style="font-size:12px;font-weight:600;color:var(--text-2)">${t.split(' ').slice(1).join(' ')}</div></div>`).join('')}
          </div></div>`,
        tooltip:null },
    ],
  },

  'gerar-varios': {
    title: 'Gerar várias artes de uma vez (CSV)',
    description: 'gerar dezenas de artes de uma vez usando uma planilha.',
    scenes: [
      { id:'intro', duration:3200, tooltip:null,
        build: ()=>_tutIntro('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
          'Muitos produtos? Use CSV', 'Em vez de criar uma por uma, mande uma planilha: cada linha vira uma arte pronta.') },
      { id:'modelo', duration:4000,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;align-items:center;gap:16px">
            ${tutChip('⬇ Baixar modelo CSV',{primary:true,highlight:true,id:'tut-gv-modelo'})}
            <p style="font-size:12px;color:var(--text-3);max-width:300px;text-align:center;line-height:1.5">O modelo já vem com as colunas certas (os nomes das variáveis do material).</p>
          </div></div>`,
        tooltip:{ text:'Comece baixando o modelo. Ele tem uma coluna pra cada campo do material.', target:'#tut-gv-modelo', placement:'bottom' },
        after: ()=>{ tutSceneTimeout(()=>tutMoveCursor('#tut-gv-modelo','click'), 1400); } },
      { id:'preencher', duration:5000,
        build: ()=>`<div class="tut-scene-content"><div style="background:#fff;border:1.5px solid #f0f0f0;border-radius:10px;overflow:hidden;font-size:11px;font-family:'Roboto',sans-serif;width:360px" id="tut-gv-tab">
            <div style="display:flex;background:#222;color:#fff;font-weight:700"><div style="flex:1;padding:7px 10px">produto</div><div style="flex:1;padding:7px 10px">precoDe</div><div style="flex:1;padding:7px 10px">precoPor</div></div>
            ${[['Combo Smash','R$ 29,90','R$ 19,90'],['Burguer Duplo','R$ 34,90','R$ 24,90'],['Trio Festeiro','R$ 39,90','R$ 27,90']].map((r,i)=>`<div class="tut-mock-msg" data-delay="${300+i*500}" style="display:flex;border-top:1px solid #f0f0f0">${r.map(c=>`<div style="flex:1;padding:7px 10px;color:var(--text-2)">${c}</div>`).join('')}</div>`).join('')}
          </div></div>`,
        tooltip:{ text:'Preencha uma linha por produto. As colunas são os campos da arte.', target:'#tut-gv-tab', placement:'right' },
        after: ()=>{ document.querySelectorAll('#tut-gv-tab .tut-mock-msg').forEach(m=>{ tutSceneTimeout(()=>m.classList.add('show'), parseInt(m.dataset.delay)||0); }); } },
      { id:'revisar', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;gap:8px;width:320px">
            ${[['Combo Smash','ok'],['Burguer Duplo','ok'],['Trio Festeiro','err']].map(r=>`<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid ${r[1]==='err'?'var(--dm-red)':'#eee'};border-radius:8px;padding:9px 12px;font-size:12px;font-family:'Roboto',sans-serif"><span style="font-size:14px">${r[1]==='err'?'⚠️':'✅'}</span><span style="flex:1;color:var(--text)">${r[0]}</span>${r[1]==='err'?'<span style="font-size:10px;color:var(--dm-red);font-weight:700">preço inválido</span>':''}</div>`).join('')}
          </div></div>`,
        tooltip:null },
      { id:'baixar', duration:4000,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;align-items:center;gap:14px">
            ${tutChip('Baixar todos',{primary:true,highlight:true,id:'tut-gv-dl'})}
            <p style="font-size:12px;color:var(--text-3)">Gerando 3/10... a fila roda sem travar a aba.</p>
          </div></div>`,
        tooltip:{ text:'Pronto! "Baixar todos" gera os PNGs em fila. As linhas com erro são puladas.', target:'#tut-gv-dl', placement:'bottom' } },
    ],
  },

  /* ═══════════ DESIGNER / ESTÚDIO ═══════════ */

  'studio-tour': {
    title: 'Conheça o Estúdio',
    description: 'se virar dentro do editor: ferramentas, canvas, painéis e topo.',
    scenes: [
      { id:'intro', duration:3200, tooltip:null,
        build: ()=>_tutIntro('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
          'Bem-vindo ao Estúdio', 'É onde você cria os templates que os franqueados vão personalizar. Vamos dar uma volta.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'toolbar', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:120,h:160}), { tools:[{icon:'⌖',key:'V',active:true},{icon:'T',key:'T',highlight:true},{icon:'▭',key:'R'},{icon:'🖼',key:'F'},{icon:'🖌',key:'B'},{icon:'💧',key:'I'}] })}</div>`,
        tooltip:{ text:'À esquerda ficam as ferramentas de criação — cada uma tem um atalho de teclado.', target:'.tut-studio-tool.highlighted', placement:'right' } },
      { id:'canvas', duration:4000,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:130,h:175,highlight:'canvas'}), {})}</div>`,
        tooltip:{ text:'No centro é a prancheta. Você tem zoom (Ctrl +/-) e pode ter várias pranchetas.', target:'.tut-art', placement:'left' } },
      { id:'painel', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:110,h:150}), { panel: tutPanelCard('Abas do painel', 'Camadas · Campanhas<br>Dados · Biblioteca<br>Assets', true) })}</div>`,
        tooltip:{ text:'À direita: Camadas (propriedades do layer selecionado), Campanhas, Dados (campos variáveis) e Assets.', target:'.tut-panel-card.highlighted', placement:'left' } },
      { id:'topbar', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:10px;align-items:center">
            ${tutChip('💾 Salvar')}${tutChip('👁 Simular')}${tutChip('🔍 Preview')}${tutChip('🚀 Publicar',{primary:true,highlight:true,id:'tut-st-pub'})}
          </div></div>`,
        tooltip:{ text:'No topo: salvar, simular, prever e — o passo final — publicar pro franqueado.', target:'#tut-st-pub', placement:'bottom' } },
    ],
  },

  'criar-elementos': {
    title: 'Textos, formas e molduras',
    description: 'adicionar e configurar cada tipo de elemento.',
    scenes: [
      { id:'intro', duration:3000, tooltip:null,
        build: ()=>_tutIntro('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
          'Os blocos de uma arte', 'Toda arte é feita de textos, formas e molduras de foto. Veja como criar cada um.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'texto', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:120,h:160,highlight:'title'}), { tools:[{icon:'⌖',key:'V'},{icon:'T',key:'T',active:true,highlight:true},{icon:'▭',key:'R'},{icon:'🖼',key:'F'}] })}</div>`,
        tooltip:{ text:'Ferramenta Texto (T): clique no canvas e digite. Use "Inserir campo" no painel lateral para vincular uma variável ao texto.', target:'.tut-art-title', placement:'right' } },
      { id:'formas', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:120,h:160,highlight:'band'}), { tools:[{icon:'⌖',key:'V'},{icon:'T',key:'T'},{icon:'▭',key:'R',active:true,highlight:true},{icon:'🖼',key:'F'}], panel: tutPanelCard('Adicionar forma','● Círculo<br>★ Estrela<br>⬡ Polígono<br>— Linha') })}</div>`,
        tooltip:{ text:'Retângulo (R) e, no painel, círculo, estrela, polígono e linha — pra fundos, faixas e selos.', target:'.tut-art-band', placement:'right' } },
      { id:'moldura', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:120,h:160,highlight:'frame'}), { tools:[{icon:'⌖',key:'V'},{icon:'T',key:'T'},{icon:'▭',key:'R'},{icon:'🖼',key:'F',active:true,highlight:true}], panel: tutPanelCard('Moldura','Vincular a:<br>'+tutVarPill('foto_produto','imagem',true)) })}</div>`,
        tooltip:{ text:'Moldura (F) recebe a foto que o FRANQUEADO envia. Vincule à variável foto_produto.', target:'.tut-art-frame', placement:'right' } },
    ],
  },

  'editar-elementos': {
    title: 'Selecionar, mover e organizar',
    description: 'posicionar elementos com precisão.',
    scenes: [
      { id:'intro', duration:3000, tooltip:null,
        build: ()=>_tutIntro('<path d="M5 3l14 9-6 2-2 6-6-17z"/>',
          'Manipulação direta', 'Arraste, alinhe, agrupe e use as guias pra deixar tudo no lugar.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'mover', duration:4000,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:130,h:175,selected:'title'}), {})}</div>`,
        tooltip:{ text:'Clique pra selecionar; arraste pra mover; use as alças pra redimensionar. Setas movem 1px (Shift = 10px).', target:'.tut-art-selected', placement:'left' } },
      { id:'alinhar', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;align-items:center;gap:14px">
            <div style="display:flex;gap:6px">${['⬅','⬛','➡','⬆','⬜','⬇'].map(i=>tutChip(i)).join('')}</div>
            <p style="font-size:12px;color:#E8E8E8;max-width:300px;text-align:center;line-height:1.5;font-family:'Roboto',sans-serif">1 elemento alinha ao canvas. Selecione <strong>2+</strong> (Shift+clique) pra alinhar/distribuir entre eles.</p>
          </div></div>`,
        tooltip:null },
      { id:'agrupar-snap', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;align-items:center;gap:14px">
            <div>${tutKey('Ctrl+G')} <span style="color:#E8E8E8;font-size:12px;font-family:Roboto">agrupa pra mover junto</span></div>
            <div style="display:flex;gap:10px;align-items:center">${tutChip('🧲 Snap',{highlight:true,id:'tut-ee-snap'})}<span style="color:#888;font-size:11px;font-family:Roboto">guias magenta mostram a medida em px</span></div>
          </div></div>`,
        tooltip:{ text:'Snap "gruda" os elementos alinhados e mostra a distância em pixels enquanto você arrasta.', target:'#tut-ee-snap', placement:'bottom' } },
    ],
  },

  'pintura': {
    title: 'Pincel e ferramentas de pintura',
    description: 'pintar livremente sobre a arte.',
    scenes: [
      { id:'intro', duration:3000, tooltip:null,
        build: ()=>_tutIntro('<path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
          'Pintura livre', 'Além de elementos, dá pra pintar à mão na arte — com pincel, borracha e mais.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'pincel', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:110,h:150}), { tools:[{icon:'⌖',key:'V'},{icon:'🖌',key:'B',active:true,highlight:true},{icon:'🩹',key:'E'},{icon:'💧',key:'I'},{icon:'🪣',key:'G'}], panel: tutPanelCard('Pincel (B)','Tamanho · Dureza<br>Opacidade · Fluxo<br>Modo de mesclagem', true) })}</div>`,
        tooltip:{ text:'Pincel (B): a barra de opções aparece quando ele está ativo — ajuste tamanho, dureza e modo.', target:'.tut-panel-card.highlighted', placement:'left' } },
      { id:'presets', duration:4000,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:340px">${['Redondo','Suave','Quadrado','Caligrafia','Pontilhado'].map(p=>tutChip(p)).join('')}</div></div>`,
        tooltip:null },
      { id:'outras', duration:4500,
        build: ()=>_tutKeyRows([['E','Borracha — apaga o que você pintou'],['I','Conta-gotas — copia uma cor do canvas'],['G','Balde — preenche uma área'],['S','Carimbo — clona um trecho da arte']]),
        tooltip:null },
    ],
  },

  'variaveis': {
    title: 'Variáveis: o coração dos templates',
    description: 'criar os campos que o franqueado vai preencher.',
    scenes: [
      { id:'intro', duration:3200, tooltip:null,
        build: ()=>_tutIntro('<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>',
          'Tudo gira em variáveis', 'O que o franqueado preenche (produto, preço, foto...) vem das variáveis que você cria aqui.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'dados-tab', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:100,h:140}), { panel: tutPanelCard('Aba Dados', '🏷 produto · texto<br>💲 precoPor · preço<br>🖼 foto_produto · imagem<br><br>'+tutChip('+ Novo campo',{primary:true,id:'tut-var-novo'}), true) })}</div>`,
        tooltip:{ text:'Na aba "Dados" ficam todos os campos do template, organizados por categoria. Clique "+ Novo campo" para criar.', target:'.tut-panel-card.highlighted', placement:'left' },
        after: ()=>{ tutSceneTimeout(()=>tutMoveCursor('#tut-var-novo','click'), 1400); } },
      { id:'wizard', duration:5500,
        build: ()=>`<div class="tut-scene-content">
          <div style="display:flex;flex-direction:column;gap:14px;width:320px">
            <div style="background:#fff;border:1.5px solid rgba(255,144,0,.45);border-radius:10px;padding:14px;font-family:'Roboto',sans-serif">
              <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dm-orange-d);margin-bottom:10px">Passo 1 — Que tipo de campo?</div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
                ${[['🔤','Texto'],['💲','Preço'],['🖼','Imagem'],['☰','Lista'],['📅','Data'],['🎨','Cor'],['#️⃣','Número'],['🔘','Sim/Não']].map((t,i)=>`<div style="padding:8px 4px;background:${i===1?'rgba(255,144,0,.12)':'#f8f8f8'};border:1.5px solid ${i===1?'var(--dm-orange)':'#eee'};border-radius:7px;text-align:center;font-size:10px;font-weight:600;color:var(--text-2)">${t[0]}<br>${t[1]}</div>`).join('')}
              </div>
            </div>
            <div style="background:#fff;border:1.5px solid #e8e8e8;border-radius:10px;padding:14px;font-family:'Roboto',sans-serif;opacity:0;animation:tutFinaleFadeUp .4s .5s both">
              <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dm-orange-d);margin-bottom:10px">Passo 2 — Nome do campo</div>
              <input readonly value="Preço promocional" style="width:100%;border:1.5px solid var(--dm-orange);border-radius:6px;padding:8px 10px;font-size:13px;font-family:'Roboto',sans-serif;box-sizing:border-box;outline:none">
              <div style="font-size:10px;color:var(--text-3);margin-top:6px">Chave gerada automaticamente: <strong style="color:var(--text-2)">precoPor</strong></div>
            </div>
          </div></div>`,
        tooltip:{ text:'2 passos: escolha o tipo e dê um nome claro. O sistema gera a chave técnica (ex: precoPor) sozinho.', target:null, placement:'bottom' } },
      { id:'tipos', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:380px">
            ${[['🔤','texto'],['💲','preço'],['#️⃣','número'],['🖼','imagem'],['☰','lista'],['📅','data'],['🎨','cor'],['🔘','sim/não']].map((t,i)=>`<div style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:#f4f4f4;border:1px solid #e4e4e4;border-radius:20px;opacity:0;animation:tutFinaleFadeUp .4s ${0.1+i*0.07}s both"><span>${t[0]}</span><span style="font-size:12px;font-weight:600;color:var(--text-2)">${t[1]}</span></div>`).join('')}
          </div></div>`,
        tooltip:null },
      { id:'inserir', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:100,h:140,highlight:'title'}), { panel: tutPanelCard('Inserir campo no texto','Campo selecionado na lista:<br><br>'+tutChip('+ Inserir campo',{primary:true,id:'tut-var-ins'})+'<br><br>Resultado no texto:<br><span style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,110,255,.12);color:#7C6EFF;border:1px solid rgba(124,110,255,.3);border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600">[precoPor]</span>', true) })}</div>`,
        tooltip:{ text:'"Inserir campo" coloca um chip [precoPor] no texto. No PNG final, o chip vira o valor real preenchido pelo franqueado.', target:'.tut-panel-card.highlighted', placement:'left' },
        after: ()=>{ tutSceneTimeout(()=>tutMoveCursor('#tut-var-ins','click'), 1600); } },
    ],
  },

  'vinculos-regras': {
    title: 'Vínculos e regras condicionais',
    description: 'fazer a arte reagir sozinha aos dados do franqueado.',
    scenes: [
      { id:'intro', duration:3200, tooltip:null,
        build: ()=>_tutIntro('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9z"/>',
          'Automação visual', 'Sem fórmula: a cor e a visibilidade de um elemento podem seguir uma variável.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'cor', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:110,h:150,highlight:'band'}), { panel: tutPanelCard('Vínculos', 'Cor → '+tutVarPill('corCampanha','cor')+'<br>Visível se → '+tutVarPill('mostrarSelo','sim/não'), true) })}</div>`,
        tooltip:{ text:'No painel Propriedades, a cor de uma forma pode seguir uma variável de cor.', target:'.tut-panel-card.highlighted', placement:'left' } },
      { id:'visivel', duration:4000,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:110,h:150,highlight:'badge'}), {})}</div>`,
        tooltip:{ text:'"Visível se" liga/desliga o selo conforme um sim/não. Útil pra mostrar selo só em promoção.', target:'.tut-art-badge', placement:'left' } },
      { id:'regra', duration:5000,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:100,h:140}), { panel: tutPanelCard('Regra condicional','Quando '+tutChip('precoDe')+'<br>estiver '+tutChip('vazio')+'<br>→ '+tutChip('ocultar',{primary:true}), true) })}</div>`,
        tooltip:{ text:'Regras por menu: "quando precoDe vazio → ocultar o badge". Vale na simulação E no PNG final.', target:'.tut-panel-card.highlighted', placement:'left' } },
    ],
  },

  'simular': {
    title: 'Simule com dados reais',
    description: 'pré-visualizar a arte exatamente como o franqueado vai gerar.',
    scenes: [
      { id:'intro', duration:3000, tooltip:null,
        build: ()=>_tutIntro('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
          'Veja antes de publicar', 'A simulação troca os {{tokens}} por valores de teste — o que você vê é o que sai.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'abrir', duration:3800,
        build: ()=>`<div class="tut-scene-content">${tutChip('👁 Simular dados reais',{primary:true,highlight:true,id:'tut-sim-btn'})}</div>`,
        tooltip:{ text:'No topo do Estúdio, clique em "Simular dados reais".', target:'#tut-sim-btn', placement:'bottom' },
        after: ()=>{ tutSceneTimeout(()=>tutMoveCursor('#tut-sim-btn','click'), 1300); } },
      { id:'preencher', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:24px;align-items:center">
            <div style="display:flex;flex-direction:column;gap:8px;width:180px">
              <div style="background:#222;border:1px solid #444;border-radius:6px;padding:7px 10px;color:#E8E8E8;font-size:12px;font-family:Roboto">produto: <strong>Combo Smash</strong></div>
              <div style="background:#222;border:1px solid #444;border-radius:6px;padding:7px 10px;color:#E8E8E8;font-size:12px;font-family:Roboto">precoPor: <strong>R$ 19,90</strong></div>
            </div>
            ${tutArtCanvas({w:110,h:150,titleText:'COMBO SMASH',priceText:'R$ 19,90'})}
          </div></div>`,
        tooltip:null },
      { id:'overflow', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;align-items:center;gap:12px">
            <div style="background:#222;border:1px solid var(--dm-red);border-radius:6px;padding:8px 12px;color:#E8E8E8;font-size:12px;font-family:Roboto;width:260px" id="tut-sim-of">Combo Super Mega Especial da Casa <span style="float:right;color:var(--dm-red);font-weight:700">38/32</span></div>
            <div style="color:var(--dm-red);font-size:11px;font-weight:700;font-family:Roboto">⚠ não cabe no layout</div>
          </div></div>`,
        tooltip:{ text:'O contador mostra os caracteres vs o limite. Se passar, ajuste o maxLen ou aumente a caixa.', target:'#tut-sim-of', placement:'bottom' } },
    ],
  },

  'pastas-capas': {
    title: 'Pastas, capas e organização',
    description: 'organizar os materiais em pastas com capa.',
    scenes: [
      { id:'intro', duration:3000, tooltip:null,
        build: ()=>_tutIntro('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
          'Cada campanha, uma pasta', 'Pastas guardam os materiais. Você define a capa, o nome e a quem ela aparece.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'grade', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:12px">
            ${[['#C81818','Hamburguer Fest'],['#15803D','Entrega Grátis'],['#185FA5','Aqui Tem Cupons']].map((p,i)=>`<div class="${i===1?'highlight-target highlighted':''}" style="width:120px;border-radius:9px;overflow:hidden;background:#222;border:1px solid rgba(255,255,255,.1)"><div style="height:60px;background:linear-gradient(135deg,${p[0]},${p[0]}cc)"></div><div style="padding:7px 8px;font-size:11px;color:#E8E8E8;font-family:Roboto">📁 ${p[1]}</div></div>`).join('')}
          </div></div>`,
        tooltip:{ text:'As pastas aparecem em grade com a capa. Clique numa pra ver/editar os materiais.', target:'.highlight-target', placement:'bottom' } },
      { id:'editar', duration:5000,
        build: ()=>`<div class="tut-scene-content">${tutPanelCard('Editando pasta', '🖼 Miniatura 750×400<br>Título: Entrega Grátis<br>Vincular a campanha<br>⚙ Avançado: grupos + agendar', true)}</div>`,
        tooltip:{ text:'No menu ⋯ → "Editar pasta": troca a capa, renomeia, vincula campanha e mais.', target:'.tut-panel-card.highlighted', placement:'right' } },
      { id:'franqueado', duration:4000,
        build: ()=>`<div class="tut-scene-content"><div style="width:200px">${tutMockCampaign('Entrega Grátis','linear-gradient(135deg,#15803D,#22C55E)','FRETE GRÁTIS','R$ 0,00', true)}</div></div>`,
        tooltip:{ text:'A capa que você escolheu vira o fundo do card no catálogo do franqueado.', target:'.tut-mock-camp.highlight-target', placement:'right' } },
    ],
  },

  'blocos-fontes': {
    title: 'Blocos reutilizáveis e fontes',
    description: 'salvar blocos prontos e usar as fontes da marca.',
    scenes: [
      { id:'intro', duration:3000, tooltip:null,
        build: ()=>_tutIntro('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
          'Reaproveite o que funciona', 'Salve conjuntos de elementos como blocos e suba suas próprias fontes.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'salvar', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;align-items:center;gap:14px">
            ${tutChip('💾 Salvar bloco',{primary:true,highlight:true,id:'tut-bf-save'})}
            <p style="font-size:12px;color:#E8E8E8;max-width:300px;text-align:center;font-family:Roboto;line-height:1.5">Selecione um selo de desconto, uma faixa "de/por"... e salve como bloco.</p>
          </div></div>`,
        tooltip:{ text:'Na aba Assets, "Salvar bloco" guarda os elementos selecionados pra reusar depois.', target:'#tut-bf-save', placement:'bottom' } },
      { id:'inserir', duration:4000,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:10px">${['Selo -20%','Faixa de/por','Rodapé DM'].map((b,i)=>`<div class="${i===0?'highlight-target highlighted':''}" style="width:100px;height:64px;background:#222;border:1px dashed rgba(255,255,255,.2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#E8E8E8;font-size:11px;text-align:center;font-family:Roboto;padding:6px">🧩 ${b}</div>`).join('')}</div></div>`,
        tooltip:{ text:'Em qualquer template, 1 clique reinsere o bloco pronto.', target:'.highlight-target', placement:'bottom' } },
      { id:'fontes', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutPanelCard('Fontes da marca','⬆ Enviar fonte (.woff2/.ttf)<br>Aa MinhaFonte<br>Aa Outra Fonte', true)}</div>`,
        tooltip:{ text:'Suba suas fontes: elas aparecem no seletor de fonte e são embutidas no SVG exportado.', target:'.tut-panel-card.highlighted', placement:'right' } },
    ],
  },

  'publicar': {
    title: 'Publicando para os franqueados',
    description: 'liberar um material com as permissões certas.',
    scenes: [
      { id:'intro', duration:3200, tooltip:null,
        build: ()=>_tutIntro('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
          'Do rascunho ao ar', 'Enquanto está em rascunho (○) o franqueado não vê. Publicado (●) aparece pra ele.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'abrir', duration:3800,
        build: ()=>`<div class="tut-scene-content">${tutChip('🚀 Publicar',{primary:true,highlight:true,id:'tut-pub-btn'})}</div>`,
        tooltip:{ text:'No topo, "Publicar" abre as opções de liberação.', target:'#tut-pub-btn', placement:'bottom' },
        after: ()=>{ tutSceneTimeout(()=>tutMoveCursor('#tut-pub-btn','click'), 1300); } },
      { id:'permissoes', duration:5000,
        build: ()=>`<div class="tut-scene-content">${tutPanelCard('Permissões','produto ✔ editável · máx 32<br>precoPor ✔ editável · máx 14<br>validade ✘ não editável', true)}</div>`,
        tooltip:{ text:'Você decide o que o franqueado pode mudar e o limite de caracteres de cada campo.', target:'.tut-panel-card.highlighted', placement:'right' } },
      { id:'validade', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:#E8E8E8;font-family:Roboto;font-size:13px">
            <div>📅 Validade: <strong>31/12/2026</strong></div>
            <div style="max-width:320px;text-align:center;color:#aaa;font-size:12px;line-height:1.5">Defina uma data de expiração e um recado que aparece pro franqueado.</div>
            <div style="color:#22C55E;font-weight:700">● Publicado na campanha vinculada</div>
          </div></div>`,
        tooltip:null },
    ],
  },

  'exportar': {
    title: 'Preview e exportação',
    description: 'revisar e baixar a arte em vários formatos.',
    scenes: [
      { id:'intro', duration:3000, tooltip:null,
        build: ()=>_tutIntro('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
          'Hora de exportar', 'Veja o resultado final e baixe em PNG, JPG ou SVG — em qualquer formato.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'preview', duration:4000,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;align-items:center;gap:16px">
            ${tutKey('P')}<span style="color:#E8E8E8;font-family:Roboto;font-size:13px">abre o Preview</span>
            <div style="display:flex;gap:8px">${tutChip('Story')}${tutChip('Feed')}${tutChip('Wide')}</div>
          </div></div>`,
        tooltip:null },
      { id:'escala', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center" id="tut-ex-scale">
            ${tutChip('PNG 1×')}${tutChip('PNG 2×',{primary:true})}${tutChip('PNG 3×')}${tutChip('JPG · qualidade')}
          </div></div>`,
        tooltip:{ text:'Escolha escala (2× = mais nitidez) e formato de arquivo PNG ou JPG.', target:'#tut-ex-scale', placement:'bottom' } },
      { id:'svg', duration:4500,
        build: ()=>`<div class="tut-scene-content"><div style="display:flex;gap:10px">
            ${tutChip('⬡ SVG template',{highlight:true,id:'tut-ex-svg'})}${tutChip('⬡ SVG preenchido')}
          </div></div>`,
        tooltip:{ text:'SVG template mantém os {{}} editável no Illustrator/Figma; preenchido sai fiel ao PNG.', target:'#tut-ex-svg', placement:'bottom' } },
      { id:'todos', duration:3800,
        build: ()=>`<div class="tut-scene-content">${tutChip('⬇ Baixar todos os formatos',{primary:true,highlight:true,id:'tut-ex-all'})}</div>`,
        tooltip:{ text:'Um clique gera Story + Feed + Wide de uma vez — com smart resize, sem distorcer.', target:'#tut-ex-all', placement:'bottom' } },
    ],
  },

  'atalhos': {
    title: 'Atalhos que aceleram tudo',
    description: 'trabalhar mais rápido no Estúdio com o teclado.',
    scenes: [
      { id:'intro', duration:3000, tooltip:null,
        build: ()=>_tutIntro('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
          'Mãos no teclado', 'Cada ferramenta tem uma tecla. Decore as principais e voe.', 'linear-gradient(135deg,#1A1A1A,#333)') },
      { id:'ferramentas', duration:5000,
        build: ()=>_tutKeyRows([['V','Selecionar / Mover'],['T','Texto'],['R','Retângulo'],['F','Moldura de foto'],['M','Imagem'],['B','Pincel'],['I','Conta-gotas']]),
        tooltip:null },
      { id:'edicao', duration:4500,
        build: ()=>_tutKeyRows([['Ctrl+Z','Desfazer'],['Ctrl+Shift+Z','Refazer'],['Ctrl+D','Duplicar'],['Ctrl+G','Agrupar'],['Del','Excluir'],['↑ ↓ ← →','Mover 1px (Shift = 10px)']]),
        tooltip:null },
      { id:'navegacao', duration:4500,
        build: ()=>_tutKeyRows([['Ctrl+0','Encaixar na tela'],['Ctrl+1','Zoom 100%'],['Ctrl + / −','Aumentar / diminuir zoom'],['P','Preview / Exportar'],['?','Ver todos os atalhos']]),
        tooltip:null },
    ],
  },


  'smart-resize': {
    title: 'Smart Resize: um template, três formatos',
    description: 'deixar a Luma adaptar seu template pra Story, Feed e Wide automaticamente.',
    scenes: [
      { id:'intro', duration:3200, tooltip:null,
        build: ()=>_tutIntro('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
          'Um template, três formatos', 'Você desenha no formato nativo e a Luma gera Story, Feed e Wide sem distorcer nada.', 'linear-gradient(135deg,#0f172a,#1e293b)') },
      { id:'formatos', duration:5000,
        build: ()=>`<div class="tut-scene-content">
          <div style="display:flex;align-items:flex-end;justify-content:center;gap:18px">
            ${[
              ['Story','9:16','70px','124px','rgba(255,144,0,.15)','var(--dm-orange-d)','0s'],
              ['Feed','1:1','100px','100px','rgba(34,197,94,.12)','#15803D','0.12s'],
              ['Wide','19:10','130px','68px','rgba(59,130,246,.12)','#2563EB','0.24s'],
            ].map(([name,ratio,w,h,bg,color,delay])=>`
              <div style="display:flex;flex-direction:column;align-items:center;gap:8px;opacity:0;animation:tutFinaleFadeUp .5s ${delay} both">
                <div style="width:${w};height:${h};background:${bg};border:2px solid ${color};border-radius:6px;display:flex;align-items:center;justify-content:center">
                  <span style="font-size:9px;font-weight:700;color:${color}">${ratio}</span>
                </div>
                <span style="font-size:11px;font-weight:700;color:var(--text-2)">${name}</span>
                <span style="font-size:9px;color:var(--text-3)">${name==='Story'?'1080×1920':name==='Feed'?'1080×1080':'1200×628'}</span>
              </div>`).join('')}
          </div></div>`,
        tooltip:{ text:'O mesmo template é salvo em Story (9:16), Feed (1:1) e Wide (19:10). O franqueado escolhe o formato ao gerar.', target:null, placement:'bottom' } },
      { id:'ancoras', duration:5500,
        build: ()=>`<div class="tut-scene-content">
          <div style="display:flex;gap:20px;align-items:center">
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
              <div style="background:#1A1A1A;border-radius:6px;width:90px;height:150px;position:relative;overflow:hidden">
                <div style="position:absolute;top:16px;left:8px;right:8px;height:28px;background:var(--dm-orange);border-radius:4px;display:flex;align-items:center;justify-content:center"><span style="font-size:9px;font-weight:700;color:#fff">TÍTULO</span></div>
                <div style="position:absolute;bottom:12px;right:8px;width:40px;height:22px;background:#3b82f6;border-radius:3px;display:flex;align-items:center;justify-content:center"><span style="font-size:8px;color:#fff">R$19</span></div>
                <div style="position:absolute;top:2px;right:4px;font-size:8px;color:rgba(255,255,255,.3);font-weight:600">Story</div>
              </div>
              <span style="font-size:10px;color:var(--text-3)">Formato original</span>
            </div>
            <div style="font-size:22px;color:var(--text-3);animation:tutFinaleFadeUp .4s .6s both;opacity:0">→</div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0;animation:tutFinaleFadeUp .5s .7s both">
              <div style="background:#1A1A1A;border-radius:6px;width:110px;height:110px;position:relative;overflow:hidden">
                <div style="position:absolute;top:12px;left:8px;right:8px;height:24px;background:var(--dm-orange);border-radius:4px;display:flex;align-items:center;justify-content:center"><span style="font-size:8px;font-weight:700;color:#fff">TÍTULO</span></div>
                <div style="position:absolute;bottom:10px;right:8px;width:36px;height:20px;background:#3b82f6;border-radius:3px;display:flex;align-items:center;justify-content:center"><span style="font-size:7px;color:#fff">R$19</span></div>
                <div style="position:absolute;top:2px;right:4px;font-size:7px;color:rgba(255,255,255,.3);font-weight:600">Feed</div>
              </div>
              <span style="font-size:10px;color:var(--text-3)">Adaptado</span>
            </div>
          </div></div>`,
        tooltip:{ text:'A âncora de cada elemento é inferida automaticamente: encostado à esquerda fica à esquerda, centralizado fica centralizado.', target:null, placement:'bottom' } },
      { id:'girar', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:100,h:140}), { panel: tutPanelCard('Orientação',
          '<div style="display:flex;gap:6px;margin-top:4px">'
          +'<span style="padding:5px 8px;background:#1A1A1A;border:1px solid rgba(255,255,255,.15);border-radius:4px;display:flex;align-items:center;justify-content:center"><svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="#FF9000" stroke-width="1.5"><rect x="1" y="1" width="8" height="12" rx="1"/></svg></span>'
          +'<span style="padding:5px 8px;background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:4px;display:flex;align-items:center;justify-content:center"><svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.5"><rect x="1" y="1" width="12" height="8" rx="1"/></svg></span>'
          +'<span id="tut-girar-btn" style="flex:1;padding:5px 8px;background:rgba(255,144,0,.12);border:1px solid rgba(255,144,0,.3);border-radius:4px;color:var(--dm-orange);font-size:10px;font-weight:700;text-align:center">↔ Girar</span>'
          +'</div>', true) })}</div>`,
        tooltip:{ text:'"↔ Girar" no painel de prancheta troca portrait↔landscape aplicando smart-resize nas camadas.', target:'.tut-panel-card.highlighted', placement:'left' },
        after: ()=>{ tutSceneTimeout(()=>tutMoveCursor('#tut-girar-btn','click'), 1600); } },
      { id:'franqueado', duration:4000,
        build: ()=>`<div class="tut-scene-content">
          <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
            <div style="font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">O franqueado escolhe o formato no momento de gerar</div>
            <div style="display:flex;gap:10px">
              ${[['Story','70px','124px'],['Feed','100px','100px'],['Wide','130px','68px']].map(([name,w,h],i)=>`
                <div style="display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0;animation:tutFinaleFadeUp .4s ${0.1+i*0.1}s both">
                  <div style="width:${w};height:${h};background:#1A1A1A;border:2px solid ${i===0?'var(--dm-orange)':'rgba(255,255,255,.1)'};border-radius:6px;position:relative;overflow:hidden">
                    <div style="position:absolute;top:15%;left:10%;right:10%;height:20%;background:var(--dm-orange);border-radius:3px"></div>
                    <div style="position:absolute;bottom:10%;right:10%;width:35%;height:15%;background:#3b82f6;border-radius:2px"></div>
                    ${i===0?'<div style="position:absolute;inset:0;border-radius:4px;box-shadow:inset 0 0 0 2px var(--dm-orange)"></div>':''}
                  </div>
                  <span style="font-size:10px;font-weight:${i===0?'700':'500'};color:${i===0?'var(--dm-orange-d)':'var(--text-3)'}">${name}</span>
                </div>`).join('')}
            </div>
          </div></div>`,
        tooltip:{ text:'No preview, o franqueado toca no formato desejado. A Luma gera o PNG já adaptado para aquele tamanho.', target:null, placement:'bottom' } },
    ],
  },

  'importar-psd': {
    title: 'Importar um PSD do Photoshop',
    description: 'transformar um arquivo .psd em template editável na Luma.',
    scenes: [
      { id:'intro', duration:3200, tooltip:null,
        build: ()=>_tutIntro('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>',
          'PSD vira template', 'Traga seu layout do Photoshop direto pra Luma. Em minutos ele vira um template vivo com variáveis.', 'linear-gradient(135deg,#001b35,#31A8FF22)') },
      { id:'botao', duration:4500,
        build: ()=>`<div class="tut-scene-content">${tutStudio(tutArtCanvas({w:100,h:140}), { panel: tutPanelCard('Templates',
          '<div style="display:flex;gap:6px;align-items:center;margin-top:4px">'
          +'<span id="tut-psd-btn" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#31A8FF;color:#fff;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">'
          +'<span style="background:#fff;color:#31A8FF;border-radius:2px;font-size:7px;padding:1px 3px;font-weight:900">PSD</span>Importar</span>'
          +'<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#FF9A00;color:#fff;border-radius:5px;font-size:11px;font-weight:700">'
          +'<span style="background:#fff;color:#FF9A00;border-radius:2px;font-size:7px;padding:1px 3px;font-weight:900">SVG</span>Importar</span>'
          +'</div>', true) })}</div>`,
        tooltip:{ text:'No painel de Templates, clique no botão azul "PSD Importar" e selecione seu arquivo .psd.', target:'.tut-panel-card.highlighted', placement:'left' },
        after: ()=>{ tutSceneTimeout(()=>tutMoveCursor('#tut-psd-btn','click'), 1400); } },
      { id:'revisao', duration:5000,
        build: ()=>`<div class="tut-scene-content">
          <div style="background:#fff;border:1.5px solid #e4e4e4;border-radius:10px;width:340px;font-family:'Roboto',sans-serif;overflow:hidden">
            <div style="background:#31A8FF;color:#fff;padding:10px 14px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px">
              <span style="background:#fff;color:#31A8FF;border-radius:2px;font-size:8px;padding:1px 4px;font-weight:900">PSD</span>
              Revisar camadas · combo_smash.psd
            </div>
            ${[
              ['texto','Título produto','COMBO SMASH','editável'],
              ['imagem','Foto produto','(raster)','imagem'],
              ['var','Preço','{{precoPor}}','variável'],
              ['forma','Fundo laranja','(shape)','forma'],
            ].map((r,i)=>`
              <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #f0f0f0;opacity:0;animation:tutFinaleFadeUp .3s ${0.1+i*0.1}s both">
                <span style="font-size:10px;flex:1;color:var(--text-2);font-weight:600">${r[1]}</span>
                <span style="font-size:9px;color:var(--text-3);max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[2]}</span>
                <span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;background:${r[0]==='var'?'rgba(255,144,0,.12)':r[0]==='texto'?'rgba(34,197,94,.12)':'rgba(100,116,139,.1)'};color:${r[0]==='var'?'var(--dm-orange-d)':r[0]==='texto'?'#15803D':'var(--text-3)'}">${r[3]}</span>
              </div>`).join('')}
            <div style="padding:8px 12px;font-size:10px;color:var(--text-3);opacity:0;animation:tutFinaleFadeUp .3s .55s both">+ 3 camadas ocultas por padrão</div>
          </div></div>`,
        tooltip:{ text:'A tela de revisão lista cada camada com o modo sugerido pela Luma. Você pode ajustar antes de confirmar.', target:null, placement:'bottom' } },
      { id:'modos', duration:5000,
        build: ()=>`<div class="tut-scene-content">
          <div style="display:flex;flex-direction:column;gap:8px;width:340px">
            ${[
              ['🔤','Texto editável','O franqueado pode editar o conteúdo diretamente.','rgba(34,197,94,.12)','#15803D'],
              ['{}','Variável','Conecta a camada a um campo de dado (ex: preço).','rgba(255,144,0,.12)','var(--dm-orange-d)'],
              ['🖼','Imagem fiel','Mantém o raster original sem edição.','rgba(59,130,246,.12)','#2563EB'],
              ['◼','Forma (cor)','Shape recolorável pela paleta ou por vínculo.','rgba(124,110,255,.12)','#7C6EFF'],
              ['👁','Ocultar','Remove a camada do template final.','rgba(100,116,139,.08)','var(--text-3)'],
            ].map((m,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${m[3]};border-radius:8px;opacity:0;animation:tutFinaleFadeUp .35s ${0.1+i*0.08}s both">
              <span style="font-size:16px;width:24px;text-align:center">${m[0]}</span>
              <span style="flex:1"><span style="font-size:12px;font-weight:700;color:${m[4]}">${m[1]}</span><br><span style="font-size:10px;color:var(--text-3)">${m[2]}</span></span>
            </div>`).join('')}
          </div></div>`,
        tooltip:null },
      { id:'confirmar', duration:4000,
        build: ()=>`<div class="tut-scene-content">
          <div style="display:flex;flex-direction:column;align-items:center;gap:14px;width:320px">
            <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px 18px;width:100%;font-family:'Roboto',sans-serif;text-align:center;opacity:0;animation:tutFinaleFadeUp .4s .1s both">
              <div style="font-size:13px;font-weight:700;color:#15803D;margin-bottom:4px">Template criado com sucesso</div>
              <div style="font-size:11px;color:var(--text-3)">combo_smash · Story · 1080×1920</div>
            </div>
            ${tutStudio(tutArtCanvas({w:90,h:130,titleText:'COMBO SMASH',priceText:'R$ 19,90'}),{})}
          </div></div>`,
        tooltip:{ text:'Confirmar importa todas as camadas selecionadas. O template aparece na pasta com variáveis prontas para usar.', target:null, placement:'bottom' } },
    ],
  },

});
