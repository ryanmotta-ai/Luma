/**
 * js/01-state.js
 *
 * Estado global do franqueado: fState.
 * Deve ser carregado apos 00-config.js.
 */

// camp começa NULL de propósito: o franqueado escolhe a campanha (nada pré-selecionado).
// O chat só arranca em fSelectCamp/fSelectMaterial — no boot mostramos boas-vindas (fShowWelcome).
let fState={camp:null,fmt:FMTS[0],stepIdx:-1,dados:{},done:false,editIdx:null,tab:'catalogo',material:null,materialView:false,categoria:null};
