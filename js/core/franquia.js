/* ============================================================
   LUMA — A franquia de quem está logado (30/09/2026)
   ------------------------------------------------------------
   luma.franquias + luma.usuario_franquias existem desde 23/09, mas quase ninguém estava
   vinculado: a cidade do franqueado era adivinhada pelo campo da arte. Aqui:
     · gFranquiaIniciar()  — no login: lê o vínculo; franqueado sem franquia vê UMA pergunta
                             ("Qual é a sua franquia?"), com a opção de sugerir pela localização.
     · gMinhaFranquia()    — {id, nome, cidade, uf} ou null. Síncrona (cache da sessão).
   A escolha grava pelo RPC luma.escolher_minha_franquia (uma vez; trocar é com a gestão).
   A localização só SUGERE: a pessoa sempre confirma o nome antes de gravar.
   Sem as funções no banco (migration 20260930200000 não aplicada), nada aparece.
   Depende de: core/supabase.js (gSupabase/window.sb), core/auth.js (gCurrentUser/gCurrentRole),
   core/toast.js (gToast, gEsc), .g-dialog* em css/modules/toolbar.css.
   ============================================================ */
let _gFranquia = null;              // {id, nome, cidade, uf} do usuário logado
const G_FRANQUIA_ADIAR_KEY = 'luma_franquia_adiada_v1';
const G_FRANQUIA_RAIO_KM = 60;      // além disso a localização não sugere nada

function gMinhaFranquia(){ return _gFranquia; }
function _gFrSb(){ return (typeof gSupabase === 'function') ? gSupabase() : window.sb; }

async function gFranquiaCarregar(){
  const sb = _gFrSb(), u = (typeof gCurrentUser === 'function') ? gCurrentUser() : null;
  if(!sb || !u) return null;
  try{
    const { data, error } = await sb.schema('luma').from('usuario_franquias')
      .select('franquia_id, franquias(id, nome, cidade, uf)').eq('user_id', u.id).limit(1);
    if(error) return null;
    const f = data && data[0] && data[0].franquias;
    _gFranquia = f ? { id: f.id, nome: f.nome, cidade: f.cidade || '', uf: f.uf || '' } : null;
  }catch(e){ return null; }
  return _gFranquia;
}

/* Distância em km entre dois pontos (haversine) — só para achar a franquia mais perto. */
function _gFrKm(a, b){
  const R = 6371, rad = Math.PI / 180;
  const dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function gFranquiaMaisPerto(lista, pos){
  let melhor = null, dist = Infinity;
  (lista || []).forEach(f => {
    if(f.lat == null || f.lon == null) return;
    const d = _gFrKm(pos, { lat: f.lat, lon: f.lon });
    if(d < dist){ dist = d; melhor = f; }
  });
  return (melhor && dist <= G_FRANQUIA_RAIO_KM) ? { franquia: melhor, km: Math.round(dist) } : null;
}
const _gFrRotulo = f => f.nome + (f.cidade && f.nome.indexOf(f.cidade) < 0 ? ' — ' + f.cidade : '') + (f.uf ? '/' + f.uf : '');

function _gFranquiaPerguntar(lista){
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'g-dialog-ov';
    ov.innerHTML = `<div class="g-dialog has-input" role="dialog" aria-modal="true" aria-labelledby="g-fr-tit">
      <div class="g-dialog-title" id="g-fr-tit">Qual é a sua franquia?</div>
      <div class="g-dialog-msg">Assim o Luma fala a língua da sua cidade nas legendas. Você só responde uma vez.</div>
      <input class="g-dialog-input" type="text" list="g-fr-lista" placeholder="Digite o nome da cidade" autocomplete="off" aria-label="Sua franquia">
      <datalist id="g-fr-lista">${lista.map(f => `<option value="${gEsc(_gFrRotulo(f))}"></option>`).join('')}</datalist>
      <p class="g-fr-dica" aria-live="polite" style="margin:8px 0 12px;font-size:13px;color:var(--text-3)"></p>
      <div class="g-dialog-acts">
        <button class="g-dialog-cancel" type="button" data-a="depois">Depois</button>
        <button class="g-dialog-cancel" type="button" data-a="gps">Usar minha localização</button>
        <button class="g-dialog-ok" type="button" data-a="ok">Confirmar</button>
      </div></div>`;
    document.body.appendChild(ov);
    const input = ov.querySelector('input'), dica = ov.querySelector('.g-fr-dica');
    const achar = () => lista.find(f => _gFrRotulo(f).toLowerCase() === input.value.trim().toLowerCase());
    const fim = v => { ov.remove(); resolve(v); };
    ov.querySelector('[data-a="depois"]').onclick = () => fim(null);
    ov.querySelector('[data-a="ok"]').onclick = () => {
      const f = achar();
      if(!f){ dica.textContent = 'Escolha uma franquia da lista.'; input.focus(); return; }
      fim(f);
    };
    ov.querySelector('[data-a="gps"]').onclick = () => {
      if(!navigator.geolocation){ dica.textContent = 'Seu navegador não informa a localização. Digite a cidade.'; return; }
      dica.textContent = 'Procurando a franquia mais perto…';
      navigator.geolocation.getCurrentPosition(p => {
        const r = gFranquiaMaisPerto(lista, { lat: p.coords.latitude, lon: p.coords.longitude });
        if(r){ input.value = _gFrRotulo(r.franquia); dica.textContent = 'A mais perto de você (' + r.km + ' km). Confira e confirme.'; }
        else dica.textContent = 'Nenhuma franquia perto de você. Digite a cidade.';
      }, () => { dica.textContent = 'Não consegui a localização. Digite a cidade.'; }, { timeout: 8000, maximumAge: 600000 });
    };
    input.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); ov.querySelector('[data-a="ok"]').click(); } });
    setTimeout(() => input.focus(), 30);
  });
}

async function gFranquiaIniciar(){
  const role = (typeof gCurrentRole === 'function') ? gCurrentRole() : null;
  if(await gFranquiaCarregar()) return;
  if(role !== 'franqueado') return;
  try{ if(Date.now() - Number(localStorage.getItem(G_FRANQUIA_ADIAR_KEY) || 0) < 864e5) return; }catch(e){}
  const sb = _gFrSb();
  let lista = [];
  try{
    const { data, error } = await sb.schema('luma').rpc('franquias_para_escolha');
    if(error) return;                               // banco sem a função: não pergunta nada
    lista = data || [];
  }catch(e){ return; }
  if(!lista.length) return;
  const f = await _gFranquiaPerguntar(lista);
  if(!f){ try{ localStorage.setItem(G_FRANQUIA_ADIAR_KEY, String(Date.now())); }catch(e){} return; }
  const { error } = await sb.schema('luma').rpc('escolher_minha_franquia', { p_franquia: f.id });
  if(error){ gToast(String(error.message || 'Não consegui salvar a franquia.'), 'error'); return; }
  _gFranquia = { id: f.id, nome: f.nome, cidade: f.cidade || '', uf: f.uf || '' };
  if(typeof gTrackEvent === 'function') gTrackEvent('franquia_escolhida', { franquia: f.nome });
  gToast('Pronto: você está na franquia ' + f.nome + '.');
}
