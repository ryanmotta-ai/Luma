/* Decodificador PNG mínimo (zero dependência, só `zlib`): 8 bits, RGB/RGBA/cinza, sem entrelaçamento.
   Basta para medir os renders do harness e as referências em PNG. JPEG não: converta antes. */
const zlib=require('zlib'), fs=require('fs');
function decode(buf){
  if(typeof buf==='string') buf=fs.readFileSync(buf);
  if(buf.readUInt32BE(0)!==0x89504e47) throw new Error('não é PNG');
  let p=8,w,h,ct,bd,idat=[],plte=null,trns=null;
  while(p<buf.length){
    const len=buf.readUInt32BE(p), t=buf.toString('ascii',p+4,p+8), d=buf.slice(p+8,p+8+len); p+=12+len;
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];if(d[12]) throw new Error('PNG entrelaçado não suportado');}
    else if(t==='PLTE') plte=d; else if(t==='tRNS') trns=d; else if(t==='IDAT') idat.push(d); else if(t==='IEND') break;
  }
  if(bd!==8) throw new Error('só PNG de 8 bits');
  const ch={0:1,2:3,3:1,4:2,6:4}[ct]; const raw=zlib.inflateSync(Buffer.concat(idat)); const bpp=ch, stride=w*ch;
  const out=Buffer.alloc(h*stride); let prev=Buffer.alloc(stride);
  for(let y=0;y<h;y++){
    const f=raw[y*(stride+1)], line=raw.slice(y*(stride+1)+1,(y+1)*(stride+1)), cur=out.slice(y*stride,(y+1)*stride);
    for(let i=0;i<stride;i++){
      const a=i>=bpp?cur[i-bpp]:0, b=prev[i], c=i>=bpp?prev[i-bpp]:0; let v=line[i];
      if(f===1) v+=a; else if(f===2) v+=b; else if(f===3) v+=(a+b)>>1;
      else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c); v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
      cur[i]=v&255;
    }
    prev=cur;
  }
  const rgba=Buffer.alloc(w*h*4);
  for(let i=0;i<w*h;i++){
    let r,g,b,a=255;
    if(ct===6){r=out[i*4];g=out[i*4+1];b=out[i*4+2];a=out[i*4+3];}
    else if(ct===2){r=out[i*3];g=out[i*3+1];b=out[i*3+2];}
    else if(ct===0){r=g=b=out[i];}
    else if(ct===4){r=g=b=out[i*2];a=out[i*2+1];}
    else {const k=out[i];r=plte[k*3];g=plte[k*3+1];b=plte[k*3+2];if(trns&&k<trns.length)a=trns[k];}
    rgba[i*4]=r;rgba[i*4+1]=g;rgba[i*4+2]=b;rgba[i*4+3]=a;
  }
  return {w,h,data:rgba,px(x,y){const o=(y*w+x)*4;return [rgba[o],rgba[o+1],rgba[o+2],rgba[o+3]];}};
}
module.exports={decode};
