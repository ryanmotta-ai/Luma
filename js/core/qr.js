/**
 * js/core/qr.js
 *
 * Gerador de QR Code (modo byte, correção nível M) em Canvas — vanilla, zero dependência.
 * Existe por um motivo só: o "ver no meu celular" da prévia precisa virar um código que a
 * câmera do lojista lê. Nenhuma lib de assets/vendor/ faz QR, e API externa de geração está
 * fora de questão — mandaria a URL da arte do franqueado pra um terceiro.
 * Cobre versões 1–10 (até ~210 bytes), de sobra pra uma URL do Storage (~150 chars).
 * Expõe: gQRCanvas(texto, pxPorModulo, quietZone) → <canvas>, ou null se não couber.
 *
 * Referência do formato: ISO/IEC 18004. Os números mágicos aqui (0x11D, 0x537, 0x1F25,
 * 0x5412) são constantes da norma, não escolhas nossas — não "ajustar".
 */

/* ── GF(256): o corpo finito em que o Reed-Solomon do QR vive.
   Polinômio primitivo 0x11D, fixado pela norma. Tabelas de log/antilog trocam
   multiplicação por soma de índices (a conta fica trivial e sem laço). ── */
const _QR_EXP = new Uint8Array(512), _QR_LOG = new Uint8Array(256);
(function(){
  let x = 1;
  for(let i=0;i<255;i++){ _QR_EXP[i]=x; _QR_LOG[x]=i; x<<=1; if(x & 0x100) x^=0x11D; }
  for(let i=255;i<512;i++) _QR_EXP[i]=_QR_EXP[i-255]; // duplica p/ somar índices sem % 255
})();
function _qrMul(a,b){ return (a===0||b===0) ? 0 : _QR_EXP[_QR_LOG[a]+_QR_LOG[b]]; }

// Polinômio gerador de grau `degree`: ∏(x − α^i). Índice = potência de x (poly[0] = termo constante).
function _qrGenPoly(degree){
  let poly=[1];
  for(let d=0; d<degree; d++){
    const next=new Array(poly.length+1).fill(0);
    for(let i=0;i<poly.length;i++){
      next[i]   ^= _qrMul(poly[i], _QR_EXP[d]); // × α^d
      next[i+1] ^= poly[i];                     // × x
    }
    poly=next;
  }
  return poly;
}
// Codewords de correção de erro de um bloco de dados (resto da divisão polinomial).
function _qrEcc(data, ecLen){
  const gen=_qrGenPoly(ecLen);
  const res=new Uint8Array(data.length+ecLen);
  res.set(data,0);
  for(let i=0;i<data.length;i++){
    const factor=res[i];
    if(!factor) continue;
    for(let j=0;j<=ecLen;j++) res[i+j] ^= _qrMul(gen[ecLen-j], factor);
  }
  return res.slice(data.length);
}

/* Nível M (≈15% de recuperação) — equilíbrio certo pra tela: sobrevive a reflexo e a
   foto tremida sem inflar a densidade a ponto de a câmera não resolver os módulos.
   [ecPorBloco, blocosGrupo1, dadosGrupo1, blocosGrupo2, dadosGrupo2] por versão. */
const _QR_SPEC=[null,
  [10,1,16,0,0],[16,1,28,0,0],[26,1,44,0,0],[18,2,32,0,0],[24,2,43,0,0],
  [16,4,27,0,0],[18,4,31,0,0],[22,2,38,2,39],[22,3,36,2,37],[26,4,43,1,44]];
// Centros dos padrões de alinhamento por versão (norma; v1 não tem).
const _QR_ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];

// As 8 máscaras da norma. Aplicar máscara evita manchas sólidas e sequências que a
// câmera confundiria com os padrões de busca.
const _QR_MASKS=[
  (r,c)=>((r+c)%2)===0,
  (r,c)=>(r%2)===0,
  (r,c)=>(c%3)===0,
  (r,c)=>((r+c)%3)===0,
  (r,c)=>((Math.floor(r/2)+Math.floor(c/3))%2)===0,
  (r,c)=>(((r*c)%2)+((r*c)%3))===0,
  (r,c)=>((((r*c)%2)+((r*c)%3))%2)===0,
  (r,c)=>((((r+c)%2)+((r*c)%3))%2)===0
];

// 15 bits de informação de formato: nível (M = 0b00) + máscara, com BCH(15,5) e XOR fixo.
function _qrFormatBits(mask){
  const data=(0b00<<3)|mask;
  let v=data<<10;
  for(let i=14;i>=10;i--) if((v>>i)&1) v^=0x537<<(i-10);
  return ((data<<10)|v)^0x5412;
}
// 18 bits de versão (só v≥7), com BCH(18,6).
function _qrVersionBits(ver){
  let v=ver<<12;
  for(let i=17;i>=12;i--) if((v>>i)&1) v^=0x1F25<<(i-12);
  return (ver<<12)|v;
}

// Penalidade das 4 regras da norma — quanto menor, mais fácil de ler. Escolhemos a
// máscara vencedora em vez de fixar uma: máscara ruim gera QR que a câmera não pega.
function _qrPenalty(m,N){
  let p=0;
  // R1: 5+ módulos iguais seguidos (linha e coluna)
  for(let i=0;i<N;i++){
    for(const line of [ (j)=>m[i][j], (j)=>m[j][i] ]){
      let run=1;
      for(let j=1;j<N;j++){
        if(line(j)===line(j-1)) run++;
        else { if(run>=5) p+=3+(run-5); run=1; }
      }
      if(run>=5) p+=3+(run-5);
    }
  }
  // R2: blocos 2×2 da mesma cor
  for(let r=0;r<N-1;r++) for(let c=0;c<N-1;c++){
    const v=m[r][c];
    if(v===m[r][c+1] && v===m[r+1][c] && v===m[r+1][c+1]) p+=3;
  }
  // R3: padrão 1:1:3:1:1 com 4 claros de um lado (imita o padrão de busca)
  const P1=[1,0,1,1,1,0,1,0,0,0,0], P2=[0,0,0,0,1,0,1,1,1,0,1];
  for(let r=0;r<N;r++) for(let c=0;c<=N-11;c++){
    let a=true,b=true;
    for(let k=0;k<11;k++){ if(m[r][c+k]!==P1[k]) a=false; if(m[r][c+k]!==P2[k]) b=false; }
    if(a||b) p+=40;
  }
  for(let c=0;c<N;c++) for(let r=0;r<=N-11;r++){
    let a=true,b=true;
    for(let k=0;k<11;k++){ if(m[r+k][c]!==P1[k]) a=false; if(m[r+k][c]!==P2[k]) b=false; }
    if(a||b) p+=40;
  }
  // R4: desequilíbrio entre claro e escuro
  let dark=0;
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) dark+=m[r][c];
  p += Math.floor(Math.abs(dark*100/(N*N) - 50)/5)*10;
  return p;
}

// texto → matriz NxN de 0/1, ou null se não couber em v10.
function _qrMatrix(text){
  const bytes=Array.from(new TextEncoder().encode(String(text)));
  let ver=0, spec=null;
  for(let v=1;v<=10;v++){
    const s=_QR_SPEC[v], total=s[1]*s[2]+s[3]*s[4];
    if(4 + ((v<=9)?8:16) + bytes.length*8 <= total*8){ ver=v; spec=s; break; }
  }
  if(!ver) return null;

  // ── bitstream: modo byte + tamanho + dados + terminador + preenchimento
  const bits=[];
  const push=(val,len)=>{ for(let i=len-1;i>=0;i--) bits.push((val>>i)&1); };
  push(0b0100,4);
  push(bytes.length,(ver<=9)?8:16);
  bytes.forEach(b=>push(b,8));
  const totalData=spec[1]*spec[2]+spec[3]*spec[4], cap=totalData*8;
  push(0, Math.min(4, cap-bits.length));
  while(bits.length%8) bits.push(0);
  const data=[];
  for(let i=0;i<bits.length;i+=8){ let b=0; for(let j=0;j<8;j++) b=(b<<1)|bits[i+j]; data.push(b); }
  for(let i=0; data.length<totalData; i++) data.push(i%2 ? 0x11 : 0xEC); // padrão da norma

  // ── blocos + intercalação (o QR espalha os bytes p/ um borrão local não matar um bloco inteiro)
  const blocks=[], eccs=[]; let p=0;
  for(let i=0;i<spec[1];i++){ blocks.push(data.slice(p,p+spec[2])); p+=spec[2]; }
  for(let i=0;i<spec[3];i++){ blocks.push(data.slice(p,p+spec[4])); p+=spec[4]; }
  blocks.forEach(b=>eccs.push(_qrEcc(b, spec[0])));
  const seq=[];
  const maxD=Math.max(spec[2], spec[4]||0);
  for(let i=0;i<maxD;i++) blocks.forEach(b=>{ if(i<b.length) seq.push(b[i]); });
  for(let i=0;i<spec[0];i++) eccs.forEach(e=>seq.push(e[i]));

  // ── matriz: padrões fixos primeiro (e reservados), dados depois
  const N=17+ver*4;
  const m=[], rsv=[];
  for(let i=0;i<N;i++){ m.push(new Array(N).fill(0)); rsv.push(new Array(N).fill(0)); }
  const set=(r,c,v)=>{ if(r<0||c<0||r>=N||c>=N) return; m[r][c]=v?1:0; rsv[r][c]=1; };
  const finder=(r0,c0)=>{
    for(let r=-1;r<=7;r++) for(let c=-1;c<=7;c++){
      const ring=(r>=0&&r<=6&&(c===0||c===6))||(c>=0&&c<=6&&(r===0||r===6));
      const core=r>=2&&r<=4&&c>=2&&c<=4;
      set(r0+r, c0+c, ring||core);
    }
  };
  finder(0,0); finder(0,N-7); finder(N-7,0);
  for(let i=8;i<N-8;i++){ set(6,i,i%2===0); set(i,6,i%2===0); } // timing
  const al=_QR_ALIGN[ver];
  for(const r0 of al) for(const c0 of al){
    if((r0<=8&&c0<=8)||(r0<=8&&c0>=N-9)||(r0>=N-9&&c0<=8)) continue; // colidiria com um finder
    for(let r=-2;r<=2;r++) for(let c=-2;c<=2;c++) set(r0+r, c0+c, Math.max(Math.abs(r),Math.abs(c))!==1);
  }
  set(N-8,8,1); // módulo escuro fixo da norma
  for(let i=0;i<9;i++){ rsv[8][i]=1; rsv[i][8]=1; }               // área de formato
  for(let i=0;i<8;i++){ rsv[8][N-1-i]=1; rsv[N-1-i][8]=1; }
  if(ver>=7) for(let i=0;i<6;i++) for(let j=0;j<3;j++){ rsv[i][N-11+j]=1; rsv[N-11+j][i]=1; }

  // ── dados em zigue-zague, de baixo pra cima, duas colunas por vez
  let bi=0;
  const bitAt=k=>{ const byte=seq[k>>3]; return byte==null ? 0 : (byte>>(7-(k&7)))&1; };
  let up=true;
  for(let col=N-1; col>0; col-=2){
    if(col===6) col--; // a coluna 6 é timing: pula inteira
    for(let i=0;i<N;i++){
      const row = up ? (N-1-i) : i;
      for(let k=0;k<2;k++){
        const c=col-k;
        if(!rsv[row][c]) m[row][c]=bitAt(bi++);
      }
    }
    up=!up;
  }

  // ── máscara vencedora (menor penalidade), aplicada só fora dos padrões reservados
  let best=null, bestScore=Infinity;
  for(let k=0;k<8;k++){
    const t=m.map(row=>row.slice());
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(!rsv[r][c] && _QR_MASKS[k](r,c)) t[r][c]^=1;
    // Informação de formato, gravada DUAS vezes (a norma exige a redundância: se um canto
    // estiver danificado, o leitor ainda descobre nível e máscara pelo outro).
    // A norma grava os 15 bits do MAIS significativo pro menos: a posição i recebe o bit
    // 14-i. Lendo LSB-first o leitor decodifica nível/máscara errados e descarta o código
    // inteiro — o QR até "desenha", mas nenhuma câmera lê. Não inverter.
    const fb=_qrFormatBits(k), fbit=i=>(fb>>(14-i))&1;
    for(let i=0;i<15;i++){
      // cópia 1 — em L, em volta do finder superior-esquerdo
      if(i<6)        t[8][i]=fbit(i);
      else if(i===6) t[8][7]=fbit(6);
      else if(i===7) t[8][8]=fbit(7);
      else if(i===8) t[7][8]=fbit(8);
      else           t[14-i][8]=fbit(i);
      // cópia 2 — dividida entre o canto inferior-esquerdo e o superior-direito
      if(i<7) t[N-1-i][8]=fbit(i);
      else    t[8][N-15+i]=fbit(i);
    }
    t[N-8][8]=1; // módulo escuro fixo (fica dentro da faixa da cópia 2; reafirma depois dela)
    if(ver>=7){
      const vb=_qrVersionBits(ver);
      for(let i=0;i<18;i++){
        const b=(vb>>i)&1, r=Math.floor(i/3), c=i%3;
        t[r][N-11+c]=b; t[N-11+c][r]=b;
      }
    }
    const s=_qrPenalty(t,N);
    if(s<bestScore){ bestScore=s; best=t; }
  }
  return best;
}

/**
 * gQRCanvas(texto, px, quiet) → <canvas> com o QR, ou null se o texto não couber.
 * px = lado de cada módulo; quiet = margem em módulos (a norma pede 4 — sem ela a
 * câmera não acha as bordas). Preto e branco puros não são cor de marca: são
 * requisito de contraste do formato, por isso não usam token.
 */
function gQRCanvas(text, px, quiet){
  try{
    const m=_qrMatrix(text);
    if(!m) return null;
    const N=m.length, S=Math.max(1, px||4), Q=(quiet==null?4:quiet);
    const side=(N+Q*2)*S;
    const cv=document.createElement('canvas');
    cv.width=side; cv.height=side;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,side,side);
    ctx.fillStyle='#000';
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(m[r][c]) ctx.fillRect((c+Q)*S,(r+Q)*S,S,S);
    return cv;
  }catch(e){ console.warn('[qr] falhou:', e); return null; }
}
