/* ============================================================
   BRIDGENT — 3D Experience (light / architectural daylight)

   One master value drives everything: progress ∈ [0 .. 1.12].
     0.00–0.40  structure builds (piers, deck, towers, rails, ramps)
     0.40–0.50  stay cables strung ONE BY ONE
     0.50–0.54  completed-bridge beat
     0.54–0.70  camera travels BACK→FRONT through the bridge
     0.70–0.92  clean vertical lift to BIRD'S-EYE + a single blue line
                snakes crossways through the streets, lighting nodes
     0.92–1.00  descend to hero; the line flows out into the wordmark
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

const COL = {
  sky:0xedf1f5, concrete:0xd8dee3, concrete2:0xc6ced5, concreteDk:0xb4bdc6,
  steel:0xb6bfc9, steelDk:0x9aa5b1, deck:0xcbd2d9, ground:0xe4e9ee,
  accent:0x0e9ca8, accentBright:0x18d0e0, accentDeep:0x0b6f76,
  building:0xd0d8df, buildingHi:0xbecbd4, buildingWarm:0xd7cfc4,
  foliage:0x8fae8b, foliage2:0x7ea07c, park:0xbccdab, trunk:0x94856f,
};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const smooth=(t)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const win=(x,a,b)=>smooth((x-a)/(b-a));
const easeInOut=(t)=>{t=clamp(t,0,1);return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};

function makeDotTexture(){
  const s=64,c=document.createElement('canvas');c.width=c.height=s;const g=c.getContext('2d');
  const grd=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(0.35,'rgba(24,208,224,0.9)');grd.addColorStop(1,'rgba(14,156,168,0)');
  g.fillStyle=grd;g.fillRect(0,0,s,s);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function makeWordTexture(){
  const w=1400,h=200,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.clearRect(0,0,w,h);
  g.fillStyle='rgba(74,90,104,0.9)';g.font='800 128px Archivo,"IBM Plex Sans",system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
  const word='BRIDGENT',ls=20,widths=[];let total=0;
  for(const ch of word){const m=g.measureText(ch).width;widths.push(m);total+=m+ls;}
  total-=ls;let x=(w-total)/2;
  for(let i=0;i<word.length;i++){g.fillText(word[i],x+widths[i]/2,h/2+6);x+=widths[i]+ls;}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

export default class Experience {
  constructor(container,opts={}){
    this.container=container;this.tier=opts.tier||'high';this.reducedMotion=!!opts.reducedMotion;
    this.progress=0;this.time=0;this._pageActive=false;this._page=0;this._running=true;this._visible=true;
    this._tmpCol=new THREE.Color();this._bright=new THREE.Color(COL.accentBright);this._sky=new THREE.Color(COL.sky);
    this._initRenderer();this._initScene();this._materials();
    this._buildBridge();this._buildCity();this._buildSnake();
    this._onResize=this._onResize.bind(this);this._tick=this._tick.bind(this);
    window.addEventListener('resize',this._onResize);
    document.addEventListener('visibilitychange',()=>{this._running=!document.hidden;if(this._running){this._last=performance.now();this._raf=requestAnimationFrame(this._tick);}});
    this.setProgress(this.reducedMotion?1:0);this._last=performance.now();this._raf=requestAnimationFrame(this._tick);
  }

  _initRenderer(){
    const dprCap=this.tier==='low'?1.4:this.tier==='mid'?1.75:2;
    this.renderer=new THREE.WebGLRenderer({antialias:this.tier!=='low',alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,dprCap));
    this.renderer.setSize(this.container.clientWidth,this.container.clientHeight);
    this.renderer.setClearColor(COL.sky,1);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    if(this.tier==='high'){this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
    this.container.appendChild(this.renderer.domElement);
  }
  _initScene(){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(COL.sky);this.scene.fog=new THREE.Fog(COL.sky,150,520);
    this.camera=new THREE.PerspectiveCamera(42,this.container.clientWidth/this.container.clientHeight,0.5,1600);
    this.camera.position.set(34,13,52);
    this.scene.add(new THREE.HemisphereLight(0xdfeaf3,0xb2bcc6,1.05));
    const sun=new THREE.DirectionalLight(0xfff4e4,2.4);sun.position.set(-58,80,46);
    if(this.tier==='high'){sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const s=sun.shadow.camera;s.left=-95;s.right=95;s.top=95;s.bottom=-95;s.near=10;s.far=300;sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.5;}
    this.scene.add(sun);
    const fill=new THREE.DirectionalLight(0xdfeaf4,0.55);fill.position.set(60,30,-40);this.scene.add(fill);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshStandardMaterial({color:COL.ground,roughness:0.98,metalness:0}));
    ground.rotation.x=-Math.PI/2;if(this.tier==='high')ground.receiveShadow=true;this.scene.add(ground);
  }
  _materials(){
    const M=(c,r,m)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
    this.mat={concrete:M(COL.concrete,0.86,0.05),concrete2:M(COL.concrete2,0.8,0.06),concreteDk:M(COL.concreteDk,0.82,0.05),steel:M(COL.steel,0.36,0.85),steelDk:M(COL.steelDk,0.42,0.8),deck:M(COL.deck,0.72,0.12)};
  }

  /* ===================== BRIDGE (low, integrated; cables one-by-one) ===================== */
  _buildBridge(){
    this.bridge=new THREE.Group();this.scene.add(this.bridge);this.parts=[];this.cableParts=[];
    const deckY=3.4, deckW=9, segN=20;
    const zNear=28, zFar=-68, span=zNear-zFar; const segLen=span/segN;
    this._bridge={deckY,deckW,zNear,zFar,span};
    const shadow=this.tier==='high';const cast=(m)=>{if(shadow){m.castShadow=true;m.receiveShadow=true;}return m;};
    const T={a:0.03,b:0.40};
    const at=(frac,len)=>{const s=T.a+(T.b-T.a-len)*frac;return [s,s+len];};

    [zNear+2,zFar-2].forEach((z,i)=>{const m=cast(new THREE.Mesh(new THREE.BoxGeometry(deckW+4,deckY+0.8,6),this.mat.concreteDk));const[t0,t1]=at(0.0+i*0.02,0.09);this._addPart(m,v(0,(deckY+0.8)/2,z),e(0,0,0),v(0,120,0),e(0,0,0.2),t0,t1);});
    const pierZ=[18,4,-10,-26,-44,-58];
    pierZ.forEach((z,i)=>{const g=new THREE.Group();const shaft=cast(new THREE.Mesh(new THREE.BoxGeometry(3,deckY,3),this.mat.concrete));shaft.position.y=deckY/2;g.add(shaft);const cap=cast(new THREE.Mesh(new THREE.BoxGeometry(deckW+1.6,0.8,4),this.mat.concrete2));cap.position.y=deckY-0.1;g.add(cap);const[t0,t1]=at(0.05+(i/pierZ.length)*0.12,0.07);this._addPart(g,v(0,0,z),e(0,0,0),v((i%2?1:-1)*130,80,0),e(0,0,0),t0,t1);});
    const girN=4;for(let s=0;s<girN;s++){const gz=zNear-(s+0.5)*(span/girN);for(const sx of[-1,1]){const g=cast(new THREE.Mesh(new THREE.BoxGeometry(1,1.1,span/girN*0.98),this.mat.steelDk));const[t0,t1]=at(0.16+s*0.03,0.07);this._addPart(g,v(sx*(deckW/2-1),deckY-0.8,gz),e(0,0,0),v(0,20,-200),e(0.2,0,0),t0,t1);}}
    this.deckSegs=[];
    for(let i=0;i<segN;i++){const z=zNear-segLen*(i+0.5);const g=new THREE.Group();const slab=cast(new THREE.Mesh(new THREE.BoxGeometry(deckW,0.6,segLen*0.98),this.mat.deck));g.add(slab);const lane=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.05,segLen*0.55),new THREE.MeshStandardMaterial({color:0xeef2f4,roughness:0.6,metalness:0}));lane.position.y=0.32;g.add(lane);const[t0,t1]=at(0.30+(i/segN)*0.42,0.06);this._addPart(g,v(0,deckY,z),e(0,0,0),v(0,90+i*3,8),e(0.14,0,(i%2?1:-1)*0.1),t0,t1);this.deckSegs.push(g);}
    // ramps: bridge flows down into the ground / city road at both ends
    this._addRamp(v(0,deckY-0.1,zNear+0.5),v(0,0.35,zNear+16),deckW,...at(0.30,0.07));
    this._addRamp(v(0,deckY-0.1,zFar-0.5),v(0,0.35,zFar-16),deckW,...at(0.62,0.07));
    // inlaid wordmark
    const word=new THREE.Mesh(new THREE.PlaneGeometry(8.4,1.2),new THREE.MeshStandardMaterial({map:makeWordTexture(),transparent:true,roughness:0.5,metalness:0.4,emissive:COL.accent,emissiveIntensity:0.12,polygonOffset:true,polygonOffsetFactor:-1}));
    this._addPart(word,v(0,deckY+0.33,16),e(-Math.PI/2,0,Math.PI),v(0,30,0),e(0,0,0),...at(0.74,0.06));
    // rails
    const railN=10;for(let i=0;i<railN;i++){const rz=zNear-(i+0.5)*(span/railN);for(const sx of[-1,1]){const rail=cast(new THREE.Mesh(new THREE.BoxGeometry(0.28,0.7,span/railN*0.96),this.mat.steel));const[t0,t1]=at(0.56+(i/railN)*0.16,0.05);this._addPart(rail,v(sx*(deckW/2-0.2),deckY+0.7,rz),e(0,0,0),v(sx*130,0,0),e(0,0,0),t0,t1);}}
    // towers (lower)
    this.towers=[];
    [{z:-2,h:18},{z:-34,h:15}].forEach((td,ti)=>{const grp=new THREE.Group();for(const sx of[-1,1]){const leg=cast(new THREE.Mesh(new THREE.BoxGeometry(1.1,td.h,1.1),this.mat.steel));leg.position.set(sx*(deckW/2+0.4),td.h/2,0);leg.rotation.z=sx*0.07;grp.add(leg);}const bar=cast(new THREE.Mesh(new THREE.BoxGeometry(deckW+3,0.9,1.1),this.mat.steel));bar.position.y=td.h*0.62;grp.add(bar);const[t0,t1]=at(0.34+ti*0.04,0.08);this._addPart(grp,v(0,deckY,td.z),e(0,0,0),v(0,100,0),e(0,0.4,0),t0,t1);this.towers.push({grp,top:td.h,z:td.z});});
    // ---- cables strung ONE BY ONE (grow from the tower) ----
    const cableList=[];
    [{z:-2,h:18},{z:-34,h:15}].forEach((td)=>{const n=this.tier==='low'?5:8;for(let s=1;s<=n;s++){for(const dir of[-1,1]){const dz=td.z+dir*s*(span/(n*2+4));for(const sx of[-1,1]){cableList.push({top:new THREE.Vector3(sx*(deckW/2+0.4),td.h*0.92,td.z),bot:new THREE.Vector3(sx*(deckW/2-0.3),deckY+0.5,dz)});}}}});
    const N=cableList.length;const c0=0.40,c1=0.50;
    cableList.forEach((cb,i)=>{const t0=c0+(i/(N-1))*(c1-c0-0.014);this._addCable(cb.top,cb.bot,t0,t0+0.014);});
    // beacons
    this._dotTex=makeDotTexture();
    this.beacons=this.towers.map((tw)=>{const m=new THREE.SpriteMaterial({map:this._dotTex,color:COL.accent,transparent:true,opacity:0,depthWrite:false});const s=new THREE.Sprite(m);s.position.set(0,tw.top+0.5,tw.z);s.scale.setScalar(2.6);this.bridge.add(s);return s;});
  }
  _addRamp(a,b,w,t0,t1){const dir=new THREE.Vector3().subVectors(b,a);const len=dir.length();const m=this.tier==='high';const box=new THREE.Mesh(new THREE.BoxGeometry(w,0.6,len),this.mat.deck);if(m){box.castShadow=true;box.receiveShadow=true;}box.position.copy(a).addScaledVector(dir,0.5);box.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir.clone().normalize());this._addPart(box,box.position.clone(),null,v(0,60,0),e(0,0,0),t0,t1,box.quaternion.clone());}
  _addPart(mesh,toPos,toEuler,offset,spinEuler,t0,t1,baseQuat){
    const toQuat=(baseQuat?baseQuat.clone():new THREE.Quaternion());if(toEuler)toQuat.multiply(new THREE.Quaternion().setFromEuler(toEuler));
    const fromQuat=toQuat.clone().multiply(new THREE.Quaternion().setFromEuler(spinEuler));
    const fromPos=toPos.clone().add(offset);mesh.position.copy(fromPos);mesh.quaternion.copy(fromQuat);mesh.visible=false;
    if(!mesh.parent)this.bridge.add(mesh);this.parts.push({mesh,fromPos,toPos:toPos.clone(),fromQuat,toQuat,t0,t1});
  }
  _addCable(top,bot,t0,t1){
    const dir=new THREE.Vector3().subVectors(bot,top);const len=dir.length();
    const g=new THREE.Group();g.position.copy(top);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
    const cyl=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,len,6,1),this.mat.steelDk.clone());cyl.position.y=len/2;g.add(cyl);
    g.scale.y=0.001;g.visible=false;this.bridge.add(g);this.cableParts.push({g,t0,t1});
  }

  /* ===================== CITY (dense, small, + trees / cars / parks) ===================== */
  _buildCity(){
    this.city=new THREE.Group();this.scene.add(this.city);
    const zStart=this._bridge.zFar-6, zEnd=-320;this._cityZ={start:zStart,end:zEnd};
    const cell=5,xMin=-95,xMax=95,avEvery=5,csEvery=6;this.avX=[];this.csZ=[];
    for(let ci=0,x=xMin;x<=xMax;x+=cell,ci++){if(ci%avEvery===0&&Math.abs(x)>=6)this.avX.push(x);}
    for(let ri=0,z=zStart-4;z>zEnd;z-=cell,ri++){if(ri%csEvery===0)this.csZ.push(z);}
    this.roadMats=[];
    const roadMat=()=>new THREE.MeshStandardMaterial({color:0xdbe1e6,roughness:0.9,metalness:0.05,transparent:true,opacity:0});
    const roads=new THREE.Group();this.city.add(roads);const mainLen=zStart-zEnd;
    const main=new THREE.Mesh(new THREE.BoxGeometry(9,0.2,mainLen),roadMat());main.position.set(0,0.11,(zStart+zEnd)/2);roads.add(main);this.roadMats.push(main.material);
    for(const x of this.avX){const av=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.18,mainLen*0.98),roadMat());av.position.set(x,0.09,(zStart+zEnd)/2);roads.add(av);this.roadMats.push(av.material);}
    for(const z of this.csZ){const cs=new THREE.Mesh(new THREE.BoxGeometry(2*xMax+10,0.18,3.4),roadMat());cs.position.set(0,0.08,z);roads.add(cs);this.roadMats.push(cs.material);}
    for(let i=0;i<8;i++){const px=(Math.round((Math.random()-0.5)*10)*avEvery*cell)+(Math.random()-0.5)*6;if(Math.abs(px)<8)continue;const pz=zStart-20-Math.random()*(zStart-zEnd-40);const park=new THREE.Mesh(new THREE.PlaneGeometry(9+Math.random()*6,9+Math.random()*6),new THREE.MeshStandardMaterial({color:COL.park,roughness:1,metalness:0,transparent:true,opacity:0}));park.rotation.x=-Math.PI/2;park.position.set(px,0.06,pz);this.city.add(park);this.roadMats.push(park.material);}
    const maxCount=this.tier==='low'?300:this.tier==='mid'?680:1250;const raw=[];
    for(let ci=0,x=xMin;x<=xMax;x+=cell,ci++){if(ci%avEvery===0)continue;if(Math.abs(x)<6)continue;for(let ri=0,z=zStart-4;z>zEnd;z-=cell,ri++){if(ri%csEvery===0)continue;if(Math.random()<0.18)continue;const w=2+Math.random()*2.3,d=2+Math.random()*2.3;const h=2.5+Math.pow(Math.random(),2.0)*20;const dist=clamp((zStart-z)/(zStart-zEnd),0,1);raw.push({x:x+(Math.random()-0.5)*1.1,z:z+(Math.random()-0.5)*1.1,w,d,h,delay:dist*0.5});}}
    for(let i=raw.length-1;i>0&&raw.length>maxCount;i--){if(Math.random()<0.5)raw.splice(i,1);}
    const buildings=raw.slice(0,maxCount);
    const geo=new THREE.BoxGeometry(1,1,1);const mat=new THREE.MeshStandardMaterial({color:COL.building,roughness:0.6,metalness:0.12});
    const inst=new THREE.InstancedMesh(geo,mat,buildings.length);if(this.tier==='high')inst.receiveShadow=true;
    const cHi=new THREE.Color(COL.buildingHi),cLo=new THREE.Color(COL.building),cWarm=new THREE.Color(COL.buildingWarm);
    buildings.forEach((b,i)=>{const r=Math.random();inst.setColorAt(i,r<0.25?cHi:r<0.4?cWarm:cLo);});
    if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
    this.buildings=buildings;this._buildings=inst;this._bd=new THREE.Object3D();this.city.add(inst);this._cityRevApplied=-1;
    this._buildTrees();this._buildCars();
  }
  _buildTrees(){
    const{start:zStart,end:zEnd}=this._cityZ;const spots=[];
    for(const x of this.avX){for(let z=zStart-6;z>zEnd;z-=7){if(Math.random()<0.45)continue;spots.push([x+(x>0?2.4:-2.4)+(Math.random()-0.5),z+(Math.random()-0.5)]);}}
    for(let z=zStart-8;z>zEnd;z-=9){if(Math.random()<0.5)continue;spots.push([(Math.random()<0.5?-6.5:6.5)+(Math.random()-0.5),z]);}
    const n=Math.min(spots.length,this.tier==='low'?120:this.tier==='mid'?260:420);
    const fol=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.05,0),new THREE.MeshStandardMaterial({color:COL.foliage,roughness:0.92,flatShading:true}),n);
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16,0.22,1.3,5),new THREE.MeshStandardMaterial({color:COL.trunk,roughness:1}),n);
    if(this.tier==='high')fol.castShadow=true;const fc=new THREE.Color(COL.foliage),fc2=new THREE.Color(COL.foliage2);const d=new THREE.Object3D();
    for(let i=0;i<n;i++){const[x,z]=spots[i];const s=0.8+Math.random()*0.7;d.position.set(x,1.3*s+0.5,z);d.scale.setScalar(s);d.rotation.set(0,Math.random()*3,0);d.updateMatrix();fol.setMatrixAt(i,d.matrix);fol.setColorAt(i,Math.random()<0.5?fc:fc2);d.position.set(x,0.65*s,z);d.scale.set(s,s,s);d.rotation.set(0,0,0);d.updateMatrix();trunk.setMatrixAt(i,d.matrix);}
    fol.instanceMatrix.needsUpdate=true;trunk.instanceMatrix.needsUpdate=true;if(fol.instanceColor)fol.instanceColor.needsUpdate=true;
    this._treeFol=fol;this._treeTrunk=trunk;fol.visible=false;trunk.visible=false;this.city.add(fol);this.city.add(trunk);
  }
  _buildCars(){
    const{start:zStart,end:zEnd}=this._cityZ;const geo=new THREE.BoxGeometry(0.9,0.5,1.9);const cols=[0xffffff,0xe4e9ed,0x9aa5b1,0x33414f,0x0e7c82,0xb44a3a];
    const nCars=this.tier==='low'?12:this.tier==='mid'?20:30;this.cars=[];const lanes=[{x:-2.4,dir:1},{x:2.4,dir:-1}];
    for(const ax of this.avX.slice(0,3)){lanes.push({x:ax-0.9,dir:1});lanes.push({x:ax+0.9,dir:-1});}
    for(let i=0;i<nCars;i++){const lane=lanes[i%lanes.length];const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:cols[(Math.random()*cols.length)|0],roughness:0.4,metalness:0.35}));if(this.tier==='high')m.castShadow=true;m.position.set(lane.x,0.5,zStart-Math.random()*(zStart-zEnd));m.visible=false;this.scene.add(m);this.cars.push({mesh:m,x:lane.x,dir:lane.dir,speed:10+Math.random()*16});}
    this._zStart=zStart;this._zEnd=zEnd;
  }

  /* ===================== SNAKE LINE (one line crossways through the streets) ===================== */
  _buildSnake(){
    this.snet=new THREE.Group();this.scene.add(this.snet);
    const{start:zStart,end:zEnd}=this._cityZ;const y=0.42;
    const xs=this.avX.slice().sort((a,b)=>a-b);const rows=this.csZ.slice();
    // serpentine waypoints, starting from the bridge
    const wp=[[0,zStart+6],[0,rows[0]]];
    for(let r=0;r<rows.length;r++){const z=rows[r];const order=(r%2===0)?xs:xs.slice().reverse();for(const x of order)wp.push([x,z]);if(r<rows.length-1)wp.push([order[order.length-1],rows[r+1]]);}
    // densely sample + cumulative length
    const pts=[];let acc=0;const push=(x,z)=>pts.push({x,z,s:0});
    push(wp[0][0],wp[0][1]);
    for(let i=1;i<wp.length;i++){const[ax,az]=wp[i-1],[bx,bz]=wp[i];const d=Math.hypot(bx-ax,bz-az);const n=Math.max(1,Math.round(d/5));for(let k=1;k<=n;k++){const t=k/n;push(ax+(bx-ax)*t,az+(bz-az)*t);}}
    for(let i=1;i<pts.length;i++)acc+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);
    let run=0;pts[0].s=0;for(let i=1;i<pts.length;i++){run+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);pts[i].s=run/acc;}
    this._snake=pts;
    // line segments with per-vertex s
    const pos=[],aS=[];for(let i=0;i<pts.length-1;i++){pos.push(pts[i].x,y,pts[i].z,pts[i+1].x,y,pts[i+1].z);aS.push(pts[i].s,pts[i+1].s);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aS',new THREE.Float32BufferAttribute(aS,1));
    this.snetMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{uFront:{value:0},uColor:{value:new THREE.Color(COL.accent)},uTip:{value:new THREE.Color(0xffffff)}},
      vertexShader:`attribute float aS; varying float vS; void main(){ vS=aS; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float uFront; uniform vec3 uColor; uniform vec3 uTip; varying float vS; void main(){ float on=step(vS,uFront); float tip=smoothstep(uFront-0.03,uFront,vS)*(1.0-step(uFront,vS)); vec3 c=mix(uColor,uTip,tip); float a=on+tip; if(a<0.02)discard; gl_FragColor=vec4(c,a);}`});
    this.snet.add(new THREE.LineSegments(g,this.snetMat));
    // intersection nodes at waypoints (light as the snake passes)
    this._interData=[];for(let i=1;i<wp.length;i++){const[x,z]=wp[i];// find s of this waypoint
      let best=1e9,sVal=0;for(const p of pts){const dd=Math.hypot(p.x-x,p.z-z);if(dd<best){best=dd;sVal=p.s;}}this._interData.push({x,z,s:sVal});}
    const nodes=new THREE.InstancedMesh(new THREE.SphereGeometry(1.0,10,10),new THREE.MeshBasicMaterial({transparent:true,opacity:0}),this._interData.length);
    const d=new THREE.Object3D();this._interData.forEach((it,i)=>{d.position.set(it.x,0.6,it.z);d.updateMatrix();nodes.setMatrixAt(i,d.matrix);nodes.setColorAt(i,this._sky);});
    nodes.instanceMatrix.needsUpdate=true;if(nodes.instanceColor)nodes.instanceColor.needsUpdate=true;this.snetNodes=nodes;this.snetNodeMat=nodes.material;this.snet.add(nodes);
    // bright head + a couple of trailing glints
    this.headSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this._dotTex,color:0xffffff,transparent:true,opacity:0,depthWrite:false}));this.headSprite.scale.setScalar(4.4);this.snet.add(this.headSprite);
    this.trailSprites=[0,1,2].map(()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this._dotTex,color:COL.accentBright,transparent:true,opacity:0,depthWrite:false}));s.scale.setScalar(2.8);this.snet.add(s);return s;});
  }
  _snakePos(s){ // interpolate world position at param s
    const pts=this._snake;s=clamp(s,0,1);let lo=0,hi=pts.length-1;
    while(lo<hi-1){const mid=(lo+hi)>>1;if(pts[mid].s<s)lo=mid;else hi=mid;}
    const a=pts[lo],b=pts[hi];const t=(s-a.s)/((b.s-a.s)||1);return[a.x+(b.x-a.x)*t,0.6,a.z+(b.z-a.z)*t];
  }

  /* ===================== CAMERA ===================== */
  get _shots(){
    return [
      {p:0.00,pos:[34,13,52],look:[-2,4,-6]},     // establishing / build (3/4 low)
      {p:0.22,pos:[28,11,32],look:[-4,4,-20]},     // assembly
      {p:0.40,pos:[17,7,16],look:[-4,3,-24]},      // close on cables being strung
      {p:0.52,pos:[0,5.6,60],look:[0,3.2,-6]},     // behind the near end, on the axis
      {p:0.61,pos:[0,5,12],look:[0,3,-56]},        // travelling FORWARD through the towers
      {p:0.70,pos:[0,6,-58],look:[0,2.4,-118]},    // exiting the bridge into the city
      {p:0.78,pos:[0,92,-112],look:[0,1,-150]},    // clean VERTICAL lift → bird's-eye
      {p:0.88,pos:[0,176,-150],look:[0,0,-176]},   // top-down hold while the line snakes
      {p:0.94,pos:[28,96,-30],look:[-4,5,-80]},    // descend
      {p:1.00,pos:[42,20,48],look:[-6,8,-22]},     // hero lock
      {p:1.12,pos:[24,19,43],look:[-4,7,-26]},     // scroll tail
    ];
  }
  _applyCamera(p){
    const shots=this._shots;let i=0;while(i<shots.length-1&&p>shots[i+1].p)i++;
    const a=shots[i],b=shots[Math.min(i+1,shots.length-1)];const t=smooth((p-a.p)/((b.p-a.p)||1));const L=(u,v2)=>u+(v2-u)*t;
    let px=L(a.pos[0],b.pos[0]),py=L(a.pos[1],b.pos[1]),pz=L(a.pos[2],b.pos[2]);let lx=L(a.look[0],b.look[0]),ly=L(a.look[1],b.look[1]),lz=L(a.look[2],b.look[2]);
    if(p>=0.985&&!this.reducedMotion){const s=smooth((p-0.985)/0.015);px+=Math.sin(this.time*0.3)*1.0*s;py+=Math.cos(this.time*0.24)*0.5*s;}
    this.camera.position.set(px,py,pz);this.camera.lookAt(lx,ly,lz);
  }
  enterPage(){this._pageActive=true;this.setProgress(1);}
  setPage(t){this._page=clamp(t,0,1);}
  get _pageShots(){return[
    {p:0.00,pos:[42,20,48],look:[-6,8,-22]},{p:0.16,pos:[47,28,56],look:[-6,7,-36]},
    {p:0.44,pos:[40,72,40],look:[-6,3,-96]},{p:0.72,pos:[6,140,-40],look:[0,1,-150]},{p:1.00,pos:[-16,180,-150],look:[0,0,-190]}];}
  _applyPage(t){const shots=this._pageShots;let i=0;while(i<shots.length-1&&t>shots[i+1].p)i++;const a=shots[i],b=shots[Math.min(i+1,shots.length-1)];const k=smooth((t-a.p)/((b.p-a.p)||1));const L=(u,v2)=>u+(v2-u)*k;const bob=this.reducedMotion?0:1;this.camera.position.set(L(a.pos[0],b.pos[0])+Math.sin(this.time*0.25)*1.2*bob,L(a.pos[1],b.pos[1])+Math.cos(this.time*0.2)*0.7*bob,L(a.pos[2],b.pos[2]));this.camera.lookAt(L(a.look[0],b.look[0]),L(a.look[1],b.look[1]),L(a.look[2],b.look[2]));}

  /* ===================== STATE ===================== */
  setProgress(p){
    this.progress=clamp(p,0,1.12);const P=this.progress;
    for(const part of this.parts){const active=P>=part.t0-0.0006;part.mesh.visible=active;if(!active)continue;const lt=easeInOut((P-part.t0)/(part.t1-part.t0));part.mesh.position.lerpVectors(part.fromPos,part.toPos,lt);part.mesh.quaternion.slerpQuaternions(part.fromQuat,part.toQuat,lt);}
    for(const c of this.cableParts){const on=P>=c.t0-0.0006;c.g.visible=on;if(!on)continue;c.g.scale.y=Math.max(0.001,easeInOut((P-c.t0)/(c.t1-c.t0)));}
    const roadRev=win(P,0.40,0.52);for(const m of this.roadMats)m.opacity=roadRev*0.95;
    this._cityReveal=win(P,0.44,0.66);this._updateCity(this._cityReveal);
    const show=this._cityReveal>0.15;if(this._treeFol){this._treeFol.visible=show;this._treeTrunk.visible=show;}
    if(this.cars){const cs=this._cityReveal>0.2;for(const c of this.cars)c.mesh.visible=cs;}
    this._netReveal=win(P,0.70,0.92);if(this.snetMat)this.snetMat.uniforms.uFront.value=this._netReveal;if(this.snetNodeMat)this.snetNodeMat.opacity=smooth(this._netReveal*1.3);
    if(this.beacons)this.beacons.forEach(s=>s.material.opacity=win(P,0.4,0.55)*0.9);
    if(!this._running||this.reducedMotion)this._applyCamera(this.progress);
  }
  _updateCity(reveal){if(!this._buildings||Math.abs(this._cityRevApplied-reveal)<0.001)return;this._cityRevApplied=reveal;const d=this._bd;this.buildings.forEach((b,i)=>{const r=smooth((reveal-b.delay)*3.0);const h=Math.max(0.001,b.h*r);d.position.set(b.x,h/2,b.z);d.scale.set(b.w,h,b.d);d.rotation.set(0,0,0);d.updateMatrix();this._buildings.setMatrixAt(i,d.matrix);});this._buildings.instanceMatrix.needsUpdate=true;}
  setScroll(){}
  setVisible(v){this._visible=v;}

  /* ===================== RENDER ===================== */
  _tick(){
    if(!this._running)return;const now=performance.now();const dt=Math.min(0.05,(now-this._last)/1000);this._last=now;this.time+=dt;
    if(this.cars&&this._cityReveal>0.2&&!this.reducedMotion){const zS=this._zStart,zE=this._zEnd;for(const c of this.cars){c.mesh.position.z+=c.dir*c.speed*dt;if(c.mesh.position.z>zS)c.mesh.position.z=zE;if(c.mesh.position.z<zE)c.mesh.position.z=zS;}}
    if(this._netReveal>0.01&&!this.reducedMotion){
      const front=this._netReveal;
      if(this.snetNodes){for(let i=0;i<this._interData.length;i++){const on=front>=this._interData[i].s;this.snetNodes.setColorAt(i,on?this._bright:this._sky);}this.snetNodes.instanceColor.needsUpdate=true;}
      // head + trailing glints ride the growing line
      const hp=this._snakePos(front);this.headSprite.position.set(hp[0],hp[1],hp[2]);this.headSprite.material.opacity=front<1?0.95:0.0;
      this.trailSprites.forEach((s,k)=>{const tp=this._snakePos(front-0.015*(k+1));s.position.set(tp[0],tp[1],tp[2]);s.material.opacity=front<1?0.6*(1-k*0.25):0.0;});
    }
    if(this._visible){if(this.reducedMotion){}else if(this._pageActive)this._applyPage(this._page);else this._applyCamera(this.progress);this.renderer.render(this.scene,this.camera);}
    this._raf=requestAnimationFrame(this._tick);
  }
  _onResize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
  dispose(){cancelAnimationFrame(this._raf);window.removeEventListener('resize',this._onResize);this.renderer.dispose();if(this.renderer.domElement.parentNode)this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);}
}
function v(x,y,z){return new THREE.Vector3(x,y,z);}
function e(x,y,z){return new THREE.Euler(x,y,z);}
