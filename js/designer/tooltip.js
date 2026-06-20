/**
 * Luma Designer - Rich Educational Tooltips
 * Fornece tooltips explicativos e educacionais para as ferramentas da barra lateral.
 */

const LumaTooltips = {
  // SELECIONAR
  'select': { name: 'Ferramenta Seleção', group: 'Selecionar', shortcut: 'V', desc: 'Move, redimensiona e rotaciona elementos no seu design.', example: 'Use para organizar o layout e posicionar objetos livremente no canvas.' },
  'hand': { name: 'Ferramenta Mão', group: 'Navegação', shortcut: 'H', desc: 'Navegue pelo canvas de forma livre sem alterar nenhum elemento.', example: 'Dica Pro: Segure a Barra de Espaço a qualquer momento para ativar temporariamente.' },
  'obj-select': { name: 'Seleção de Objeto', group: 'Selecionar', shortcut: 'W', desc: 'Encontra e seleciona objetos automaticamente na tela usando inteligência.', example: 'Ideal para isolar elementos complexos de um fundo em um único clique.' },
  'quick-select': { name: 'Seleção Rápida', group: 'Selecionar', shortcut: 'W', desc: 'Pinte sobre uma área para selecioná-la rapidamente.', example: 'Ótimo para selecionar roupas ou partes específicas de uma imagem.' },
  'magic-wand': { name: 'Varinha Mágica', group: 'Selecionar', shortcut: 'Y', desc: 'Seleciona áreas com cores semelhantes com apenas um clique.', example: 'Perfeito para remover fundos sólidos ou selecionar céus.' },

  // TEXTO & MÍDIA
  'text-h': { name: 'Texto Horizontal', group: 'Texto', shortcut: 'T', desc: 'Adiciona blocos de texto ou parágrafos regulares no formato ocidental.', example: 'Clique para criar um título ou arraste para desenhar uma caixa de parágrafo.' },
  'text-v': { name: 'Texto Vertical', group: 'Texto', shortcut: 'T', desc: 'Adiciona texto empilhado verticalmente.', example: 'Muito usado em tipografia asiática ou designs criativos.' },
  'mask-text-h': { name: 'Máscara Horizontal', group: 'Texto', shortcut: '', desc: 'Cria uma seleção com o formato do texto digitado.', example: 'Use para recortar imagens com o formato de palavras.' },
  'mask-text-v': { name: 'Máscara Vertical', group: 'Texto', shortcut: '', desc: 'Cria uma seleção vertical com o formato do texto digitado.', example: 'Versão vertical da máscara de texto.' },
  'frame': { name: 'Moldura de Foto', group: 'Mídia', shortcut: 'F', desc: 'Cria um container de espaço reservado (placeholder) para imagens.', example: 'Arraste uma imagem para dentro da moldura e ela será recortada automaticamente.' },
  'img': { name: 'Imagem URL', group: 'Mídia', shortcut: 'M', desc: 'Importa uma imagem externa via link direto.', example: 'Cole a URL de uma imagem da web para injetá-la direto no seu projeto.' },

  // DESENHAR
  'rect': { name: 'Ferramenta Retângulo', group: 'Formas', shortcut: 'R', desc: 'Desenha quadrados e retângulos vetoriais.', example: 'Segure SHIFT ao desenhar para criar um quadrado perfeito.' },
  'ellipse': { name: 'Ferramenta Elipse', group: 'Formas', shortcut: 'O', desc: 'Desenha círculos e elipses (ovais) vetoriais.', example: 'Segure SHIFT ao desenhar para criar um círculo perfeito.' },
  'triangle': { name: 'Ferramenta Triângulo', group: 'Formas', shortcut: '', desc: 'Desenha triângulos vetoriais.', example: 'Use nas composições geométricas do seu layout.' },
  'polygon': { name: 'Ferramenta Polígono', group: 'Formas', shortcut: '', desc: 'Desenha polígonos vetoriais complexos.', example: 'Ajuste o número de lados no painel de propriedades após desenhar.' },
  'star': { name: 'Ferramenta Estrela', group: 'Formas', shortcut: '', desc: 'Desenha formas estelares.', example: 'Ideal para emblemas, promoções ou ícones de avaliação.' },
  'line': { name: 'Ferramenta Linha', group: 'Formas', shortcut: 'L', desc: 'Desenha linhas retas e setas vetoriais.', example: 'Segure SHIFT para travar o ângulo a cada 45 graus.' },

  // DADOS E AUTOMAÇÃO
  'var-data': { name: 'Vincular Campo', group: 'Dados', shortcut: 'X', desc: 'Conecta um elemento a uma variável dinâmica de banco de dados.', example: 'Use para criar templates que se auto-preenchem com dados de clientes.' },
  'qr-code': { name: 'Gerador QR Code', group: 'Dados', shortcut: 'Q', desc: 'Gera um QR Code dinâmico ou estático no seu design.', example: 'Vincule a uma URL ou variável para que o código seja atualizado automaticamente ao imprimir.' },

  // PINTURA & EFEITOS
  'brush': { name: 'Ferramenta Pincel', group: 'Pintura', shortcut: 'B', desc: 'Pinta traços suaves usando a cor de foreground.', example: 'Use os colchetes [ ou ] no teclado para diminuir ou aumentar o tamanho.' },
  'eraser': { name: 'Borracha', group: 'Pintura', shortcut: 'E', desc: 'Apaga pixels da camada atual, tornando-os transparentes.', example: 'Se estiver apagando a camada de Fundo (Background), ela será preenchida com a cor de background.' },
  'stamp': { name: 'Carimbo / Clonar', group: 'Pintura', shortcut: 'S', desc: 'Copia (clona) pixels de uma área da imagem para outra.', example: 'Segure ALT e clique na área que deseja copiar, depois pinte sobre o defeito para corrigi-lo.' },
  'bucket': { name: 'Lata de Tinta', group: 'Preenchimento', shortcut: 'G', desc: 'Preenche uma área fechada de cor sólida com um clique.', example: 'Ajuste a "Tolerância" no menu superior para controlar o alcance do preenchimento.' },
  'gradient': { name: 'Gradiente', group: 'Preenchimento', shortcut: 'G', desc: 'Cria uma transição de cores suave entre dois ou mais pontos.', example: 'Clique e arraste pelo canvas para definir a direção e o tamanho do degradê.' },
  'blur': { name: 'Desfoque', group: 'Efeitos', shortcut: '', desc: 'Suaviza arestas duras ou detalhes numa imagem.', example: 'Pinte sobre o fundo da imagem para simular profundidade de campo.' },
  'sharpen': { name: 'Nitidez', group: 'Efeitos', shortcut: 'O', desc: 'Aumenta o contraste nas bordas, dando mais nitidez aos detalhes.', example: 'Use com cautela em rostos para destacar apenas os olhos.' },
  'smudge': { name: 'Ferramenta Dedo', group: 'Efeitos', shortcut: '', desc: 'Empurra e mistura cores na tela, como se fosse tinta fresca.', example: 'Ótimo para criar texturas artísticas ou corrigir pequenos fios de cabelo.' },

  // RECURSOS
  'resources': { name: 'Biblioteca', group: 'Recursos', shortcut: 'L', desc: 'Acesse assets, componentes e ícones salvos na nuvem.', example: 'Arraste elementos direto para a tela sem sair do Luma.' },
  'ia-assist': { name: 'Assistente IA', group: 'Recursos', shortcut: 'Z', desc: 'Auxilia na criação e no tratamento de imagens usando inteligência artificial.', example: 'Selecione uma área e peça para a IA remover ou substituir um objeto.' },

  // UTILITÁRIOS
  'eyedrop': { name: 'Conta-gotas', group: 'Utilitários', shortcut: 'I', desc: 'Captura (amostra) a cor exata de qualquer pixel na tela.', example: 'A cor capturada vai automaticamente para sua paleta principal.' },
  'color-sampler': { name: 'Classificador de Cores', group: 'Utilitários', shortcut: '', desc: 'Coloca marcadores de cor na tela para ler valores precisos.', example: 'Use para garantir que duas áreas da imagem possuam o mesmo tom de cor.' },
  'ruler': { name: 'Ferramenta Régua', group: 'Utilitários', shortcut: '', desc: 'Mede distâncias e ângulos de forma precisa no canvas.', example: 'Arraste entre dois pontos para medir, ideal para alinhar elementos fotográficos.' },
  'note': { name: 'Notas de Revisão', group: 'Utilitários', shortcut: '', desc: 'Adiciona comentários diretamente sobre o arquivo.', example: 'Use para comunicar alterações com sua equipe sem riscar o design.' },
  'count': { name: 'Contagem', group: 'Utilitários', shortcut: '', desc: 'Adiciona números sequenciais ao clicar nos elementos.', example: 'Útil para marcar quantos objetos existem em uma imagem de laboratório ou arquitetura.' },
};

let dTooltipTimer = null;
const TOOLTIP_DELAY = 600; // 600ms de atraso para não piscar irritantemente
let dHoveredBtn = null;

function initRichTooltips() {
  const tooltipEl = document.getElementById('d-rich-tooltip');
  if (!tooltipEl) return;

  // Busca todos os botões da barra vertical e painéis
  const tools = document.querySelectorAll('[id^="dtool-"], .vat-item');

  tools.forEach(btn => {
    // Remover title nativo para evitar colisão, armazenando-o se precisarmos depois
    if (btn.hasAttribute('title')) {
      btn.dataset.originalTitle = btn.getAttribute('title');
      btn.removeAttribute('title');
    }

    btn.addEventListener('mouseenter', (e) => {
      dHoveredBtn = btn;
      
      // Tentar pegar o ID pelo atributo ID ou por uma classe customizada se for do painel "Todas as ferramentas"
      // No painel Todas as Ferramentas, eles chamam onclick="dSelectPick('select',event)"
      let toolId = btn.id ? btn.id.replace('dtool-', '').replace('-proxy', '') : null;
      
      // Se não tiver ID mas tiver onclick, extrair o ID da string onclick
      if (!toolId && btn.hasAttribute('onclick')) {
        const onclickStr = btn.getAttribute('onclick');
        const match = onclickStr.match(/'([^']+)'/);
        if (match && match[1]) {
          toolId = match[1];
        }
      }

      const data = toolId ? LumaTooltips[toolId] : null;
      if (!data) return; // se não temos dados, não mostra

      // Limpar timer anterior
      clearTimeout(dTooltipTimer);
      
      // Iniciar timer
      dTooltipTimer = setTimeout(() => {
        if (dHoveredBtn === btn) {
          showRichTooltip(btn, data, tooltipEl);
        }
      }, TOOLTIP_DELAY);
    });

    btn.addEventListener('mouseleave', () => {
      dHoveredBtn = null;
      clearTimeout(dTooltipTimer);
      hideRichTooltip(tooltipEl);
    });

    // Se clicar, esconde o tooltip para não ficar "preso" na tela
    btn.addEventListener('click', () => {
      hideRichTooltip(tooltipEl);
    });
  });
}

function showRichTooltip(btnEl, data, tooltipEl) {
  // Preencher conteúdo
  tooltipEl.innerHTML = `
    <div class="drt-header">
      <span class="drt-name">${data.name}</span>
      ${data.shortcut ? `<span class="drt-shortcut">${data.shortcut}</span>` : ''}
    </div>
    <div class="drt-group">${data.group}</div>
    <div class="drt-desc">${data.desc}</div>
    <div class="drt-example">
      <strong>Exemplo prático:</strong><br/>
      ${data.example}
    </div>
  `;

  // Calcular posição
  const rect = btnEl.getBoundingClientRect();
  const isAllToolsPanel = btnEl.closest('.vat-content') !== null;
  
  tooltipEl.style.display = 'block';

  // Obter dimensões do tooltip após display:block
  const ttRect = tooltipEl.getBoundingClientRect();
  
  let leftPos, topPos;

  if (isAllToolsPanel) {
    // Se estiver dentro do painel, colocar o tooltip à esquerda (fora do painel) ou direita
    // Normalmente à esquerda do painel se houver espaço
    leftPos = rect.left - ttRect.width - 16;
    if (leftPos < 0) leftPos = rect.right + 16;
  } else {
    // Barra lateral padrão (esquerda)
    leftPos = rect.right + 12;
  }

  // Centralizar verticalmente com o botão, mas não sair da tela
  topPos = rect.top + (rect.height / 2) - (ttRect.height / 2);
  
  // Limites da janela
  if (topPos < 16) topPos = 16;
  if (topPos + ttRect.height > window.innerHeight - 16) {
    topPos = window.innerHeight - ttRect.height - 16;
  }

  tooltipEl.style.left = \`\${leftPos}px\`;
  tooltipEl.style.top = \`\${topPos}px\`;
  
  // Trigger animation (fade + slide)
  requestAnimationFrame(() => {
    tooltipEl.style.opacity = '1';
    tooltipEl.style.transform = 'translateY(0)';
  });
}

function hideRichTooltip(tooltipEl) {
  if (!tooltipEl) return;
  tooltipEl.style.opacity = '0';
  tooltipEl.style.transform = 'translateY(4px)'; // reset slide
  // Depois que a transição acabar, display none
  setTimeout(() => {
    if (tooltipEl.style.opacity === '0') {
      tooltipEl.style.display = 'none';
    }
  }, 200); // 200ms igual a transição no CSS
}

// Inicializar após carregamento do DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initRichTooltips, 500); 
  });
} else {
  setTimeout(initRichTooltips, 500);
}
