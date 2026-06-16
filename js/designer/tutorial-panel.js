/**
 * js/designer/tutorial-panel.js
 *
 * Aba "Tutorial" do designer: guia em acordeão que explica cada ferramenta,
 * atalho e recurso da plataforma + botão "Abrir modelo de exemplo".
 * Depende de: designer/templates.js (dLoadTemplate, dBuildShowcaseLayers), canvas.js (dRenderCanvas).
 */

// Seções do guia. Cada item: {ico, name, key (atalho), desc}
const DTUT_SECTIONS = [
  { title: 'Ferramentas de criação', open: true, items: [
    { ico:'⌖', name:'Selecionar / Mover', key:'V', desc:'Clique para selecionar um elemento e arraste para mover. Use as alças nos cantos para redimensionar. Setas movem 1px (Shift = 10px).' },
    { ico:'T', name:'Texto', key:'T', desc:'Clique no canvas para criar um texto. Escreva {{variavel}} para criar campos que o franqueado vai preencher (ex.: {{produto}}).' },
    { ico:'▭', name:'Retângulo / Formas', key:'R', desc:'Cria formas sólidas (fundos, faixas, caixas). No painel de camadas há também + Círculo, Estrela, Polígono e Linha.' },
    { ico:'🖼', name:'Moldura de foto', key:'F', desc:'Área que recebe uma imagem. Vincule a uma variável de imagem (ex.: foto_produto) para o franqueado subir a foto dele. Suporta recorte cover/contain e cantos arredondados/círculo.' },
    { ico:'🌄', name:'Imagem fixa', key:'M', desc:'Insere uma imagem que NÃO muda (logo, selo). Para foto que o franqueado troca, use a Moldura.' },
  ]},
  { title: 'Pintura', open: false, items: [
    { ico:'🖌', name:'Pincel', key:'B', desc:'Pintura livre sobre a arte. Ajuste tamanho, dureza, opacidade, fluxo, modo de mesclagem e cor na barra de pincel.' },
    { ico:'🩹', name:'Borracha', key:'E', desc:'Apaga a pintura feita com o pincel.' },
    { ico:'💧', name:'Conta-gotas', key:'I', desc:'Copia uma cor de qualquer ponto do canvas para usar no pincel/preenchimento.' },
    { ico:'🪣', name:'Balde', key:'G', desc:'Preenche uma área com a cor atual.' },
    { ico:'🔁', name:'Carimbo (clone)', key:'S', desc:'Clona um trecho da arte. Defina a origem e pinte a cópia.' },
  ]},
  { title: 'Variáveis & automação', open: false, items: [
    { ico:'{}', name:'Variáveis', key:'aba Variáveis', desc:'Crie campos que o franqueado preenche: texto, número, moeda (R$), imagem, seleção, data, cor e sim/não. Defina rótulo, valor padrão, se é obrigatório e a ordem das perguntas.' },
    { ico:'🔗', name:'Vínculos de propriedade', key:'painel Propriedades', desc:'Faça a COR de uma forma ou a VISIBILIDADE de um elemento dependerem de uma variável (ex.: mostrar um selo só quando "mostrarSelo" for Sim).' },
    { ico:'⚙', name:'Regras condicionais', key:'painel Propriedades', desc:'“Quando [variável] estiver [vazio] → ocultar este elemento”. Ex.: esconder o badge de desconto quando não há preço “de”.' },
    { ico:'👁', name:'Simular dados reais', key:'topo', desc:'Preencha valores de teste e veja a arte exatamente como o franqueado vai gerar — com contador de caracteres e aviso de overflow.' },
  ]},
  { title: 'Organização & precisão', open: false, items: [
    { ico:'⌷', name:'Alinhar / Distribuir', key:'barra contextual', desc:'Com 1 elemento, alinha ao canvas; com 2+ selecionados (Shift+clique), alinha/distribui entre eles.' },
    { ico:'🔗', name:'Agrupar', key:'Ctrl+G', desc:'Agrupa elementos para moverem juntos. Ctrl+Shift+G desfaz o grupo.' },
    { ico:'🧲', name:'Snap & guias', key:'topo', desc:'Linhas-guia inteligentes que “grudam” os elementos alinhados, mostrando a medida em px. Réguas ajudam no posicionamento.' },
    { ico:'↩', name:'Desfazer / Refazer', key:'Ctrl+Z / Ctrl+Shift+Z', desc:'Volta e refaz qualquer ação. Ctrl+D duplica o elemento selecionado.' },
  ]},
  { title: 'Blocos & fontes (aba Assets)', open: false, items: [
    { ico:'🧩', name:'Blocos reutilizáveis', key:'aba Assets', desc:'Salve um conjunto de elementos como um bloco (selo de desconto, faixa “de/por”, rodapé) e reinsira em qualquer template.' },
    { ico:'🔤', name:'Fontes da marca', key:'aba Assets', desc:'Envie suas fontes (.ttf/.otf/.woff/.woff2). Elas aparecem no seletor de fonte e são embutidas no SVG exportado.' },
  ]},
  { title: 'Finalizar', open: false, items: [
    { ico:'🔍', name:'Preview / Exportar', key:'P', desc:'Veja a arte final e baixe em PNG (1×/2×/3×) ou JPG. Também dá pra exportar SVG (com {{variáveis}} ou já preenchido).' },
    { ico:'🚀', name:'Publicar', key:'topo', desc:'Disponibiliza o template para os franqueados, definindo permissões (o que é editável e o limite de caracteres) e a validade.' },
  ]},
];

function dRenderTutorialPanel(){
  const el=document.getElementById('d-tutorial-body'); if(!el) return;
  el.innerHTML=DTUT_SECTIONS.map((s,i)=>`
    <div class="d-tut-sec ${s.open?'open':''}" data-i="${i}">
      <button class="d-tut-sec-head" onclick="dTutToggle(${i})">
        <span>${s.title}</span><span class="d-tut-chev">▸</span>
      </button>
      <div class="d-tut-sec-body">
        ${s.items.map(it=>`
          <div class="d-tut-item">
            <span class="d-tut-ico">${it.ico}</span>
            <div class="d-tut-itxt">
              <div class="d-tut-iname">${it.name} ${it.key?`<span class="d-tut-key">${it.key}</span>`:''}</div>
              <div class="d-tut-idesc">${it.desc}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}
function dTutToggle(i){
  const sec=document.querySelector(`.d-tut-sec[data-i="${i}"]`);
  if(sec) sec.classList.toggle('open');
}
// Carrega o template-modelo de exemplo na prancheta ativa (ou reconstrói se a pasta sumiu)
function dTutLoadExample(){
  const f=(typeof dFolders!=='undefined'&&dFolders)?dFolders.find(x=>x.id==='f-modelo'):null;
  const t=f&&f.templates&&f.templates[0];
  if(t){ dLoadTemplate(t,f); gToast('✓ Modelo de exemplo aberto — explore e edite à vontade'); return; }
  // Fallback: monta o showcase direto no artboard ativo
  if(typeof dBuildShowcaseLayers==='function'){
    dFmt='story';
    dLayers=dBuildShowcaseLayers('story');
    dSelId=null; if(typeof dMultiSel!=='undefined')dMultiSel=[];
    if(typeof dHistoryReset==='function')dHistoryReset();
    if(typeof dSyncLayersToAB==='function')dSyncLayersToAB();
    dApplyFormat(); dRenderCanvas(); dRenderLayersList();
    if(typeof dStats==='function')dStats(); if(typeof dMarkUnsaved==='function')dMarkUnsaved();
    setTimeout(()=>{ if(typeof dFitToScreen==='function')dFitToScreen(); },60);
    gToast('✓ Modelo de exemplo carregado na prancheta');
  }else{
    gToast('Modelo de exemplo indisponível');
  }
}
