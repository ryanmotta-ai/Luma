#!/usr/bin/perl
use strict;
use warnings;

my $base       = "/Users/mucher/Downloads/Modulo Yungas";
my $html_path  = "$base/index.html";   # já tem CSS externo; JS ainda inline

# ── 1. Read index.html ───────────────────────────────────────────────────────
open(my $fh, '<', $html_path) or die "Cannot open $html_path: $!";
my @html = <$fh>;
close($fh);
chomp @html;

# Verify script tag positions
die "Linha 840 não é <script>" unless $html[839] =~ /^<script>/;
die "Linha 6218 não é </script>" unless $html[6217] =~ /^<\/script>/;

# ── 2. Extract JS lines (0-indexed html: 840..6216) ─────────────────────────
# grep_line N = html line 840+N-1 → js_lines index = grep_line - 2
my @jl = @html[840..6216];   # 5377 JS lines, index 0..5376

# ── 3. Section boundaries (grep_line N → jl index N-2) ──────────────────────
# Format: [ jl_start_idx, jl_end_idx, 'target/path.js' ]
my @sections = (
    [    0,   13, 'js/main.js'                     ],  # setMode
    [   14,   27, 'js/core/toast.js'               ],  # gToast
    [   29,   59, 'js/core/help.js'                ],  # gOpenHelp…gHelpAction
    [   60,   93, 'js/tutorial/engine.js'          ],  # tutState + helpers
    [   95,  526, 'js/tutorial/catalog.js'         ],  # TUTORIALS const
    [  529,  572, 'js/tutorial/mocks.js'           ],  # tutMock*
    [  574,  841, 'js/tutorial/engine.js'          ],  # tut* funcs (append)
    [  842,  847, 'js/core/help.js'                ],  # Esc listener (append)
    [  849,  910, 'js/00-config.js'                ],  # HIST_KEY, CAMPS_*, FMTS
    [  912,  912, 'js/01-state.js'                 ],  # fState
    [  914,  987, 'js/franqueado/history.js'       ],  # HISTÓRICO
    [  988, 1248, 'js/franqueado/catalog.js'       ],  # TABS + fSelectCamp
    [ 1249, 1431, 'js/franqueado/materials.js'     ],  # material catalog
    [ 1432, 1556, 'js/franqueado/chat.js'          ],  # flow funcs
    [ 1557, 1594, 'js/franqueado/live-preview.js'  ],  # fOpenPreview
    [ 1595, 2018, 'js/franqueado/chat.js'          ],  # chat flow (append)
    [ 2019, 2188, 'js/franqueado/chat-input.js'    ],  # F-02 field types
    [ 2189, 2527, 'js/franqueado/png-generator.js' ],  # PNG download
    [ 2528, 2661, 'js/franqueado/live-preview.js'  ],  # live preview (append)
    [ 2662, 3034, 'js/designer/templates.js'       ],  # designer state + folders
    [ 3035, 3258, 'js/designer/canvas.js'          ],  # format, zoom, render
    [ 3259, 3431, 'js/designer/brush.js'           ],  # paint/brush/stamp
    [ 3432, 3793, 'js/designer/layers.js'          ],  # selection, layerlist, props
    [ 3794, 3991, 'js/designer/publish.js'         ],  # publish modal
    [ 3992, 4356, 'js/designer/preview.js'         ],  # preview engine
    [ 4357, 4529, 'js/designer/library.js'         ],  # panel toggle
    [ 4530, 4568, 'js/designer/undo-redo.js'       ],  # history push/undo/redo
    [ 4569, 4713, 'js/designer/library.js'         ],  # library (append)
    [ 4714, 4815, 'js/designer/canvas.js'          ],  # ctx bar (append)
    [ 4816, 4907, 'js/designer/canvas.js'          ],  # smart guides (append)
    [ 4908, 4972, 'js/designer/canvas.js'          ],  # sim modal (append)
    [ 4973, 5001, 'js/designer/tools.js'           ],  # eyedropper
    [ 5002, 5040, 'js/designer/layers.js'          ],  # multi-select (append)
    [ 5041, 5097, 'js/designer/canvas.js'          ],  # rulers (append)
    [ 5098, 5135, 'js/designer/layers.js'          ],  # rename layer (append)
    [ 5136, 5258, 'js/designer/tools.js'           ],  # autofit + eyedrop (append)
    [ 5259, 5271, 'js/designer/tools.js'           ],  # bucket fill (append)
    [ 5272, 5348, 'js/designer/brush.js'           ],  # brush bar (append)
    [ 5349, 5370, 'js/designer/layers.js'          ],  # new layer types (append)
    [ 5372, 5376, 'js/main.js'                     ],  # INIT FRANQUEADO (append)
);

# ── 4. File headers ───────────────────────────────────────────────────────────
my %headers = (
    'js/main.js'                      => "/**\n * js/main.js\n *\n * Bootstrap: setMode (troca entre franqueado/designer) e chamadas de inicializacao.\n * Deve ser carregado por ULTIMO (apos todos os modulos).\n */",
    'js/core/toast.js'                => "/**\n * js/core/toast.js\n *\n * gToast(msg) — exibe notificacao flutuante de 2.8s.\n * Depende de: nada (usa apenas o DOM).\n */",
    'js/core/help.js'                 => "/**\n * js/core/help.js\n *\n * gOpenHelp, gCloseHelp, gHelpAction — modal de ajuda e suporte.\n * Mapeia cards de ajuda para tutoriais via tutOpen().\n * Depende de: tutorial/engine.js (tutOpen)\n */",
    'js/tutorial/engine.js'           => "/**\n * js/tutorial/engine.js\n *\n * Engine do TutorialEngine: tutState, tutOpen, tutClose, tutNext,\n * tutGoToScene, tutRenderScene, cursor virtual, spotlights, progress.\n * Depende de: 01-state.js, tutorial/catalog.js, tutorial/mocks.js\n * Exporta: tutOpen, tutClose, tutNext, tutPrev, tutTogglePlay, tutGoToScene\n */",
    'js/tutorial/catalog.js'          => "/**\n * js/tutorial/catalog.js\n *\n * TUTORIALS = {...} — catalogo dos 4 tutoriais interativos.\n * Cada tutorial define titulo, descricao e array de cenas com build().\n * Depende de: tutorial/mocks.js (tutMockCampaign etc)\n */",
    'js/tutorial/mocks.js'            => "/**\n * js/tutorial/mocks.js\n *\n * tutMockCampaign, tutMockMaterial, tutMockHist —\n * builders de HTML de mock usados nas cenas de tutorial.\n * Depende de: nada (retorna strings HTML).\n */",
    'js/00-config.js'                 => "/**\n * js/00-config.js\n *\n * Constantes globais imutaveis: HIST_KEY, CAMPS_ATIVAS, CAMPS_OUTRAS, FMTS.\n * Deve ser carregado PRIMEIRO (todos os modulos dependem destas constantes).\n */",
    'js/01-state.js'                  => "/**\n * js/01-state.js\n *\n * Estado global do franqueado: fState.\n * Deve ser carregado apos 00-config.js.\n */",
    'js/franqueado/history.js'        => "/**\n * js/franqueado/history.js\n *\n * Historico de artes do franqueado: fGetHist, fSaveHist, fAddHist,\n * fMarkHistBaixada, fUpdateHistBadge, fRenderHist, fDownloadHist.\n * Persiste em localStorage (HIST_KEY).\n * Depende de: 00-config.js (HIST_KEY), 01-state.js (fState)\n */",
    'js/franqueado/catalog.js'        => "/**\n * js/franqueado/catalog.js\n *\n * Catalogo de campanhas: fRenderCatalogs, fFilterCamps, fSelectCamp,\n * fSwitchTab, fSetHistFilter, fRenderHist, fEditFromHist, fDuplicateInOtherFmt.\n * Depende de: 00-config.js, 01-state.js\n */",
    'js/franqueado/materials.js'      => "/**\n * js/franqueado/materials.js\n *\n * Catalogo de materiais do franqueado: fOpenMaterialCatalog,\n * fRenderMaterialCatalog, fRenderMaterialCard, fCloseMaterialCatalog, fSelectMaterial.\n * Depende de: 00-config.js, 01-state.js, franqueado/chat.js\n */",
    'js/franqueado/chat.js'           => "/**\n * js/franqueado/chat.js\n *\n * Fluxo conversacional completo: fStartChat, fNextStep, fAddBot, fAddUser,\n * fSend, fQR, fTyping, fGoBack, upload de imagem, confirm card, fGerarArte.\n * Depende de: 00-config.js, 01-state.js, franqueado/chat-input.js\n */",
    'js/franqueado/live-preview.js'   => "/**\n * js/franqueado/live-preview.js\n *\n * Preview lateral em tempo real (fUpdateLivePreview) e modal de preview\n * multi-formato (fOpenPreview, fClosePreview, fStartFromPreview).\n * Depende de: 00-config.js, 01-state.js\n */",
    'js/franqueado/chat-input.js'     => "/**\n * js/franqueado/chat-input.js\n *\n * F-02: tipos de campo, mascaras de input, validacao por campo.\n * F_FIELD_TYPES define o comportamento de cada variavel do template.\n * Depende de: 00-config.js\n */",
    'js/franqueado/png-generator.js'  => "/**\n * js/franqueado/png-generator.js\n *\n * Geracao de PNG a partir dos templates: fGenPNG, fRenderTemplateLayers,\n * fBaixar, fOutroFormato. Sistema de nomenclatura padronizado para downloads.\n * Depende de: 00-config.js, 01-state.js, designer/canvas.js (dRenderCanvas)\n */",
    'js/designer/templates.js'        => "/**\n * js/designer/templates.js\n *\n * Estado e CRUD de templates/pastas: dFolders, dInit, dRenderFolders,\n * dLoadTemplateById, dBuildLayers, dLoadTemplate, dOpenNewFolder, dConfirmTemplate.\n * Depende de: 00-config.js\n */",
    'js/designer/canvas.js'           => "/**\n * js/designer/canvas.js\n *\n * Render do canvas, zoom, pan, formato, réguas, barra contextual,\n * smart guides, simulacao de dados e interacoes de mouse.\n * Depende de: designer/templates.js, designer/layers.js\n */",
    'js/designer/brush.js'            => "/**\n * js/designer/brush.js\n *\n * Sistema de pincel/borracha/carimbo: dPaintStart, dPaintMove, dPaintEnd,\n * dDoStamp, dBrushUpdate, dBrushSetPreset, dShowBrushBar.\n * Depende de: designer/canvas.js\n */",
    'js/designer/layers.js'           => "/**\n * js/designer/layers.js\n *\n * CRUD de layers, painel lateral, props, multi-select, rename:\n * dSelLayer, dDeselect, dRenderLayersList, dShowProps, dAddText,\n * dAddShape, dToggleMultiSel, dRenameLayer, dAddIcon, dAddLine.\n * Depende de: designer/canvas.js\n */",
    'js/designer/publish.js'          => "/**\n * js/designer/publish.js\n *\n * Modal de publicacao de templates (4 abas): dPublishOpen, dPublishClose,\n * dPublishSwitchTab, dPublishRender, dPublishConfirm.\n * Depende de: designer/templates.js\n */",
    'js/designer/preview.js'          => "/**\n * js/designer/preview.js\n *\n * Preview engine do designer: pvRender, pvRenderLayers, pvRenderLayer,\n * dPreviewOpen, dPreviewClose, dPreviewSetFmt, dPreviewDownload.\n * Depende de: designer/canvas.js, designer/layers.js\n */",
    'js/designer/library.js'          => "/**\n * js/designer/library.js\n *\n * Painel lateral e biblioteca de assets: dTogglePanel, dLibRenderCats,\n * dLibRender, dLibUpload, dLibUse, dLibDelete, dToggleTheme.\n * Depende de: designer/canvas.js\n */",
    'js/designer/undo-redo.js'        => "/**\n * js/designer/undo-redo.js\n *\n * Historico de acoes do designer: dHistoryPush, dUndo, dRedo,\n * dUpdateUndoButtons, dFlashLayer, dDuplicateLayer.\n * Depende de: designer/canvas.js\n */",
    'js/designer/tools.js'            => "/**\n * js/designer/tools.js\n *\n * Ferramentas do designer: eyedropper, auto-fit de texto, bucket fill,\n * dStartInlineEdit, dEndInlineEdit, dHexSync, dHexInput, dToggleLock.\n * Depende de: designer/canvas.js, designer/layers.js\n */",
);

# ── 5. Collect content per file ───────────────────────────────────────────────
my %file_content;
my @file_order;

for my $sec (@sections) {
    my ($start, $end, $target) = @$sec;
    # Safety check
    if ($end >= scalar @jl) { $end = $#jl; }
    unless (exists $file_content{$target}) {
        $file_content{$target} = '';
        push @file_order, $target;
    }
    my $chunk = join("\n", @jl[$start..$end]);
    $file_content{$target} .= ($file_content{$target} =~ /\S/ ? "\n\n" : '') . $chunk;
}

# ── 6. Write JS files ─────────────────────────────────────────────────────────
my $total_files = 0;
my $total_bytes = 0;

for my $rel (@file_order) {
    my $path    = "$base/$rel";
    my $header  = $headers{$rel} // "/** $rel */";
    my $content = $header . "\n\n" . $file_content{$rel} . "\n";

    open(my $out, '>', $path) or die "Cannot write $path: $!";
    print $out $content;
    close($out);

    my $size = -s $path;
    $total_bytes += $size;
    $total_files++;
    printf "  %-50s %6d bytes\n", $rel, $size;
}

printf "\nTotal: %d arquivos JS, %d bytes (%.1fKB)\n",
       $total_files, $total_bytes, $total_bytes/1024;

# ── 7. Build new index.html (external scripts) ───────────────────────────────
my @script_tags = (
    'js/00-config.js',
    'js/01-state.js',
    'js/core/toast.js',
    'js/core/help.js',
    'js/tutorial/catalog.js',
    'js/tutorial/mocks.js',
    'js/tutorial/engine.js',
    'js/franqueado/history.js',
    'js/franqueado/catalog.js',
    'js/franqueado/materials.js',
    'js/franqueado/chat.js',
    'js/franqueado/live-preview.js',
    'js/franqueado/chat-input.js',
    'js/franqueado/png-generator.js',
    'js/designer/templates.js',
    'js/designer/canvas.js',
    'js/designer/brush.js',
    'js/designer/layers.js',
    'js/designer/publish.js',
    'js/designer/preview.js',
    'js/designer/library.js',
    'js/designer/undo-redo.js',
    'js/designer/tools.js',
    'js/main.js',
);

my $script_links = join("\n", map { qq(<script src="$_"></script>) } @script_tags);

# Head section: html lines 1-839 (indices 0..838) — already has CSS links
my $head_body = join("\n", @html[0..838]);

# Post-script markup: html lines 6219..end (indices 6218..$#html)
my $post = join("\n", @html[6218..$#html]);

my $new_index = <<END_HTML;
$head_body

$script_links

$post
END_HTML

my $index_path = "$base/index.html";
open(my $idx, '>', $index_path) or die "Cannot write $index_path: $!";
print $idx $new_index;
close($idx);

printf "  %-50s %6d bytes\n\n", 'index.html (atualizado)', -s $index_path;
print "Fase 5 concluída.\n";
