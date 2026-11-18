// 北京化工大学门票动画：自动播放 + 可拖动滑轨
// 所有静态资源都从项目内 ./assets 引入，没有任何外链
import META from '../assets/layers/meta.json';
import logoSvg from '../assets/logo/BUCT-horizontal-blue.svg?raw';
const LAYER_URL=import.meta.glob('../assets/layers/*.png',{eager:true,query:'?url',import:'default'});

const T=6.0, FPS=30;
const IMG_X=562, IMG_Y=748-META.H;
const $=id=>document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const seg=(t,a,b)=>clamp((t-a)/(b-a));
const outCubic=t=>1-Math.pow(1-t,3);
const inOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const outBack=(t,c1=1.70158)=>{const c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)};
const f=n=>n.toFixed(2);
function rng(seed){let s=seed;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296}}

/* ---------- static build ---------- */
let LAY;
(function build(){
  // 官方校标 SVG：前 11 个 path 是中英文校名，随后 115 个是校徽
  const logoPaths=logoSvg.match(/<path[^>]*\/>/g);
  $('wordSrc').innerHTML=logoPaths.slice(0,11).join('');
  $('emblemSrc').innerHTML=logoPaths.slice(11,126).join('');
  // sky colours
  const fix=c=>'rgb('+c.map(Math.round).join(',')+')';
  document.querySelectorAll('#skyG stop')[0].setAttribute('stop-color',fix(META.bgTop));
  document.querySelectorAll('#skyG stop')[1].setAttribute('stop-color',fix(META.bgBottom));
  // background deco
  let s='';
  const cs=[[92,92,1,1],[1828,92,-1,1],[92,988,1,-1],[1828,988,-1,-1]];
  for(const [x,y,sx,sy] of cs) s+=`<path d="M${x},${y+46*sy} V${y} H${x+46*sx}"/><path d="M${x+60*sx},${y+14*sy} H${x+150*sx}" stroke-opacity=".16"/>`;
  s+=`<path d="M960,82 l9,9 l-9,9 l-9,-9 Z"/><circle cx="938" cy="91" r="1.6" fill="#6f8fc4" stroke="none" fill-opacity=".5"/><circle cx="982" cy="91" r="1.6" fill="#6f8fc4" stroke="none" fill-opacity=".5"/>`;
  const r0=rng(7);
  for(let i=0;i<70;i++){const x=r0()*1920,y=r0()*1080,r=.6+r0()*1.2; s+=`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#9bb8ea" stroke="none" fill-opacity="${f(.08+r0()*.22)}"/>`;}
  $('bgdeco').innerHTML=s;

  // mask holes + rims
  const leftN=[275,394,512,630,749], eye=[262,365,468,571,674,802];
  let mh='', rims='';
  for(const y of leftN){ mh+=`<circle cx="157" cy="${y}" r="13"/>`; rims+=`<circle cx="157" cy="${y}" r="17" fill="none" stroke="url(#gold)" stroke-width="8"/><circle cx="157" cy="${y}" r="21" fill="none" stroke="#6d4f16" stroke-opacity=".6" stroke-width="1"/>`; }
  for(const y of [157,867]){ mh+=`<circle cx="512.5" cy="${y}" r="15"/>`; rims+=`<circle cx="512.5" cy="${y}" r="19" fill="none" stroke="url(#gold)" stroke-width="8"/>`; }
  for(const y of eye){ mh+=`<circle cx="512.5" cy="${y}" r="6.5"/>`; rims+=`<circle cx="512.5" cy="${y}" r="16" fill="url(#gold)" stroke="#6d4f16" stroke-width="1.2"/><circle cx="512.5" cy="${y}" r="11" fill="none" stroke="#fff6d2" stroke-opacity=".7" stroke-width="1.2"/><circle cx="512.5" cy="${y}" r="7.2" fill="none" stroke="#5c4212" stroke-width="1.6"/>`; }
  $('maskHoles').innerHTML=mh; $('rims').innerHTML=rims;

  // stub
  const cx=335, ey=452;
  let st=`<rect x="165" y="165" width="340" height="694" rx="14" fill="url(#stubG)"/>
  <rect x="165" y="165" width="340" height="694" rx="14" fill="url(#stubGlow)"/>
  <g id="stubPattern" stroke="#7fb4ff" stroke-opacity=".10" fill="none" stroke-width="1">`;
  // subtle hexagon (benzene) lattice on stub
  const hx=26, hh=hx*Math.sqrt(3)/2;
  for(let row=0;row<18;row++)for(let col=0;col<6;col++){
    const x=180+col*hx*3+(row%2?hx*1.5:0), y=170+row*hh; let p='';
    for(let k=0;k<6;k++){const a=Math.PI/3*k; p+=(k?'L':'M')+f(x+hx*Math.cos(a))+','+f(y+hx*Math.sin(a));}
    st+=`<path d="${p}Z"/>`;
  }
  st+=`</g>
  <rect x="165.75" y="165.75" width="338.5" height="692.5" rx="13.5" fill="none" stroke="#7b5c1c" stroke-opacity=".8" stroke-width="1.5"/>
  <rect x="178" y="178" width="314" height="668" rx="8" fill="none" stroke="url(#goldT)" stroke-width="1.8"/>
  <rect x="184" y="184" width="302" height="656" rx="5" fill="none" stroke="url(#goldT)" stroke-opacity=".45" stroke-width="1"/>
  <g id="stubTop" fill="url(#goldT)" text-anchor="middle">
    <text x="${cx}" y="226" font-size="15.5" font-weight="700" letter-spacing="3.2">BEIJING UNIVERSITY OF</text>
    <text x="${cx}" y="250" font-size="15.5" font-weight="700" letter-spacing="3.2">CHEMICAL TECHNOLOGY</text>
    <text x="${cx+5}" y="288" font-size="28" font-weight="700" letter-spacing="10">1958</text>
    <path d="M215,306 H${cx-12} M${cx+12},306 H455" stroke="url(#goldT)" stroke-width="1.5"/>
    <path d="M${cx},299 l7,7 l-7,7 l-7,-7Z"/>
  </g>
  <g id="medal">
    <circle cx="${cx}" cy="${ey}" r="118" fill="url(#medG)" stroke="url(#goldT)" stroke-width="3"/>
    <circle cx="${cx}" cy="${ey}" r="111" fill="none" stroke="url(#goldT)" stroke-opacity=".6" stroke-width="1"/>
    <g id="emblem" transform="translate(${cx},${ey+1}) scale(2.62) translate(-39.55,-39.6)" fill="url(#goldE)"><use href="#emblemSrc"/></g>
  </g>
  <g id="frets" fill="none" stroke="url(#goldT)" stroke-width="2">`;
  const fr=128;
  for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    const x=cx+sx*fr, y=ey+sy*fr;
    st+=`<path d="M${x},${y-sy*40} V${y} H${x-sx*40}"/><path d="M${x-sx*9},${y-sy*26} V${y-sy*9} H${x-sx*26} V${y-sy*20} H${x-sx*16} V${y-sy*14}" stroke-width="1.5"/>`;
  }
  st+=`</g>
  <g id="stubBottom" fill="url(#goldT)" text-anchor="middle">
    <path d="M215,606 H${cx-12} M${cx+12},606 H455" stroke="url(#goldT)" stroke-width="1.5"/>
    <path d="M${cx},599 l7,7 l-7,7 l-7,-7Z"/>
    <text x="${cx+6}" y="646" font-size="22" font-weight="700" letter-spacing="12">始发站</text>
    <path d="M225,638 h46 M399,638 h46" stroke="url(#goldT)" stroke-width="1.2"/>
    <g transform="translate(${cx},696) scale(1.3) translate(-184.4,-31.95)" fill="url(#goldW)"><use href="#wordSrc"/></g>
    <g id="barcode">`;
  const r1=rng(1958); let bx=214;
  while(bx<454){const w=1+Math.floor(r1()*3)*1.2, g=1.6+r1()*2.6; st+=`<rect x="${f(bx)}" y="750" width="${f(Math.min(w,456-bx))}" height="${48+ (r1()>.85?8:0)}"/>`; bx+=w+g;}
  st+=`</g>
    <text x="${cx+3}" y="829" font-size="12.5" font-weight="700" letter-spacing="6">BUCT · EST. 1958</text>
  </g>`;
  $('stub').innerHTML=st;

  // deco behind scene
  let d=`<g fill="none" stroke="#8fc3ea" stroke-width="1.2" stroke-opacity=".5">`;
  const dc=[1140,470];
  for(const r of [110,190,280,380,490,610]) d+=`<circle cx="${dc[0]}" cy="${dc[1]}" r="${r}"/>`;
  for(let k=0;k<24;k++){const a=k*Math.PI/12; d+=`<path d="M${f(dc[0]+110*Math.cos(a))},${f(dc[1]+110*Math.sin(a))} L${f(dc[0]+760*Math.cos(a))},${f(dc[1]+760*Math.sin(a))}" stroke-opacity=".28"/>`;}
  d+=`</g><g id="hexes" fill="none" stroke="#5aa5e0" stroke-width="2" stroke-opacity=".55">`;
  const hexes=[[1602,238,34,0],[1661,272,34,0],[1238,226,22,.5],[1702,420,20,.3]];
  for(const [x,y,r,rot] of hexes){let p='',q='';
    for(let k=0;k<6;k++){const a=Math.PI/3*k+Math.PI/6+rot; p+=(k?'L':'M')+f(x+r*Math.cos(a))+','+f(y+r*Math.sin(a));}
    d+=`<path d="${p}Z"/><circle cx="${x}" cy="${y}" r="${f(r*.55)}" stroke-opacity=".4"/>`;}
  d+=`<path d="M1690.4,255 L1722,236" /><circle cx="1728" cy="232" r="6" fill="#5aa5e0" fill-opacity=".5"/><path d="M1572.6,221 L1548,206"/><circle cx="1542" cy="202" r="6" fill="#ffb3c0" stroke="#e98aa0"/></g>`;
  $('deco').innerHTML=d;

  // sparkles
  const sp=[[1330,222,15],[1470,262,9],[1708,330,13],[1262,300,7],[1525,196,6],[1130,214,10],[1420,205,6],[1735,520,9],[548,410,8],[1205,190,5],[1655,196,7],[540,220,7],[1730,640,6],[545,600,6]];
  $('sparkles').innerHTML=sp.map(([x,y,r],i)=>`<g class="sp" data-x="${x}" data-y="${y}" data-r="${r}" data-i="${i}"><use href="#star4" fill="#e9b949"/><circle r=".16" fill="#fff"/></g>`).join('');

  // rail
  let rl=`<rect x="520" y="744" width="1235" height="116" fill="url(#railG)"/>
  <rect x="520" y="743" width="1235" height="3.5" fill="url(#gold)"/><rect x="520" y="746.5" width="1235" height="5" fill="#8a6a2a" fill-opacity=".18"/>
  <rect x="598" y="778" width="1094" height="48" rx="24" fill="#b48a34"/>
  <rect x="601" y="781" width="1088" height="42" rx="21" fill="url(#slotG)"/>
  <g clip-path="url(#slotClip)"><rect id="prog" x="600" y="781" width="0" height="42" fill="url(#progG)"/><rect id="progHi" x="600" y="786" width="0" height="5" rx="2.5" fill="#fff" fill-opacity=".28"/>
  <g id="ticks" stroke="#fff" stroke-opacity=".10" stroke-width="2">`;
  for(let x=640;x<1690;x+=52) rl+=`<path d="M${x},796 v12"/>`;
  rl+=`</g></g>
  <rect x="601" y="781" width="1088" height="42" rx="21" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
  $('rail').innerHTML=rl;

  // scene layers (back -> front)
  const order=['pinkcircle','sun','beam','cat','cloudL','cloudR','bluebldg','mountain','skybridge','redbldg','pinkbldg','pond','library','cherry','bridge','bush','plants','statue','bubbles','flask','dove'];
  const byName=LAY=Object.fromEntries(META.layers.map(l=>[l.name,l]));
  let sc='';
  for(const n of order){const l=byName[n]; if(!l) continue;
    const img=`<image href="${LAYER_URL[`../assets/layers/${n}.png`]}" x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}"/>`;
    sc+=`<g id="L_${n}" opacity="0">${n==='pond'?`<g mask="url(#pondMask)">${img}</g>`:img}</g>`;
  }
  $('scene').setAttribute('transform',`translate(${IMG_X},${IMG_Y})`);
  $('scene').innerHTML=sc;
})();

/* ---------- rider ---------- */
const X0=676, X1=1606, T0=0.95, T1=4.75, GROUND=849, RS=1.12, WR=40;
function riderProg(t){const p=seg(t,T0,T1),a=.16,v=1/(1-a);
  if(p<a) return v*p*p/(2*a); if(p<1-a) return v*(p-a/2); return 1-v*(1-p)*(1-p)/(2*a);}
const riderX=t=>lerp(X0,X1,riderProg(t));
function ik(A,B,l1,l2,sign){
  let dx=B[0]-A[0],dy=B[1]-A[1],d=Math.hypot(dx,dy); d=Math.min(d,l1+l2-.01);
  const base=Math.atan2(dy,dx), ca=clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1), an=base+sign*Math.acos(ca);
  return [A[0]+l1*Math.cos(an),A[1]+l1*Math.sin(an)];
}
function wheel(c,ang){
  let s=`<g transform="translate(${c[0]},${c[1]}) rotate(${f(ang)})"><circle r="${WR}" fill="#fff8e6"/><circle r="${WR-2.5}" fill="none" stroke="#12244a" stroke-width="5"/><circle r="${WR-7.5}" fill="none" stroke="#d2a84a" stroke-width="1.6"/>`;
  for(let k=0;k<10;k++){const a=k*Math.PI/5; s+=`<path d="M0,0 L${f((WR-8)*Math.cos(a))},${f((WR-8)*Math.sin(a))}" stroke="#8e9bb8" stroke-width="1.1"/>`;}
  return s+`<circle r="5" fill="#d2a84a" stroke="#12244a" stroke-width="1.5"/></g>`;
}
function drawRider(t){
  const x=riderX(t), dist=x-X0, wAng=dist/(WR*RS)*180/Math.PI;
  const dt=1/240, speed=(riderX(t+dt)-riderX(t-dt))/(2*dt)/260;      // ~0..1.2
  const cr=dist/(WR*RS)*0.62+0.9;                                     // crank angle (rad)
  const sway=Math.sin(t*9), sway2=Math.sin(t*9+1.3), sp=clamp(speed);
  const bob=Math.sin(cr*2)*1.1*sp;
  const R=[-56,-WR], F=[56,-WR], BB=[-6,-37], ST=[-25,-97], HT=[36,-103], HB=[41,-82], GR=[27,-121];
  const CL=15, P1=[BB[0]+CL*Math.cos(cr),BB[1]+CL*Math.sin(cr)], P2=[BB[0]-CL*Math.cos(cr),BB[1]-CL*Math.sin(cr)];
  const HIP=[-25,-107+bob], SH=[1,-153+bob], HD=[10,-177+bob];
  const foot=p=>[p[0]+1,p[1]-4];
  const K1=ik(HIP,foot(P1),45,46,-1), K2=ik(HIP,foot(P2),45,46,-1);
  const EL=ik(SH,GR,25,25,1);
  const L=(a,b)=>`M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}`;
  const tube=(a,b,w=5.2)=>`<path d="${L(a,b)}" stroke="#0a2a66" stroke-width="${w+3}" stroke-linecap="round"/>`;
  const tubeC=(a,b,w=5.2)=>`<path d="${L(a,b)}" stroke="#1b6fe0" stroke-width="${w}" stroke-linecap="round"/>`;
  const frame=[[R,BB],[R,[-23,-90]],[BB,ST],[[-23,-90],[37,-97]],[BB,HB],[HT,HB],[HB,F,4.4]];
  const leg=(K,P,far)=>{const fo=foot(P), c=far?'#172a52':'#26427e', c2=far?'#e9e1cf':'#ffffff';
    return `<path d="M${f(HIP[0])},${f(HIP[1])} L${f(K[0])},${f(K[1])}" stroke="${c}" stroke-width="15" stroke-linecap="round" fill="none"/>
    <path d="M${f(K[0])},${f(K[1])} L${f(fo[0])},${f(fo[1])}" stroke="${c}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <path d="M${f(fo[0]-7)},${f(fo[1]+1)} q2,-8 9,-7 l9,3 q4,2 3,6 l-1,2 h-19 z" fill="${c2}" stroke="#12244a" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M${f(P[0]-8)},${f(P[1]+4.2)} h16" stroke="#12244a" stroke-width="3.4" stroke-linecap="round"/>`;};
  const hw=sway*3*(.35+sp), hw2=sway2*4*(.35+sp), fl=6+10*sp;
  let s='';
  // far side: far crank + far leg
  s+=`<path d="${L(BB,P2)}" stroke="#12244a" stroke-width="4" stroke-linecap="round"/>`+leg(K2,P2,true);
  // wheels
  s+=wheel(R,wAng)+wheel(F,wAng);
  // fenders
  s+=`<path d="M${R[0]-WR-3},${R[1]-8} A${WR+4},${WR+4} 0 0 1 ${R[0]+30},${R[1]-WR+8}" fill="none" stroke="#0a2a66" stroke-width="3.5" stroke-linecap="round"/>`;
  // frame
  for(const [a,b,w] of frame) s+=tube(a,b,w||5.2);
  for(const [a,b,w] of frame) s+=tubeC(a,b,w||5.2);
  // saddle, stem, handlebar
  s+=`<path d="M-39,-101 q13,-7 27,-1 q2,4 -3,5 h-20 q-5,-1 -4,-4z" fill="#3a2a22" stroke="#12244a" stroke-width="1.5"/>`;
  s+=`<path d="M36,-103 L33,-121 L24,-123" fill="none" stroke="#12244a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  // basket with a little flask
  s+=`<g transform="translate(42,-131)"><g transform="rotate(${f(-6+sway*2*sp)},18,6)"><path d="M14,-6 h8 v-9 h-8z M11,-6 h14 l7,16 h-28z" fill="#fff" fill-opacity=".9" stroke="#12244a" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5,0 h19 l4.2,9.5 h-27.4z" fill="#ff7f9f"/></g>
    <path d="M0,2 h37 l-4,26 h-29z" fill="#f6e3b4" stroke="#8a6424" stroke-width="2" stroke-linejoin="round"/>
    <path d="M1,10 h35 M2.5,18 h32 M9,2 l2,26 M18.5,2 v26 M28,2 l-2,26" stroke="#b18a45" stroke-width="1.3" fill="none"/></g>`;
  // chainring + near crank
  s+=`<circle cx="${BB[0]}" cy="${BB[1]}" r="9" fill="#e0b85a" stroke="#12244a" stroke-width="2"/><circle cx="${BB[0]}" cy="${BB[1]}" r="3" fill="#12244a"/>`;
  // scarf (behind body)
  s+=`<path d="M-2,-158 C${f(-14)},${f(-166+hw)} ${f(-30)},${f(-150+hw2)} ${f(-44-fl)},${f(-160+hw)} C${f(-36-fl*.6)},${f(-152+hw2)} ${f(-40-fl*.7)},${f(-146+hw)} ${f(-50-fl)},${f(-142+hw2)} C${f(-30)},${f(-138+hw)} -12,-146 0,-150Z" fill="#ffc93c" stroke="#b07a12" stroke-width="1.5" stroke-linejoin="round"/>`;
  // torso
  s+=`<g transform="translate(0,${f(bob)})"><path d="M-37,-106 C-40,-132 -28,-154 -8,-164 L10,-158 C16,-146 6,-124 -9,-102 Z" fill="#1b6fe0" stroke="#0a2a66" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-37,-108 C-29,-103 -18,-101 -9,-103 L-9,-98 C-18,-96 -30,-98 -37,-102Z" fill="#fff" stroke="#0a2a66" stroke-width="1.5"/>
    <path d="M-27,-140 l12,4 M-29,-131 l12,4" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/></g>`;
  // near leg + crank
  s+=`<path d="${L(BB,P1)}" stroke="#12244a" stroke-width="4" stroke-linecap="round"/>`+leg(K1,P1,false);
  // arm
  s+=`<path d="M${f(SH[0])},${f(SH[1])} L${f(EL[0])},${f(EL[1])}" stroke="#0a2a66" stroke-width="13" stroke-linecap="round"/><path d="M${f(SH[0])},${f(SH[1])} L${f(EL[0])},${f(EL[1])}" stroke="#2f80ee" stroke-width="10" stroke-linecap="round"/>
      <path d="M${f(EL[0])},${f(EL[1])} L${f(GR[0])},${f(GR[1])}" stroke="#7a4a36" stroke-width="9.5" stroke-linecap="round"/><path d="M${f(EL[0])},${f(EL[1])} L${f(GR[0])},${f(GR[1])}" stroke="#f8d6bd" stroke-width="7" stroke-linecap="round"/>
      <circle cx="${GR[0]}" cy="${GR[1]}" r="5" fill="#f8d6bd" stroke="#7a4a36" stroke-width="1.3"/>`;
  // head
  const hx=HD[0], hy=HD[1];
  s+=`<path d="M${f(hx-4)},${f(hy+10)} l-3,10 l10,3 l1,-9z" fill="#f8d6bd" stroke="#7a4a36" stroke-width="1.2"/>`;
  // hair back + streaming
  s+=`<path d="M${f(hx+3)},${f(hy-15)} C${f(hx-16)},${f(hy-18)} ${f(hx-20)},${f(hy-2)} ${f(hx-15)},${f(hy+8)} C${f(hx-24)},${f(hy+6+hw)} ${f(hx-34-fl)},${f(hy+12+hw2)} ${f(hx-44-fl*1.5)},${f(hy+4+hw)} C${f(hx-36-fl)},${f(hy+2+hw2)} ${f(hx-30-fl*.6)},${f(hy-6+hw)} ${f(hx-24)},${f(hy-10)} C${f(hx-18)},${f(hy-16)} ${f(hx-6)},${f(hy-14)} ${f(hx+3)},${f(hy-15)}Z" fill="#3b2a24" stroke="#1f1512" stroke-width="1.2" stroke-linejoin="round"/>`;
  s+=`<circle cx="${f(hx)}" cy="${f(hy)}" r="15" fill="#f8d6bd" stroke="#7a4a36" stroke-width="1.4"/>`;
  s+=`<path d="M${f(hx-15)},${f(hy-2)} C${f(hx-14)},${f(hy-14)} ${f(hx-2)},${f(hy-18)} ${f(hx+10)},${f(hy-12)} C${f(hx+2)},${f(hy-10)} ${f(hx-4)},${f(hy-4)} ${f(hx-6)},${f(hy+6)} C${f(hx-10)},${f(hy+6)} ${f(hx-14)},${f(hy+3)} ${f(hx-15)},${f(hy-2)}Z" fill="#3b2a24"/>`;
  s+=`<ellipse cx="${f(hx+7.5)}" cy="${f(hy-.5)}" rx="1.7" ry="2.6" fill="#2a1c18"/><circle cx="${f(hx+5)}" cy="${f(hy+6)}" r="3.2" fill="#ff9aa8" fill-opacity=".65"/><path d="M${f(hx+8)},${f(hy+7)} q3,2.6 5.5,.2" fill="none" stroke="#7a3a2e" stroke-width="1.3" stroke-linecap="round"/>`;
  // hat
  s+=`<g transform="rotate(-9,${f(hx)},${f(hy-12)})"><path d="M${f(hx-13)},${f(hy-12)} C${f(hx-12)},${f(hy-27)} ${f(hx+12)},${f(hy-27)} ${f(hx+13)},${f(hy-12)}Z" fill="#fff3d0" stroke="#8a6424" stroke-width="1.5"/>
     <path d="M${f(hx-13)},${f(hy-15.5)} C${f(hx-4)},${f(hy-18.5)} ${f(hx+4)},${f(hy-18.5)} ${f(hx+13)},${f(hy-15.5)} L${f(hx+13)},${f(hy-11.5)} H${f(hx-13)}Z" fill="#00459b"/>
     <ellipse cx="${f(hx)}" cy="${f(hy-11)}" rx="24" ry="4.6" fill="#fff3d0" stroke="#8a6424" stroke-width="1.5"/></g>`;
  $('rider').setAttribute('transform',`translate(${f(x)},${GROUND}) scale(${RS})`);
  $('rider').innerHTML=s;
  $('riderShadow').innerHTML=`<ellipse cx="${f(x)}" cy="${GROUND+2}" rx="${84}" ry="5" fill="#3a2a10" fill-opacity=".22" filter="url(#soft)"/>`;
  // speed lines
  let tr='';
  if(sp>.05){const o=sp*.75; const ys=[-150,-112,-74,-36];
    ys.forEach((yy,i)=>{const len=(38+((i*37)%30))*sp, ph=((t*3+i*.37)%1), xx=x-98-ph*46;
      tr+=`<path d="M${f(xx)},${GROUND+yy*RS} h${f(-len)}" stroke="${i%2?'#e9c268':'#ffffff'}" stroke-opacity="${f(o*(1-ph))}" stroke-width="3" stroke-linecap="round"/>`;});}
  $('trail').innerHTML=tr;
  return x;
}

/* ---------- scene timeline ---------- */
function timeAtX(x){ if(x<=X0) return T0; if(x>=X1) return T1; let lo=T0,hi=T1; for(let i=0;i<30;i++){const m=(lo+hi)/2; if(riderX(m)<x) lo=m; else hi=m;} return lo; }
const CFG={ // lead: px ahead of the rider at which the element appears
  pinkcircle:{at:.55,kind:'bloom',dur:.75}, sun:{at:.72,kind:'bloom',dur:.75}, cloudL:{at:.98,kind:'slide',dx:-46,dur:.7},
  redbldg:{lead:160,kind:'rise'}, plants:{lead:70,kind:'grow'}, cat:{lead:10,kind:'peek',dur:.6},
  beam:{lead:330,kind:'slide',dx:-40,dur:.6}, skybridge:{lead:190,kind:'rise'}, pinkbldg:{lead:180,kind:'rise'},
  bubbles:{lead:150,kind:'bubble'}, flask:{lead:140,kind:'drop'}, statue:{lead:110,kind:'rise',dur:.7},
  mountain:{lead:300,kind:'rise',dy:22,dur:.6}, cloudR:{lead:240,kind:'slide',dx:46,dur:.7}, bluebldg:{lead:205,kind:'rise'},
  dove:{lead:120,kind:'fly',dur:.9}, library:{lead:180,kind:'rise'}, bridge:{lead:95,kind:'rise',dy:26}, cherry:{lead:120,kind:'grow'}, bush:{lead:60,kind:'grow'},
  pond:{at:1.0,kind:'pond'}
};
for(const n in CFG){const c=CFG[n], l=LAY[n]; if(!l) continue; if(c.at===undefined) c.at=timeAtX(IMG_X+l.cx-c.lead); c.dur=c.dur||.55;}
function drawScene(t,rx){
  for(const n in CFG){const c=CFG[n], l=LAY[n], el=$('L_'+n); if(!l||!el) continue;
    const p=seg(t,c.at,c.at+c.dur), cx=l.x+l.w/2, cy=l.y+l.h/2, by=l.y+l.h;
    let op=clamp(p*2.2), tf='';
    const idle=t-(c.at+c.dur);
    if(c.kind==='rise'){const e=outBack(p,1.1), dy=(c.dy||38)*(1-e), sc=lerp(.9,1,outCubic(p)); tf=`translate(${f(cx)},${f(by+dy)}) scale(${f(sc)}) translate(${f(-cx)},${f(-by)})`;}
    else if(c.kind==='grow'){const e=outBack(p,2.0), sc=lerp(.45,1,e); tf=`translate(${f(cx)},${f(by)}) scale(${f(sc)}) translate(${f(-cx)},${f(-by)})`;}
    else if(c.kind==='bloom'){const e=outBack(p,1.3), sc=lerp(.55,1,e); tf=`translate(${f(cx)},${f(cy)}) scale(${f(sc)}) translate(${f(-cx)},${f(-cy)})`; op=clamp(p*1.8);}
    else if(c.kind==='slide'){const e=outCubic(p); tf=`translate(${f(c.dx*(1-e))},0)`; op=clamp(p*1.6);}
    else if(c.kind==='peek'){const e=outBack(p,2.2); let dy=72*(1-e); if(idle>0) dy+=1.4-1.4*Math.cos(idle*4.2); tf=`translate(0,${f(dy)})`; op=p>0?1:0;}
    else if(c.kind==='drop'){const e=outBack(p,1.8); let dy=-70*(1-e), rot=-70*(1-e); if(idle>0){dy+=Math.sin(idle*2.6)*3.5; rot+=Math.sin(idle*2.1)*5;} tf=`translate(0,${f(dy)}) rotate(${f(rot)},${f(cx)},${f(cy)})`;}
    else if(c.kind==='bubble'){const e=outBack(p,2.6); let sc=lerp(0,1,e), dy=0; if(idle>0) dy=Math.sin(idle*2.4)*3; tf=`translate(${f(cx)},${f(cy+dy)}) scale(${f(Math.max(sc,0.001))}) translate(${f(-cx)},${f(-cy)})`; op=p>0?1:0;}
    else if(c.kind==='fly'){const e=outCubic(p); let dx=190*(1-e), dy=-95*(1-e)*(1-e)+Math.sin(p*Math.PI*3)*7*(1-p); let rot=-14*(1-e); if(idle>0){dy+=Math.sin(idle*3.2)*3; dx+=Math.sin(idle*1.6)*1.5;} tf=`translate(${f(dx)},${f(dy)}) rotate(${f(rot)},${f(cx)},${f(cy)})`; op=clamp(p*3);}
    else if(c.kind==='pond'){const edge=(rx-IMG_X)+lerp(40,260,seg(t,c.at,T1))+ (t>=T1? (t-T1)*900:0); const g=$('pondGrad'); g.setAttribute('x1',f(edge-150)); g.setAttribute('x2',f(edge)); op=t>=c.at?1:0;}
    el.setAttribute('opacity',f(op)); if(tf) el.setAttribute('transform',tf); else el.removeAttribute('transform');
  }
}

function renderAt(t){
  // intro of the ticket
  const ti=outCubic(seg(t,0,.55));
  $('ticketWrap').setAttribute('opacity',f(seg(t,0,.4)));
  $('ticketWrap').setAttribute('transform',`translate(960,${f(512+26*(1-ti))}) scale(${f(lerp(.94,1,ti))}) translate(-960,-512)`);
  // stub: emblem stamps in, texts fade
  const me=seg(t,.3,.85), ms=lerp(1.28,1,outBack(me,1.4));
  $('medal').setAttribute('opacity',f(clamp(me*2))); $('medal').setAttribute('transform',`translate(335,452) scale(${f(ms)}) translate(-335,-452)`);
  $('frets').setAttribute('opacity',f(seg(t,.55,1.0)));
  $('stubTop').setAttribute('opacity',f(seg(t,.35,.8))); $('stubTop').setAttribute('transform',`translate(0,${f(-10*(1-outCubic(seg(t,.35,.8))))})`);
  $('stubBottom').setAttribute('opacity',f(seg(t,.5,.95))); $('stubBottom').setAttribute('transform',`translate(0,${f(10*(1-outCubic(seg(t,.5,.95))))})`);
  // deco + sparkles
  $('deco').setAttribute('opacity',f(seg(t,.45,1.3)*.9));
  document.querySelectorAll('.sp').forEach(g=>{const i=+g.dataset.i, x=+g.dataset.x, y=+g.dataset.y, r=+g.dataset.r;
    const a=seg(t,.6+i*.16,1.0+i*.16), tw=.72+.28*Math.sin(t*3.1+i*1.7), sc=r*outBack(a,2)*tw;
    g.setAttribute('transform',`translate(${x},${y}) rotate(${f(Math.sin(t*1.3+i)*8)}) scale(${f(Math.max(sc,.001))})`); g.setAttribute('opacity',f(a*(.55+.45*tw)));});
  // rider & progress
  const rx=drawRider(t);
  $('prog').setAttribute('width',f(Math.max(0,rx-600))); $('progHi').setAttribute('width',f(Math.max(0,rx-612)));
  drawScene(t,rx);
  // shines
  const s1=seg(t,.45,1.15), s2=seg(t,5.0,5.9);
  let sx=-400, so=0;
  if(s1>0&&s1<1){sx=lerp(60,620,s1); so=Math.sin(s1*Math.PI)*.8;}
  if(s2>0&&s2<1){sx=lerp(0,2000,inOutCubic(s2)); so=Math.sin(s2*Math.PI)*.75;}
  $('shine').setAttribute('transform',`translate(${f(sx)},0) skewX(-20)`); $('shine').setAttribute('opacity',f(so));
  // caption
  const c=seg(t,4.85,5.5); $('caption').setAttribute('opacity',f(c)); $('caption').setAttribute('transform',`translate(0,${f(12*(1-outCubic(c)))})`);
}

/* ---------- 播放与拖动 ---------- */
const RENDER=new URLSearchParams(location.search).has('render');
const stage=$('stage'), hit=$('railHit'), root=document.documentElement;
window.renderAt=renderAt; window.DURATION=T; window.FPS=FPS;
window.ready=Promise.all([
  document.fonts?document.fonts.ready:Promise.resolve(),
  ...[...stage.querySelectorAll('image')].map(im=>new Promise(res=>{const i=new Image(); i.onload=i.onerror=res; i.src=im.getAttribute('href');}))
]);

// 竖屏时把画面裁到门票周围，让票面尽量大
const VB_FULL=[0,0,1920,1080], VB_TIGHT=[110,110,1700,900];
function applyViewBox(){
  const vb=(!RENDER&&window.innerWidth<window.innerHeight)?VB_TIGHT:VB_FULL;
  stage.setAttribute('viewBox',vb.join(' '));
  root.style.setProperty('--ar',(vb[2]/vb[3]).toFixed(4));
}
applyViewBox();
window.addEventListener('resize',applyViewBox);
window.addEventListener('orientationchange',applyViewBox);

const state={time:0, playing:true, dragging:false, targetX:X0, grabDX:0};
window.__ticket=state;

// 屏幕坐标 -> SVG 坐标（SVG 元素宽高比始终等于 viewBox，不依赖 getScreenCTM）
function svgX(clientX){
  const r=stage.getBoundingClientRect(), vb=stage.viewBox.baseVal;
  return vb.x+(clientX-r.left)/r.width*vb.width;
}
function dragStart(clientX){
  const x=svgX(clientX), rx=riderX(state.time);
  state.grabDX=Math.abs(x-rx)<95?rx-x:0;      // 抓在小人身上就保持相对位置，点在滑轨别处则让小人骑过去
  state.targetX=clamp(x+state.grabDX,X0,X1);
  state.dragging=true; state.playing=false;
  root.classList.add('dragging'); $('hint').classList.add('used');
}
function dragMove(clientX){ if(state.dragging) state.targetX=clamp(svgX(clientX)+state.grabDX,X0,X1); }
function dragEnd(){
  if(!state.dragging) return;
  state.dragging=false; root.classList.remove('dragging');
  if(state.targetX>=X1-1){ state.time=Math.max(state.time,timeAtX(X1)); state.playing=true; }   // 骑到终点：接着播完片尾
}

if(!RENDER){
  if(window.PointerEvent){
    let pid=null;
    hit.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0) return;
      if(state.dragging) return;
      pid=e.pointerId;
      try{hit.setPointerCapture(pid);}catch(_){}
      dragStart(e.clientX);
      e.preventDefault();
    });
    hit.addEventListener('pointermove',e=>{ if(e.pointerId===pid) dragMove(e.clientX); });
    const up=e=>{ if(e.pointerId===pid){ pid=null; dragEnd(); } };
    hit.addEventListener('pointerup',up);
    hit.addEventListener('pointercancel',up);
    hit.addEventListener('lostpointercapture',up);
  }else{
    // 没有 Pointer Events 的旧浏览器（iOS 12 及更早）：触摸 + 鼠标
    let tid=null;
    const find=e=>[...e.changedTouches].find(t=>t.identifier===tid);
    hit.addEventListener('touchstart',e=>{ if(tid!==null) return; const t=e.changedTouches[0]; tid=t.identifier; dragStart(t.clientX); },{passive:false});
    hit.addEventListener('touchmove',e=>{ const t=find(e); if(t) dragMove(t.clientX); },{passive:false});
    const tend=e=>{ if(find(e)){ tid=null; dragEnd(); } };
    hit.addEventListener('touchend',tend); hit.addEventListener('touchcancel',tend);
    hit.addEventListener('mousedown',e=>{ if(e.button!==0) return; dragStart(e.clientX); e.preventDefault();
      const mv=ev=>dragMove(ev.clientX), mu=()=>{ window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',mu); dragEnd(); };
      window.addEventListener('mousemove',mv); window.addEventListener('mouseup',mu); });
  }
  // iOS Safari 关键点：touchmove 必须在滑轨元素上以 passive:false 注册并 preventDefault，
  // 否则手指稍有上下偏移就会带动整页滚动（document/window 上的 touch 监听默认是 passive，拦不住）。
  // 从 touchstart 就拦截，是因为 iOS 一旦开始滚动，后续 touchmove 就不可取消了。
  const block=e=>{ if(e.cancelable) e.preventDefault(); };
  hit.addEventListener('touchstart',block,{passive:false});
  hit.addEventListener('touchmove',block,{passive:false});
  // 滑轨上长按不弹系统菜单
  hit.addEventListener('contextmenu',e=>e.preventDefault());

  $('replay').addEventListener('click',()=>{ state.time=0; state.playing=true; state.dragging=false; root.classList.remove('dragging'); });

  let last=performance.now();
  (function loop(now){
    const dt=Math.min(.05,Math.max(0,(now-last)/1000)); last=now;
    if(state.dragging){ const tt=timeAtX(state.targetX); state.time+=(tt-state.time)*(1-Math.exp(-dt*16)); }
    else if(state.playing) state.time+=dt;
    renderAt(state.time);
    requestAnimationFrame(loop);
  })(last);
}else{
  root.classList.add('render');
  renderAt(0);
}
