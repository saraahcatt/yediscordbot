import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const root=document.documentElement;
const chapters=[...document.querySelectorAll('.chapter')];
const copies=chapters.map(el=>el.querySelector('.chapter-copy'));
const nav=[...document.querySelectorAll('.timeline a')];
const progressLine=document.querySelector('.timeline-progress');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const menu=document.querySelector('.chapters-menu');
const menuButton=document.querySelector('.menu-toggle');
const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,v)=>THREE.MathUtils.smoothstep(v,a,b);
const mix=THREE.MathUtils.lerp;
let current=0,target=0,lastActive=-1,renderer,scene,camera,models=[],anchors=[],mobile=false;
let pointer={x:0,y:0},running=true,lastFrame=0;

menuButton.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;menuButton.setAttribute('aria-expanded',String(open));});
menu.addEventListener('click',event=>{if(event.target.closest('a')){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');}});
addEventListener('keydown',event=>{if(event.key==='Escape'){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');}});
document.addEventListener('click',event=>{if(!menu.contains(event.target)&&!menuButton.contains(event.target)){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');}});

function measure(){
  mobile=innerWidth<=800;
  anchors=chapters.map(el=>el.offsetTop);
  if(renderer){renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:1.8));camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  setTarget();
}
function setTarget(){
  const y=scrollY;
  let index=0;
  for(let i=1;i<anchors.length;i++)if(y>=anchors[i])index=i;
  target=index===anchors.length-1?index:index+clamp((y-anchors[index])/(anchors[index+1]-anchors[index]),0,1);
}
addEventListener('scroll',setTarget,{passive:true});
addEventListener('resize',measure);
addEventListener('pointermove',event=>{pointer.x=(event.clientX/innerWidth-.5)*2;pointer.y=(event.clientY/innerHeight-.5)*2;},{passive:true});
document.addEventListener('visibilitychange',()=>{running=!document.hidden&&root.classList.contains('has-webgl');if(running){lastFrame=0;requestAnimationFrame(frame);}});

function material(color,metalness=.65,roughness=.25){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
const chrome=material('#bcbcbc',1,.24);
const dark=material('#202020',.72,.34);
const mint=material('#aaaaaa',.65,.3);
const gold=material('#b8b8b8',.88,.29);
const pink=material('#444444',.55,.33);
const violet=material('#858585',.75,.28);

function mesh(geometry,mat,parent,x=0,y=0,z=0){const obj=new THREE.Mesh(geometry,mat);obj.position.set(x,y,z);if(parent)parent.add(obj);return obj;}
function box(w,h,d,r=.08){
  const x=-w/2,y=-h/2,s=new THREE.Shape(),radius=Math.min(r,w/2,h/2);
  s.moveTo(x+radius,y);s.lineTo(x+w-radius,y);s.quadraticCurveTo(x+w,y,x+w,y+radius);s.lineTo(x+w,y+h-radius);s.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);s.lineTo(x+radius,y+h);s.quadraticCurveTo(x,y+h,x,y+h-radius);s.lineTo(x,y+radius);s.quadraticCurveTo(x,y,x+radius,y);
  const geo=new THREE.ExtrudeGeometry(s,{depth:Math.max(.005,d-r*.5),bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r*.3,bevelThickness:r*.25,curveSegments:6});geo.center();return geo;
}
function canvasTexture(draw,w=1024,h=1024){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d'),w,h);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;}
function faceTexture(texture,roughness=.45){return new THREE.MeshStandardMaterial({map:texture,metalness:.15,roughness,side:THREE.DoubleSide});}
function torus(parent,r,t,mat,x=0,y=0,z=0){return mesh(new THREE.TorusGeometry(r,t,12,80),mat,parent,x,y,z);}
function cylinder(parent,r1,r2,h,mat,x=0,y=0,z=0,segments=64){return mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat,parent,x,y,z);}
function coin(parent,x,y,z,size=.6){
  const g=new THREE.Group();parent.add(g);g.position.set(x,y,z);
  const body=cylinder(g,size,size,.14,gold);body.rotation.x=Math.PI/2;
  torus(g,size*.86,.025,gold,0,0,.078);
  const symbol=canvasTexture((c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#454545';c.font='bold 680px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('Y',w/2,h*.54);},1024,1024);
  const face=mesh(new THREE.PlaneGeometry(size*1.2,size*1.2),new THREE.MeshStandardMaterial({map:symbol,transparent:true,metalness:.6,roughness:.3,depthWrite:false}),g,0,0,.083);
  for(let i=0;i<36;i++){const a=i/36*Math.PI*2;const line=mesh(new THREE.BoxGeometry(.017,.09,.022),gold,g,Math.cos(a)*size,Math.sin(a)*size,0);line.rotation.z=a;}
  return g;
}
function avatar(){
  const g=new THREE.Group();
  const disc=cylinder(g,1.72,1.72,.31,dark);disc.rotation.x=Math.PI/2;
  torus(g,1.64,.1,chrome,0,0,.14);
  torus(g,1.53,.033,mint,0,0,.21);
  torus(g,1.7,.025,mint,0,0,-.12);
  const texture=new THREE.TextureLoader().load('assets/ye-avatar.png');texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  mesh(new THREE.CircleGeometry(1.5,96),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}),g,0,0,.21);
  const back=canvasTexture((c,w,h)=>{c.fillStyle='#202020';c.fillRect(0,0,w,h);c.fillStyle='#cccccc';c.font='bold 490px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('ye.',w*.49,h*.52);});
  const backFace=mesh(new THREE.CircleGeometry(1.5,96),faceTexture(back),g,0,0,-.165);backFace.rotation.y=Math.PI;
  for(let i=0;i<44;i++){const a=i/44*Math.PI*2;const notch=mesh(new THREE.BoxGeometry(.015,.05,.23),chrome,g,Math.cos(a)*1.72,Math.sin(a)*1.72,0);notch.rotation.z=a-Math.PI/2;}
  g.userData.rotation=[.08,-.26,-.14];return g;
}
function banknoteTexture(){return canvasTexture((c,w,h)=>{
  c.fillStyle='#bfbfbf';c.fillRect(0,0,w,h);c.strokeStyle='#4d4d4d';c.lineWidth=5;c.strokeRect(25,25,w-50,h-50);c.lineWidth=2;c.strokeRect(37,37,w-74,h-74);
  c.save();c.translate(w/2,h/2);c.strokeStyle='#737373';c.lineWidth=1.2;
  for(let j=0;j<16;j++){c.beginPath();for(let k=0;k<=360;k++){const a=k/180*Math.PI,r=83+j*5+Math.sin(a*12)*8;const x=Math.cos(a)*r*1.6,y=Math.sin(a)*r;k?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.stroke();}c.restore();
  c.fillStyle='#383838';c.textAlign='center';c.font='bold 135px Georgia';c.fillText('100',w/2,h*.61);c.font='20px monospace';c.fillText('BANCO DA YE',w/2,83);c.font='15px monospace';c.fillText('CATNNABIS • MOEDA DO JOGO',w/2,h-57);
  c.font='bold 57px Georgia';c.textAlign='left';c.fillText('100',55,107);c.textAlign='right';c.fillText('100',w-55,h-66);
  for(let i=0;i<48;i++){c.strokeStyle='#7f7f7f';c.lineWidth=.8;c.beginPath();c.moveTo(60+i*18,130);c.bezierCurveTo(140+i*14,250,50+i*18,350,80+i*18,390);c.stroke();}
},1024,512);}
function money(){
  const g=new THREE.Group(),noteMat=faceTexture(banknoteTexture(),.65);
  for(let i=0;i<9;i++){const bundle=new THREE.Group();g.add(bundle);bundle.rotation.z=-.18+i*.007;bundle.position.set(-.25,-.65+i*.045,0);const n=mesh(box(2.65,.032,1.2,.02),material('#b6b6b6',.1,.8),bundle);const top=mesh(new THREE.PlaneGeometry(2.6,1.15),noteMat,bundle,0,.024,0);top.rotation.x=-Math.PI/2;}
  const strap=mesh(box(.32,.46,1.23,.02),material('#888888',.08,.75),g,-.25,-.48,0);strap.rotation.z=-.18;
  for(let i=0;i<3;i++){const note=new THREE.PlaneGeometry(2.65,1.32,28,12),pos=note.attributes.position;for(let v=0;v<pos.count;v++){const x=pos.getX(v),y=pos.getY(v);pos.setZ(v,Math.sin(x*1.4+i*.5)*.18+Math.cos(y*2)*.08);}note.computeVertexNormals();const n=mesh(note,noteMat,g,-.15+i*.14,.45+i*.46,-i*.33);n.rotation.set(-.25+i*.1,.12+i*.14,-.27+i*.2);n.userData.float=i*.6;}
  for(let i=0;i<5;i++){const c=coin(g,1.16,-1.1+i*.12,.64,.51);c.rotation.x=-Math.PI/2;}
  const c=coin(g,-1.25,.1,.95,.58);c.rotation.set(.23,-.35,-.3);c.userData.float=1.5;
  const c2=coin(g,1.25,1.15,-.3,.42);c2.rotation.set(.3,.5,.25);c2.userData.float=2;
  g.userData.rotation=[.2,-.4,-.03];return g;
}
function trophy(){
  const g=new THREE.Group();
  mesh(box(1.5,.24,1.05,.07),dark,g,0,-1.55,0);mesh(box(1.22,.12,.85,.04),chrome,g,0,-1.37,0);
  cylinder(g,.22,.38,.55,violet,0,-1.05,0);cylinder(g,.67,.25,.19,chrome,0,-.72,0);
  const points=[new THREE.Vector2(.2,-.65),new THREE.Vector2(.38,-.53),new THREE.Vector2(.66,-.35),new THREE.Vector2(.85,.04),new THREE.Vector2(.92,.57),new THREE.Vector2(.95,.75),new THREE.Vector2(.88,.78),new THREE.Vector2(.83,.57),new THREE.Vector2(.76,.07),new THREE.Vector2(.59,-.26),new THREE.Vector2(.3,-.46),new THREE.Vector2(.2,-.48)];
  mesh(new THREE.LatheGeometry(points,64),chrome,g,0,.02,0);torus(g,.91,.045,violet,0,.78,0).rotation.x=Math.PI/2;
  for(const s of [-1,1]){const handle=torus(g,.55,.065,violet,s*.91,.34,0);handle.scale.set(.7,1,1);}
  const star=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.29:.59;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
  const geometry=new THREE.ExtrudeGeometry(star,{depth:.14,bevelEnabled:true,bevelThickness:.04,bevelSize:.035,bevelSegments:3,steps:1});geometry.center();mesh(geometry,violet,g,0,1.82,0);
  const plate=canvasTexture((c,w,h)=>{c.fillStyle='#181818';c.fillRect(0,0,w,h);c.fillStyle='#cccccc';c.font='bold 75px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('CHAMPIONS',w/2,h/2);},1024,256);
  mesh(new THREE.PlaneGeometry(1.15,.2),faceTexture(plate),g,0,-1.52,.54);
  g.userData.rotation=[.12,-.35,-.12];return g;
}
function cardTexture(rank,suit,color){return canvasTexture((c,w,h)=>{c.fillStyle='#dcdcdc';c.fillRect(0,0,w,h);c.strokeStyle='#aaaaaa';c.lineWidth=3;c.strokeRect(20,20,w-40,h-40);c.fillStyle=color;c.font='bold 95px Georgia';c.textAlign='center';c.fillText(rank,65,115);c.font='70px Georgia';c.fillText(suit,65,190);c.save();c.translate(w,h);c.rotate(Math.PI);c.font='bold 95px Georgia';c.fillText(rank,65,115);c.font='70px Georgia';c.fillText(suit,65,190);c.restore();c.font='310px Georgia';c.fillText(suit,w/2,h*.65);},512,768);}
function die(parent,x,y,z,rotation){
  const g=new THREE.Group();parent.add(g);g.position.set(x,y,z);g.rotation.set(...rotation);mesh(box(.85,.85,.85,.13),pink,g);
  const dotMat=material('#c0c0c0',.3,.35),dotGeo=new THREE.SphereGeometry(.066,12,12);
  for(const [dx,dy] of [[-.2,-.2],[-.2,.2],[.2,-.2],[.2,.2],[0,0]])mesh(dotGeo,dotMat,g,dx,dy,.425);
  for(const [dx,dz] of [[-.2,-.2],[.2,.2],[0,0]])mesh(dotGeo,dotMat,g,dx,.425,dz);
  for(const [dy,dz] of [[-.2,-.2],[-.2,.2],[.2,-.2],[.2,.2]])mesh(dotGeo,dotMat,g,.425,dy,dz);
  return g;
}
function games(){
  const g=new THREE.Group();
  [['K','♠','#222222'],['A','♥','#555555']].forEach(([r,s,c],i)=>{const card=new THREE.Group();g.add(card);card.position.set(i*.9-.45,i*-.15,.2+i*.42);card.rotation.set(-.1,i*.12,i?-.22:.24);mesh(box(1.6,2.4,.065,.13),material('#dcdcdc',.05,.4),card);mesh(new THREE.PlaneGeometry(1.51,2.31),faceTexture(cardTexture(r,s,c)),card,0,0,.046);});
  die(g,-1.3,-1.1,.85,[.3,.5,.2]);die(g,1.35,.9,-.1,[.5,-.3,-.25]);
  const chip=coin(g,.9,-1.45,.3,.48);chip.rotation.set(-.6,.3,.4);
  g.userData.rotation=[.08,-.22,.05];return g;
}
function city(){
  const g=new THREE.Group();
  mesh(box(3.35,.18,2.45,.15),dark,g,0,-1.45,0);
  mesh(box(3.1,.045,2.2,.1),material('#393939',.7,.3),g,0,-1.33,0);
  const buildingMats=[material('#666666',.8,.3),material('#949494',.7,.34),material('#4a4a4a',.75,.3)];
  const windowMat=new THREE.MeshStandardMaterial({color:'#dddddd',emissive:'#a0a0a0',emissiveIntensity:.25,metalness:.4,roughness:.3});
  const buildings=[[-.95,1.8,.7,.7,.2,0],[0,3,.85,.75,-.25,1],[.95,2.2,.75,.8,.25,2],[-.4,.8,.6,.55,.8,1]];
  buildings.forEach(([x,h,w,d,z,m])=>{const b=new THREE.Group();g.add(b);b.position.set(x,h/2-1.31,z);mesh(box(w,h,d,.04),buildingMats[m],b);mesh(box(w+.08,.1,d+.08,.025),chrome,b,0,h/2,0);
    for(let row=0;row<Math.floor(h/.32)-1;row++)for(let col=0;col<2;col++){mesh(new THREE.BoxGeometry(.12,.12,.015),windowMat,b,(col-.5)*w*.48,-h/2+.26+row*.32,d/2+.01);mesh(new THREE.BoxGeometry(.015,.12,.12),windowMat,b,w/2+.01,-h/2+.26+row*.32,(col-.5)*d*.48);}
  });
  cylinder(g,.015,.025,.7,chrome,0,2.02,-.25,12);mesh(new THREE.SphereGeometry(.06,12,12),gold,g,0,2.4,-.25);
  const car=new THREE.Group();g.add(car);car.position.set(.55,-1.14,1.05);mesh(box(.78,.17,.32,.06),gold,car);mesh(box(.4,.14,.29,.05),dark,car,-.04,.14,0);
  for(const x of [-.24,.24])for(const z of [-.17,.17]){const wheel=cylinder(car,.095,.095,.05,dark,x,-.07,z,20);wheel.rotation.x=Math.PI/2;}
  g.userData.rotation=[.26,-.52,-.06];return g;
}
function community(){
  const g=new THREE.Group();
  const shape=new THREE.Shape();shape.moveTo(-1.23,1.35);shape.lineTo(0,1.67);shape.lineTo(1.23,1.35);shape.lineTo(1.12,-.05);shape.quadraticCurveTo(1,-.9,0,-1.52);shape.quadraticCurveTo(-1,-.9,-1.12,-.05);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelSize:.12,bevelThickness:.09,bevelSegments:4,steps:1,curveSegments:20});geo.center();mesh(geo,chrome,g);
  const inner=mesh(geo,material('#303030',.7,.3),g,0,.05,.2);inner.scale.set(.86,.86,.65);
  const badge=new THREE.Group();g.add(badge);badge.position.z=.48;
  for(const [x,y,r] of [[0,.42,.25],[-.54,.18,.19],[.54,.18,.19]]){mesh(new THREE.SphereGeometry(r,24,24),chrome,badge,x,y,0);const body=mesh(new THREE.CapsuleGeometry(r*.8,r*1.1,5,16),chrome,badge,x,y-.58,0);body.scale.z=.6;}
  const ring=torus(g,1.95,.017,material('#999999',.85,.3));ring.rotation.set(.4,-.55,.4);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2;const orb=mesh(new THREE.IcosahedronGeometry(.13,1),chrome,g,Math.cos(a)*1.95,Math.sin(a)*1.95,.2);orb.userData.float=i;}
  g.userData.rotation=[.12,-.22,.1];return g;
}

function init(){
  renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#world'),antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,70);camera.position.set(0,0,12);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.environmentIntensity=.85;
  scene.add(new THREE.AmbientLight('#ffffff',.3));
  const key=new THREE.DirectionalLight('#ffffff',2);key.position.set(-3,5,7);scene.add(key);
  const rim=new THREE.DirectionalLight('#ffffff',2.5);rim.position.set(4,2,-3);scene.add(rim);
  const fill=new THREE.DirectionalLight('#ffffff',.8);fill.position.set(-4,-1,2);scene.add(fill);
  models=[avatar(),money(),trophy(),games(),city(),community(),avatar()];models.forEach(model=>{scene.add(model);model.traverse(child=>{if(child.userData.float!==undefined)child.userData.startY=child.position.y;});});
  root.classList.add('js','has-webgl');
  measure();current=target;frame(0);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();});
}
function fallback(){root.classList.remove('has-webgl');root.classList.add('no-webgl');copies.forEach(el=>el.classList.add('visible'));running=false;}
function updateUI(){
  let active=clamp(Math.round(current),0,chapters.length-1);
  copies.forEach((copy,i)=>{const d=current-i,opacity=1-smooth(.24,.53,Math.abs(d));copy.style.opacity=String(opacity);copy.classList.toggle('visible',opacity>.02);copy.inert=opacity<.5;
    const offset=clamp(d,-1,1)*-75;
    copy.style.transform=mobile?`translateY(${offset*.5}px)`:`translateY(calc(-50% + ${offset}px))`;
  });
  if(active!==lastActive){lastActive=active;nav.forEach((link,i)=>{link.classList.toggle('active',active===i);if(active===i)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});}
  progressLine.style.transform=`scaleX(${current/(chapters.length-1)})`;
}
function frame(time){
  if(!running)return;
  const delta=lastFrame?Math.min((time-lastFrame)/1000,.05):1/60;lastFrame=time;
  current=reduced.matches?target:mix(current,target,1-Math.exp(-delta*9));if(Math.abs(current-target)<.0001)current=target;
  updateUI();
  const t=time*.001,viewHeight=2*Math.tan(THREE.MathUtils.degToRad(17))*12,viewWidth=viewHeight*camera.aspect;
  models.forEach((model,i)=>{
    const d=current-i,abs=Math.abs(d);model.visible=abs<.9;if(!model.visible)return;
    const travel=smooth(.16,1,abs),enter=d<0;
    const baseX=mobile?0:viewWidth*.225,baseY=mobile?viewHeight*.21:.05;
    model.position.set(baseX+(enter?4:-3.5)*travel,baseY+(enter?-1.5:2.3)*travel,-travel*7);
    const bases=model.userData.rotation;
    const spin=reduced.matches?0:d*.85+(d>0?travel*2.9:-travel*2.2);
    model.rotation.set(bases[0]+(reduced.matches?0:Math.sin(t*.5+i)*.04)+travel*.25,bases[1]+spin+(reduced.matches?0:pointer.x*.07),bases[2]+(reduced.matches?0:Math.sin(t*.35+i)*.035)+d*.12);
    const mobileSize=clamp(innerWidth/innerHeight*1.25,.53,.88),baseScale=mobile?mobileSize:1;
    model.scale.setScalar(baseScale*(1-smooth(.22,.9,abs)*.92));
    if(!reduced.matches){model.position.y+=Math.sin(t*.8+i)*.045;model.traverse(child=>{if(child.userData.float!==undefined)child.position.y=child.userData.startY+Math.sin(t*.9+child.userData.float)*.065;});}
  });
  const camOrbit=reduced.matches?0:Math.sin(current*Math.PI)*.22;camera.position.x=camOrbit;camera.position.y=reduced.matches?0:pointer.y*-.05;camera.lookAt(0,0,0);
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
try{init();}catch(error){console.error('Não foi possível iniciar a apresentação 3D.',error);fallback();}
