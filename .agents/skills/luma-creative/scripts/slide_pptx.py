#!/usr/bin/env python3
"""
Slides da Delivery Much em .pptx editável (skill luma-creative §3.5).

Parte SEMPRE do Template de Apresentações 2026 (assets/slides/template-apresentacoes-2026.pptx),
que traz os layouts, os fundos e as fontes Roboto embutidas. Cada slide do deck é:

  • "base": N  → duplica o slide de exemplo N do template e troca os textos
                 ("trocar": {"texto do exemplo": "texto novo"} — lista = uma troca por ocorrência);
                 "mais": [elementos] sobrepõe elementos livres ao slide-base;
  • "livre"    → slide em branco montado com elementos posicionados em px de um canvas 1920×1080
                 (mesmas coordenadas do SVG de conferência): imagem, texto, card (raio 0 + h 4 = fio).
                 "rotacao" em graus vale para imagem e card.

O deck de saída tem só os slides pedidos (os exemplos continuam no template, para consulta).
As logos "Você Pede" do template viram logos da Delivery Much (LOGOS_VP).

Uso:   python3 .agents/skills/luma-creative/scripts/slide_pptx.py deck.json saida.pptx
Requer python-pptx (pip install python-pptx). Ferramenta da skill, não do app.

deck.json:
{
  "slides": [
    { "base": 4, "trocar": { "Título de uma linha": "A concorrência chegou ao interior",
                             "Subtítulo de uma linha": "Mercado · outubro de 2026" } },
    { "livre": [
        { "tipo": "imagem", "arquivo": "slides/fundo-mapa-brasil.jpg", "x": 0, "y": 0, "w": 1920, "h": 1080 },
        { "tipo": "card", "x": 120, "y": 540, "w": 700, "h": 132, "cor": "#FFFFFF", "raio": 36 },
        { "tipo": "texto", "x": 120, "y": 280, "w": 760, "h": 200, "texto": "A concorrência\\nchegou ao interior",
          "tamanho": 82, "cor": "#FFFFFF", "peso": "regular|medium|black", "alinhar": "esq|centro|dir" }
    ] }
  ]
}
Caminhos de "arquivo" são relativos a .agents/skills/luma-creative/assets/. Tamanho de texto em px
do canvas 1920 (o script converte: 1 px = 0,375 pt).
"""
import copy, json, os, re, sys
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

AQUI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(AQUI, '..', 'assets')
TEMPLATE = os.path.join(ASSETS, 'slides', 'template-apresentacoes-2026.pptx')
PX = 9144000 / 1920          # EMU por px do canvas 1920×1080
FONTE = {'regular': 'Roboto', 'medium': 'Roboto Medium', 'black': 'Roboto Black', 'light': 'Roboto Light'}


def _rgb(h):
    h = h.lstrip('#'); return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _formas(shapes):
    for sh in shapes:
        yield sh
        if sh.shape_type == 6:          # grupo
            yield from _formas(sh.shapes)


def duplicar(prs, n):
    """Cópia fiel do slide de exemplo n (formas, fundo e imagens)."""
    src = prs.slides[n - 1]
    novo = prs.slides.add_slide(src.slide_layout)
    for sh in list(novo.shapes):
        sh._element.getparent().remove(sh._element)
    mapa = {}
    for rId, rel in src.part.rels.items():
        if 'notesSlide' in rel.reltype or 'slideLayout' in rel.reltype:
            continue
        mapa[rId] = novo.part.rels.get_or_add(rel.reltype, rel._target) if not rel.is_external \
            else novo.part.rels.get_or_add_ext_rel(rel.reltype, rel.target_ref)
    xml_src = copy.deepcopy(src._element.cSld)
    # religa as imagens (r:embed / r:link / r:id) para os rIds do slide novo
    for el in xml_src.iter():
        for at in list(el.attrib):
            if at.endswith('}embed') or at.endswith('}link') or at.endswith('}id'):
                if el.attrib[at] in mapa:
                    el.attrib[at] = mapa[el.attrib[at]]
    # troca o conteúdo DENTRO do cSld/spTree do slide novo (o python-pptx guarda a spTree em cache)
    dst = novo._element.cSld
    if xml_src.bg is not None:
        dst.insert(0, xml_src.bg)
    arvore = dst.spTree
    for ch in list(arvore):
        arvore.remove(ch)
    for ch in list(xml_src.spTree):
        arvore.append(ch)
    return novo


# Logos "Você Pede" do template (sha1 da imagem) → logo da Delivery Much (decisão do Ryan: slide usa a DM)
LOGOS_VP = {'ec8c0ecfd1': 'logos/dm-h-branca.png',      # logo branca da capa
            '1b99844dfc': 'logos/dm-simbolo.png'}       # selo colorido no canto dos layouts


def logo_dm(parte, formas):
    """Troca as logos Você Pede por logos DM, cabendo na mesma caixa (contain, alinhada à esquerda)."""
    from pptx.shapes.picture import Picture
    for sh in formas:
        if not isinstance(sh, Picture):
            continue
        try:
            arq = LOGOS_VP.get(sh.image.sha1[:10])
        except Exception:
            continue
        if not arq:
            continue
        caminho = os.path.join(ASSETS, arq)
        img, rId = parte.get_or_add_image_part(caminho)
        sh._element.blipFill.blip.rEmbed = rId
        iw, ih = img._px_size
        x, y, w, h = sh.left, sh.top, sh.width, sh.height
        esc = min(w / iw, h / ih)
        nw, nh = int(iw * esc), int(ih * esc)
        sh.left, sh.top, sh.width, sh.height = x, y + (h - nh) // 2, nw, nh
        sh.crop_left = sh.crop_right = sh.crop_top = sh.crop_bottom = 0


def trocar_textos(slide, trocas):
    """Troca por trecho, mantendo a formatação do 1º run. Valor em lista = uma troca por ocorrência,
    na ordem do slide (ex.: os três "Colocar o texto aqui")."""
    fila = {k: list(v) if isinstance(v, list) else None for k, v in trocas.items()}
    for sh in _formas(slide.shapes):
        if not sh.has_text_frame:
            continue
        for p in sh.text_frame.paragraphs:
            atual = ''.join(r.text for r in p.runs)
            for velho, novo in trocas.items():
                if not (velho and velho in atual and p.runs):
                    continue
                if fila[velho] is not None:
                    if not fila[velho]:
                        continue
                    atual = atual.replace(velho, fila[velho].pop(0), 1)
                else:
                    atual = atual.replace(velho, novo)
                p.runs[0].text = atual
                for r in p.runs[1:]:
                    r.text = ''


def livre(prs, elementos, s=None):
    s = s or prs.slides.add_slide(prs.slide_layouts[0])      # BLANK
    for e in elementos:
        x, y, w, h = (Emu(int(e.get(k, 0) * PX)) for k in ('x', 'y', 'w', 'h'))
        if e['tipo'] == 'imagem':
            im = s.shapes.add_picture(os.path.join(ASSETS, e['arquivo']), x, y, w, h)
            im.rotation = e.get('rotacao', 0)
        elif e['tipo'] == 'card':
            c = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
            c.adjustments[0] = min(0.5, e.get('raio', 36) / max(1, min(e['w'], e['h'])))
            c.fill.solid(); c.fill.fore_color.rgb = _rgb(e.get('cor', '#FFFFFF')); c.line.fill.background()
            c.shadow.inherit = False
            c.rotation = e.get('rotacao', 0)
        elif e['tipo'] == 'texto':
            tb = s.shapes.add_textbox(x, y, w, h)
            tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.TOP
            tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
            for i, linha in enumerate(str(e['texto']).split('\n')):
                p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                p.alignment = {'centro': PP_ALIGN.CENTER, 'dir': PP_ALIGN.RIGHT}.get(e.get('alinhar'), PP_ALIGN.LEFT)
                r = p.add_run(); r.text = linha
                r.font.size = Pt(e.get('tamanho', 32) * 0.375)
                r.font.name = FONTE.get(e.get('peso', 'regular'), 'Roboto')
                r.font.color.rgb = _rgb(e.get('cor', '#FFFFFF'))
    return s


def main(spec_path, saida):
    deck = json.load(open(spec_path, encoding='utf-8'))
    prs = Presentation(TEMPLATE)
    exemplos = len(prs.slides)
    for sd in deck['slides']:
        if 'base' in sd:
            novo = duplicar(prs, int(sd['base']))
            trocar_textos(novo, sd.get('trocar', {}))
            if sd.get('mais'):
                livre(prs, sd['mais'], novo)
        else:
            livre(prs, sd['livre'])
    # o deck sai só com os slides pedidos; os exemplos ficam no template
    ids = prs.slides._sldIdLst
    for sld in list(ids)[:exemplos]:
        prs.part.drop_rel(sld.rId); ids.remove(sld)
    for lay in prs.slide_layouts:
        logo_dm(lay.part, lay.shapes)
    for sl in prs.slides:
        logo_dm(sl.part, _formas(sl.shapes))
    prs.save(saida)
    print(saida, '—', len(prs.slides), 'slide(s)')
    # texto de exemplo que sobrou = slide inacabado
    for i, sl in enumerate(prs.slides, 1):
        for sh in _formas(sl.shapes):
            t = sh.text_frame.text if sh.has_text_frame else ''
            if re.search(r'Colocar|Lorem|\bXX\b|Título|Subtítulo|Nome|Cargo', t):
                print(f'  ATENÇÃO slide {i}: sobrou texto de exemplo → "{t.strip()[:50]}"')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
