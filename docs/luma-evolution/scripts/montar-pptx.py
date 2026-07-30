#!/usr/bin/env python3
"""docs/luma-evolution/scripts/montar-pptx.py — empacota os slides no .pptx.

    python3 docs/luma-evolution/scripts/montar-pptx.py

O nome do arquivo NAO pode ser pptx.py: o diretorio do script entra na frente do
sys.path, entao `import pptx` acharia este proprio arquivo em vez da biblioteca

Cada slide entra como uma imagem 1920x1080 ocupando a página inteira, e as notas do
apresentador vão para o campo de notas do PowerPoint.

POR QUE IMAGEM E NAO CAIXAS DE TEXTO: o layout ja foi desenhado e conferido em HTML.
Reimplementa-lo em formas do PowerPoint criaria uma segunda versao do mesmo visual para
divergir da primeira — e e exatamente ai que nascem texto cortado e imagem deformada.
Empacotando o PNG conferido, o .pptx mostra o que foi revisado, e nao uma aproximacao.

Custo assumido: o texto do .pptx nao e selecionavel nem editavel. Quem precisar mexer no
conteudo mexe no HTML e roda `node scripts/tudo.js --sem-captura` de novo — que e o fluxo
que mantem as tres saidas identicas entre si.
"""

import re
import sys
from pathlib import Path

try:
    from pptx import Presentation
    from pptx.util import Emu
except ImportError:
    sys.exit("falta o python-pptx: pip install python-pptx")

BASE = Path(__file__).resolve().parent.parent
# Sem argumento empacota a V1 (comportamento que ja existia); com prefixo, a variante.
#   python3 montar-pptx.py luma-evolution-v2
PREFIXO = sys.argv[1] if len(sys.argv) > 1 else "luma-evolution"
PNGS = BASE / "presentation" / ("slides-png" if PREFIXO == "luma-evolution" else PREFIXO + "-png")
NOTAS = BASE / "presentation" / (PREFIXO + ("-speaker-notes.md" if PREFIXO.endswith("v2") else "-notas.md"))
SAIDA = BASE / "presentation" / (PREFIXO + ".pptx")

# 16:9 em EMU (1 polegada = 914400 EMU): 13,333 x 7,5 pol = 1920x1080 a 144 dpi.
LARG, ALT = Emu(12192000), Emu(6858000)


def numero(caminho):
    """slide-07.png -> 7"""
    return int(re.search(r"(\d+)", caminho.stem).group(1))


def notas_por_slide():
    """Lê as notas do apresentador e devolve {numero_do_slide: texto}."""
    if not NOTAS.exists():
        return {}
    blocos = re.split(r"^## Slide (\d+)\s*$", NOTAS.read_text(encoding="utf-8"), flags=re.M)
    return {int(blocos[i]): blocos[i + 1].strip() for i in range(1, len(blocos) - 1, 2)}


def main():
    imagens = sorted(PNGS.glob("slide-*.png"), key=numero)
    if not imagens:
        sys.exit(f"nenhum PNG em {PNGS} — rode antes: node docs/luma-evolution/scripts/publicar.js")

    notas = notas_por_slide()
    prs = Presentation()
    prs.slide_width, prs.slide_height = LARG, ALT
    vazio = prs.slide_layouts[6]   # layout em branco: sem placeholder para atrapalhar

    com_notas = 0
    for img in imagens:
        s = prs.slides.add_slide(vazio)
        s.shapes.add_picture(str(img), 0, 0, width=LARG, height=ALT)
        texto = notas.get(numero(img))
        if texto:
            s.notes_slide.notes_text_frame.text = texto
            com_notas += 1

    prs.save(SAIDA)
    print(f"PPTX: {SAIDA.name} — {len(imagens)} slides, {com_notas} com notas do apresentador")


if __name__ == "__main__":
    main()
