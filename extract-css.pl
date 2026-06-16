#!/usr/bin/perl
use strict;
use warnings;

my $base      = "/Users/mucher/Downloads/Modulo Yungas";
my $html_path = "$base/yungas-artes-piloto.html";

# ── 1. Read HTML ─────────────────────────────────────────────────────────────
open(my $fh, '<', $html_path) or die "Cannot open $html_path: $!";
my @html = <$fh>;
close($fh);
chomp @html;

# ── 2. Extract CSS lines (HTML lines 10–2899 → indices 9..2898) ──────────────
# css_lines[N] = HTML line 10+N  →  css_lines index = grep/sed line number − 2
my @css_lines = @html[9..2898];
my $css = join("\n", @css_lines);

# ── 3. Replace base64 font → file reference ───────────────────────────────────
$css =~ s{src:url\(data:font/woff2;base64,[A-Za-z0-9+/=\n\r\s]+\)}
         {src:url('../assets/fonts/realce-black.woff2')}s;

# ── 4. Replace base64 logos → file references ────────────────────────────────
my %logo_map = (
    '--logo-h-branca'    => 'dm-h-branca.png',
    '--logo-h-preta'     => 'dm-h-preta.png',
    '--logo-h-laranja'   => 'dm-h-laranja.png',
    '--logo-h-principal' => 'dm-h-principal.png',
    '--logo-v-branca'    => 'dm-v-branca.png',
    '--logo-v-principal' => 'dm-v-principal.png',
);
for my $var (keys %logo_map) {
    my $file = $logo_map{$var};
    $css =~ s{(\Q$var\E:\s*)url\('data:image/png;base64,[A-Za-z0-9+/=]+'\)}
             {$1url('../assets/logos/$file')}g;
}

# ── 5. Split back into lines ──────────────────────────────────────────────────
my @cl = split(/\n/, $css, -1);   # -1 preserves trailing empty strings

# ── 6. Section boundaries (css_lines index = grep/sed line − 2) ──────────────
# Format: [ start_idx, end_idx, 'target/path.css' ]
# For files that receive multiple non-contiguous chunks, content is appended.
my @sections = (
    [    0,    6, 'css/03-fonts.css'                  ],
    [    8,   11, 'css/01-reset.css'                  ],  # mode switching
    [   12,   55, 'css/00-tokens.css'                 ],  # brandbook + logos
    [   56,   59, 'css/01-reset.css'                  ],  # html,body (append)
    [   60,  123, 'css/02-animations.css'             ],
    [  124,  170, 'css/components/topbar.css'         ],
    [  171,  265, 'css/modules/franqueado.css'        ],
    [  266,  443, 'css/modules/chat.css'              ],  # chat + upload
    [  444,  625, 'css/modules/live-preview.css'      ],
    [  626,  799, 'css/modules/catalog.css'           ],
    [  800,  945, 'css/components/help-modal.css'     ],
    [  946, 1598, 'css/components/tutorial.css'       ],
    [ 1599, 1838, 'css/modules/publish-modal.css'     ],  # publish + f-preview
    [ 1839, 2121, 'css/modules/designer.css'          ],  # VIEW DESIGNER
    [ 2122, 2338, 'css/modules/layers-panel.css'      ],  # side panel + library
    [ 2339, 2426, 'css/modules/designer.css'          ],  # nova estrutura (append)
    [ 2427, 2740, 'css/modules/toolbar.css'           ],
    [ 2741, 2889, 'css/modules/designer.css'          ],  # preview modal (append)
);

# ── 7. File headers ───────────────────────────────────────────────────────────
my %headers = (
    'css/03-fonts.css' => "/**\n * css/03-fonts.css\n *\n * \@font-face do Realce Black (fonte proprietaria DM).\n * Referencia assets/fonts/realce-black.woff2.\n */",
    'css/00-tokens.css' => "/**\n * css/00-tokens.css\n *\n * Variaveis CSS globais: brandbook DM 2025, logos, espacamentos, radii.\n * Deve ser o primeiro CSS carregado (outros arquivos dependem destas vars).\n */",
    'css/01-reset.css' => "/**\n * css/01-reset.css\n *\n * Reset global: body, html, modo ativo (franqueado/designer), acessibilidade.\n */",
    'css/02-animations.css' => "/**\n * css/02-animations.css\n *\n * Keyframes globais prefixados g* (gFadeIn, gScaleIn, gShimmer, etc).\n * Depende de: 00-tokens.css\n */",
    'css/components/topbar.css' => "/**\n * css/components/topbar.css\n *\n * #global-topbar, .mode-tabs, botao de ajuda e area direita do topbar.\n * Compartilhado entre modo franqueado e designer.\n */",
    'css/modules/franqueado.css' => "/**\n * css/modules/franqueado.css\n *\n * Layout e componentes do #view-franqueado: painel esquerdo, abas,\n * cards do catalogo, historico de artes, status filters.\n * Depende de: 00-tokens.css, 02-animations.css\n */",
    'css/modules/chat.css' => "/**\n * css/modules/chat.css\n *\n * Bolhas de mensagem, input, sugestoes de resposta rapida, confirm card,\n * art card, typing indicator, upload de imagem no chat.\n * Depende de: 00-tokens.css, 02-animations.css\n */",
    'css/modules/live-preview.css' => "/**\n * css/modules/live-preview.css\n *\n * Preview lateral em tempo real do franqueado (#f-right-body, .lp-*).\n * Inclui \@media queries para telas estreitas.\n * Depende de: 00-tokens.css, 02-animations.css\n */",
    'css/modules/catalog.css' => "/**\n * css/modules/catalog.css\n *\n * Catalogo de materiais do franqueado (.f-mat-*): grid, cards, thumbs,\n * badges de urgencia e validade.\n * Depende de: 00-tokens.css\n */",
    'css/components/help-modal.css' => "/**\n * css/components/help-modal.css\n *\n * Modal de ajuda e suporte (gOpenHelp): cards de tutorial, layout 2 colunas.\n * Inclui \@media para mobile.\n * Depende de: 00-tokens.css, 02-animations.css\n */",
    'css/components/tutorial.css' => "/**\n * css/components/tutorial.css\n *\n * TutorialEngine completo: stage overlay, spotlight, cursor virtual,\n * tooltip, progress, controles play/pause.\n * Depende de: 00-tokens.css, 02-animations.css\n */",
    'css/modules/publish-modal.css' => "/**\n * css/modules/publish-modal.css\n *\n * Modal de publicacao do designer (4 abas) e modal de preview\n * multi-formato do franqueado (#f-preview-modal, .pv-*).\n * Depende de: 00-tokens.css, 02-animations.css\n */",
    'css/modules/designer.css' => "/**\n * css/modules/designer.css\n *\n * #view-designer (dark mode): layout principal, tema claro, iconbar,\n * topbar do designer, barra contextual e preview modal do designer.\n * Depende de: 00-tokens.css, 02-animations.css\n */",
    'css/modules/layers-panel.css' => "/**\n * css/modules/layers-panel.css\n *\n * #d-side-panel: painel lateral com abas (layers, props, assets),\n * biblioteca de assets (.d-lib-*).\n * Depende de: 00-tokens.css, css/modules/designer.css\n */",
    'css/modules/toolbar.css' => "/**\n * css/modules/toolbar.css\n *\n * Toolbar vertical estilo Photoshop (#d-vtoolbar), brush bar (#d-brush-bar),\n * ferramentas de selecao, texto, formas, frame, etc.\n * Depende de: 00-tokens.css, css/modules/designer.css\n */",
);

# ── 8. Collect content per file ───────────────────────────────────────────────
my %file_content;
my @file_order;

for my $sec (@sections) {
    my ($start, $end, $target) = @$sec;
    unless (exists $file_content{$target}) {
        $file_content{$target} = '';
        push @file_order, $target;
    }
    my $chunk = join("\n", @cl[$start..$end]);
    $file_content{$target} .= ($file_content{$target} =~ /\S/ ? "\n\n" : '') . $chunk;
}

# ── 9. Write CSS files ────────────────────────────────────────────────────────
my $total_files = 0;
my $total_bytes = 0;

for my $rel (@file_order) {
    my $path     = "$base/$rel";
    my $header   = $headers{$rel} // "/** $rel */";
    my $content  = $header . "\n\n" . $file_content{$rel} . "\n";

    open(my $out, '>', $path) or die "Cannot write $path: $!";
    print $out $content;
    close($out);

    my $size = -s $path;
    $total_bytes += $size;
    $total_files++;
    printf "  %-45s %6d bytes\n", $rel, $size;
}

printf "\nTotal: %d arquivos, %d bytes (%.1fKB)\n",
       $total_files, $total_bytes, $total_bytes/1024;

# ── 10. Build new index.html ──────────────────────────────────────────────────
# CSS link order (must match loading dependencies)
my @css_links = (
    'css/03-fonts.css',
    'css/00-tokens.css',
    'css/01-reset.css',
    'css/02-animations.css',
    'css/components/topbar.css',
    'css/components/help-modal.css',
    'css/components/tutorial.css',
    'css/modules/franqueado.css',
    'css/modules/chat.css',
    'css/modules/live-preview.css',
    'css/modules/catalog.css',
    'css/modules/publish-modal.css',
    'css/modules/designer.css',
    'css/modules/layers-panel.css',
    'css/modules/toolbar.css',
);

my $link_tags = join("\n", map { qq(<link rel="stylesheet" href="$_">) } @css_links);

# Head: HTML lines 1-8 (indices 0-7), then link tags, then </head>
# Body markup: HTML lines 2902-3715 (indices 2901-3714)
# Script block: HTML lines 3716-9094 (indices 3715-9093) — unchanged
# Remaining HTML: HTML lines 9095-9316 (indices 9094-9315)

my $head   = join("\n", @html[0..7]);            # lines 1-8 (no <style>)
my $body1  = join("\n", @html[2901..3714]);      # body markup before <script>
my $script = join("\n", @html[3715..9093]);      # <script>...</script>
my $body2  = join("\n", @html[9094..9314]);      # markup after </script>
my $close  = join("\n", @html[9315..9315]);      # </body></html>

my $index = <<END_HTML;
$head
$link_tags
</head>
$body1

$script

$body2
$close
END_HTML

my $index_path = "$base/index.html";
open(my $idx, '>', $index_path) or die "Cannot write $index_path: $!";
print $idx $index;
close($idx);

printf "  %-45s %6d bytes\n\n", 'index.html', -s $index_path;
print "Fase 3 concluída.\n";
