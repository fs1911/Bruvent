/* ============================================================
   BRUVENT — 3D Experience (light / architectural daylight)

   progress ∈ [0 .. 1.12]
     0.00–0.46  bridge assembles — slow, fully continuous (parts &
                cables interleave; cables strung one by one)
     0.46–0.58  road extends, city rises, camera climbs
     0.58–0.72  camera crosses the bridge (back→front) over water
     0.72–0.92  clean vertical lift to a BIRD'S-EYE of a radial
                (Paris-étoile) city; blue lines run from the edges
                INWARD along the avenues and converge at the centre
     0.92–1.00  the centre flares big; the wordmark appears
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

const COL = {
  sky:0xedf1f5, concrete:0xd8dee3, concrete2:0xc6ced5, concreteDk:0xb4bdc6,
  steel:0xb6bfc9, steelDk:0x9aa5b1, deck:0xcbd2d9, ground:0xe6ebef, land:0xe1e7ec,
  water:0xaecad6, accent:0x0e9ca8, accentBright:0x18d0e0, accentDeep:0x0b6f76,
  building:0xd0d8df, buildingHi:0xbecbd4, buildingWarm:0xd7cfc4,
  foliage:0x8fae8b, foliage2:0x7ea07c, park:0xbccdab, trunk:0x94856f,
};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const smooth=(t)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const win=(x,a,b)=>smooth((x-a)/(b-a));
const easeInOut=(t)=>{t=clamp(t,0,1);return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};

/* radial city geometry */
const CX=0, CZ=-240, ROUT=150, RAYS=12, RINGS=[42,84,126], PLAZA=0.5;
const rayAng=(k)=>k*(Math.PI*2/RAYS);
const rayDir=(k)=>[Math.cos(rayAng(k)),Math.sin(rayAng(k))];

function makeDotTexture(){
  const s=64,c=document.createElement('canvas');c.width=c.height=s;const g=c.getContext('2d');
  const grd=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(0.35,'rgba(24,208,224,0.9)');grd.addColorStop(1,'rgba(14,156,168,0)');
  g.fillStyle=grd;g.fillRect(0,0,s,s);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export default class Experience {
  constructor(container,opts={}){
    this.container=container;this.tier=opts.tier||'high';this.reducedMotion=!!opts.reducedMotion;
    this.progress=0;this.time=0;this._pageActive=false;this._page=0;this._running=true;this._visible=true;
    this._bright=new THREE.Color(COL.accentBright);this._sky=new THREE.Color(COL.sky);
    this._initRenderer();this._initScene();this._materials();
    this._buildBridge();this._buildCity();this._buildNetwork();
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
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(COL.sky);this.scene.fog=new THREE.Fog(COL.sky,170,560);
    this.camera=new THREE.PerspectiveCamera(42,this.container.clientWidth/this.container.clientHeight,0.5,1800);
    this.camera.position.set(34,13,52);
    this.scene.add(new THREE.HemisphereLight(0xdfeaf3,0xb2bcc6,1.05));
    const sun=new THREE.DirectionalLight(0xfff4e4,2.35);sun.position.set(-60,90,60);
    if(this.tier==='high'){sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const s=sun.shadow.camera;s.left=-120;s.right=120;s.top=120;s.bottom=-120;s.near=10;s.far=360;sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.5;}
    this.scene.add(sun);
    const fill=new THREE.DirectionalLight(0xdfeaf4,0.5);fill.position.set(60,30,-120);this.scene.add(fill);
    // land
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshStandardMaterial({color:COL.land,roughness:0.98,metalness:0}));
    ground.rotation.x=-Math.PI/2;if(this.tier==='high')ground.receiveShadow=true;this.scene.add(ground);
    // water the bridge spans
    const water=new THREE.Mesh(new THREE.PlaneGeometry(600,94),new THREE.MeshStandardMaterial({color:COL.water,roughness:0.22,metalness:0.15,transparent:true,opacity:0.92}));
    water.rotation.x=-Math.PI/2;water.position.set(0,0.02,-33);this.scene.add(water);this._water=water;
  }
  _materials(){
    const M=(c,r,m)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
    this.mat={concrete:M(COL.concrete,0.86,0.05),concrete2:M(COL.concrete2,0.8,0.06),concreteDk:M(COL.concreteDk,0.82,0.05),steel:M(COL.steel,0.36,0.85),steelDk:M(COL.steelDk,0.42,0.8),deck:M(COL.deck,0.72,0.12)};
  }

  /* ===================== BRIDGE (low, over water; continuous build) ===================== */
  _buildBridge(){
    this.bridge=new THREE.Group();this.scene.add(this.bridge);this.parts=[];this.cableParts=[];
    const deckY=3.0, deckW=9, segN=20, zNear=28, zFar=-68, span=zNear-zFar, segLen=span/segN;
    this._bridge={deckY,deckW,zNear,zFar,span};
    const shadow=this.tier==='high';const cast=(m)=>{if(shadow){m.castShadow=true;m.receiveShadow=true;}return m;};
    const T={a:0.02,b:0.46};
    const at=(frac,len)=>{const s=T.a+(T.b-T.a-len)*clamp(frac,0,1);return[s,s+len];};
    // abutments
    [zNear+2,zFar-2].forEach((z,i)=>{const m=cast(new THREE.Mesh(new THREE.BoxGeometry(deckW+4,deckY+0.8,6),this.mat.concreteDk));const[t0,t1]=at(0.0+i*0.03,0.10);this._addPart(m,v(0,(deckY+0.8)/2,z),e(0,0,0),v(0,110,0),e(0,0,0.2),t0,t1);});
    // piers (some stand in the water)
    const pierZ=[18,4,-10,-26,-44,-58];
    pierZ.forEach((z,i)=>{const g=new THREE.Group();const shaft=cast(new THREE.Mesh(new THREE.BoxGeometry(3,deckY,3),this.mat.concrete));shaft.position.y=deckY/2;g.add(shaft);const cap=cast(new THREE.Mesh(new THREE.BoxGeometry(deckW+1.6,0.8,4),this.mat.concrete2));cap.position.y=deckY-0.1;g.add(cap);const[t0,t1]=at(0.05+(i/pierZ.length)*0.16,0.09);this._addPart(g,v(0,0,z),e(0,0,0),v((i%2?1:-1)*120,70,0),e(0,0,0),t0,t1);});
    // girders (continuous with piers)
    const girN=4;for(let s=0;s<girN;s++){const gz=zNear-(s+0.5)*(span/girN);for(const sx of[-1,1]){const g=cast(new THREE.Mesh(new THREE.BoxGeometry(1,1.1,span/girN*0.98),this.mat.steelDk));const[t0,t1]=at(0.18+s*0.05,0.09);this._addPart(g,v(sx*(deckW/2-1),deckY-0.8,gz),e(0,0,0),v(0,18,-180),e(0.2,0,0),t0,t1);}}
    // deck segments (overlaps girders → flowing)
    this.deckSegs=[];for(let i=0;i<segN;i++){const z=zNear-segLen*(i+0.5);const g=new THREE.Group();const slab=cast(new THREE.Mesh(new THREE.BoxGeometry(deckW,0.6,segLen*0.98),this.mat.deck));g.add(slab);const lane=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.05,segLen*0.55),new THREE.MeshStandardMaterial({color:0xeef2f4,roughness:0.6,metalness:0}));lane.position.y=0.32;g.add(lane);const[t0,t1]=at(0.28+(i/segN)*0.40,0.07);this._addPart(g,v(0,deckY,z),e(0,0,0),v(0,80+i*3,8),e(0.14,0,(i%2?1:-1)*0.1),t0,t1);this.deckSegs.push(g);}
    // ramps → flush with land / city road
    this._addRamp(v(0,deckY-0.1,zNear+0.5),v(0,0.18,zNear+18),deckW,...at(0.30,0.08));
    this._addRamp(v(0,deckY-0.1,zFar-0.5),v(0,0.18,zFar-22),deckW,...at(0.60,0.08)); // gentle descent, lands on the boulevard
    // rails (continuous after deck)
    const railN=10;for(let i=0;i<railN;i++){const rz=zNear-(i+0.5)*(span/railN);for(const sx of[-1,1]){const rail=cast(new THREE.Mesh(new THREE.BoxGeometry(0.28,0.7,span/railN*0.96),this.mat.steel));const[t0,t1]=at(0.52+(i/railN)*0.20,0.06);this._addPart(rail,v(sx*(deckW/2-0.2),deckY+0.7,rz),e(0,0,0),v(sx*120,0,0),e(0,0,0),t0,t1);}}
    // towers
    this.towers=[];[{z:-2,h:17},{z:-34,h:14}].forEach((td,ti)=>{const grp=new THREE.Group();for(const sx of[-1,1]){const leg=cast(new THREE.Mesh(new THREE.BoxGeometry(1.1,td.h,1.1),this.mat.steel));leg.position.set(sx*(deckW/2+0.4),td.h/2,0);leg.rotation.z=sx*0.07;grp.add(leg);}const bar=cast(new THREE.Mesh(new THREE.BoxGeometry(deckW+3,0.9,1.1),this.mat.steel));bar.position.y=td.h*0.62;grp.add(bar);const[t0,t1]=at(0.32+ti*0.05,0.09);this._addPart(grp,v(0,deckY,td.z),e(0,0,0),v(0,90,0),e(0,0.4,0),t0,t1);this.towers.push({grp,top:td.h,z:td.z});});
    // cables — strung ONE BY ONE, continuous right after the rails (grow from tower)
    const cl=[];[{z:-2,h:17},{z:-34,h:14}].forEach((td)=>{const n=this.tier==='low'?5:8;for(let s=1;s<=n;s++){for(const dir of[-1,1]){const dz=td.z+dir*s*(span/(n*2+4));for(const sx of[-1,1]){cl.push({top:new THREE.Vector3(sx*(deckW/2+0.4),td.h*0.92,td.z),bot:new THREE.Vector3(sx*(deckW/2-0.3),deckY+0.5,dz)});}}}});
    const N=cl.length;
    cl.forEach((cb,i)=>{const[t0,t1]=at(0.66+(i/(N-1))*0.32,0.05);this._addCable(cb.top,cb.bot,t0,t1);});
    // beacons
    this._dotTex=makeDotTexture();
    this.beacons=this.towers.map((tw)=>{const m=new THREE.SpriteMaterial({map:this._dotTex,color:COL.accent,transparent:true,opacity:0,depthWrite:false});const s=new THREE.Sprite(m);s.position.set(0,tw.top+0.5,tw.z);s.scale.setScalar(2.4);this.bridge.add(s);return s;});
  }
  _addRamp(a,b,w,t0,t1){const dir=new THREE.Vector3().subVectors(b,a);const len=dir.length();const box=new THREE.Mesh(new THREE.BoxGeometry(w,0.6,len),this.mat.deck);if(this.tier==='high'){box.castShadow=true;box.receiveShadow=true;}box.position.copy(a).addScaledVector(dir,0.5);box.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir.clone().normalize());this._addPart(box,box.position.clone(),null,v(0,55,0),e(0,0,0),t0,t1,box.quaternion.clone());}
  _addPart(mesh,toPos,toEuler,offset,spinEuler,t0,t1,baseQuat){const toQuat=(baseQuat?baseQuat.clone():new THREE.Quaternion());if(toEuler)toQuat.multiply(new THREE.Quaternion().setFromEuler(toEuler));const fromQuat=toQuat.clone().multiply(new THREE.Quaternion().setFromEuler(spinEuler));const fromPos=toPos.clone().add(offset);mesh.position.copy(fromPos);mesh.quaternion.copy(fromQuat);mesh.visible=false;if(!mesh.parent)this.bridge.add(mesh);this.parts.push({mesh,fromPos,toPos:toPos.clone(),fromQuat,toQuat,t0,t1});}
  _addCable(top,bot,t0,t1){const dir=new THREE.Vector3().subVectors(bot,top);const len=dir.length();const g=new THREE.Group();g.position.copy(top);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());const cyl=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,len,6,1),this.mat.steelDk.clone());cyl.position.y=len/2;g.add(cyl);g.scale.y=0.001;g.visible=false;this.bridge.add(g);this.cableParts.push({g,t0,t1});}

  /* ===================== RADIAL CITY (Paris étoile) + water shores ===================== */
  _buildCity(){
    this.city=new THREE.Group();this.scene.add(this.city);
    this.roadMats=[];
    const roadMat=()=>new THREE.MeshStandardMaterial({color:0xdfe4e9,roughness:0.9,metalness:0.05,transparent:true,opacity:0});
    // radial avenues (roads)
    for(let k=0;k<RAYS;k++){const[dx,dz]=rayDir(k);const inner=[CX+dx*PLAZA,CZ+dz*PLAZA],outer=[CX+dx*ROUT,CZ+dz*ROUT];const mid=[(inner[0]+outer[0])/2,(inner[1]+outer[1])/2];const len=Math.hypot(outer[0]-inner[0],outer[1]-inner[1]);const road=new THREE.Mesh(new THREE.BoxGeometry(3.6,0.18,len),roadMat());road.position.set(mid[0],0.09,mid[1]);road.rotation.y=-Math.atan2(dz,dx)+Math.PI/2;this.city.add(road);this.roadMats.push(road.material);}
    // ring roads
    for(const r of RINGS){const ring=new THREE.Mesh(new THREE.RingGeometry(r-1.4,r+1.4,72),roadMat());ring.rotation.x=-Math.PI/2;ring.position.set(CX,0.085,CZ);this.city.add(ring);this.roadMats.push(ring.material);}
    // grand boulevard: the bridge ramp lands here and runs straight to the centre
    const link=new THREE.Mesh(new THREE.BoxGeometry(9,0.2,158),roadMat());link.position.set(0,0.11,-161);this.city.add(link);this.roadMats.push(link.material);

    // buildings in the radial sectors (Paris blocks)
    const maxCount=this.tier==='low'?360:this.tier==='mid'?780:1400;
    const raw=[];let guard=0;
    while(raw.length<maxCount && guard++<maxCount*7){
      const a=Math.random()*Math.PI*2, r=PLAZA+3+Math.random()*(ROUT-PLAZA-4);
      // avoid radial avenues
      let dA=1e9;for(let k=0;k<RAYS;k++){let d=Math.abs(a-rayAng(k));d=Math.min(d,Math.PI*2-d);dA=Math.min(dA,d);}
      if(dA*r<4.2)continue;
      // avoid ring roads
      let onRing=false;for(const rr of RINGS){if(Math.abs(r-rr)<3.2){onRing=true;break;}}if(onRing)continue;
      const x=CX+Math.cos(a)*r, z=CZ+Math.sin(a)*r;
      // keep the bridge/boulevard corridor clear
      if(Math.abs(x)<6 && z>-95)continue;
      const w=2+Math.random()*2.6, d=2+Math.random()*2.6;
      const h=3+(1-r/ROUT)*13+Math.random()*5;
      raw.push({x,z,w,d,h,rot:a,delay:clamp(r/ROUT,0,1)*0.45});
    }
    const geo=new THREE.BoxGeometry(1,1,1);const mat=new THREE.MeshStandardMaterial({color:COL.building,roughness:0.6,metalness:0.12});
    const inst=new THREE.InstancedMesh(geo,mat,raw.length);if(this.tier==='high')inst.receiveShadow=true;
    const cHi=new THREE.Color(COL.buildingHi),cLo=new THREE.Color(COL.building),cWarm=new THREE.Color(COL.buildingWarm);
    raw.forEach((b,i)=>{const rr=Math.random();inst.setColorAt(i,rr<0.25?cHi:rr<0.4?cWarm:cLo);});
    if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
    this.buildings=raw;this._buildings=inst;this._bd=new THREE.Object3D();this.city.add(inst);this._cityRevApplied=-1;
    this._buildTrees();this._buildCars();
  }
  _buildTrees(){
    const spots=[];let guard=0;const n=this.tier==='low'?140:this.tier==='mid'?300:460;
    // trees line the radial avenues
    for(let k=0;k<RAYS && spots.length<n;k++){const[dx,dz]=rayDir(k);const nx=-dz,nz=dx;for(let r=PLAZA+6;r<ROUT;r+=7){if(Math.random()<0.4)continue;for(const side of[-1,1]){spots.push([CX+dx*r+nx*2.6*side,CZ+dz*r+nz*2.6*side]);}}}
    const m=Math.min(spots.length,n);
    const fol=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.0,0),new THREE.MeshStandardMaterial({color:COL.foliage,roughness:0.92,flatShading:true}),m);
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15,0.2,1.2,5),new THREE.MeshStandardMaterial({color:COL.trunk,roughness:1}),m);
    if(this.tier==='high')fol.castShadow=true;const fc=new THREE.Color(COL.foliage),fc2=new THREE.Color(COL.foliage2);const d=new THREE.Object3D();
    for(let i=0;i<m;i++){const[x,z]=spots[i];const s=0.8+Math.random()*0.6;d.position.set(x,1.2*s+0.4,z);d.scale.setScalar(s);d.rotation.set(0,Math.random()*3,0);d.updateMatrix();fol.setMatrixAt(i,d.matrix);fol.setColorAt(i,Math.random()<0.5?fc:fc2);d.position.set(x,0.6*s,z);d.scale.set(s,s,s);d.rotation.set(0,0,0);d.updateMatrix();trunk.setMatrixAt(i,d.matrix);}
    fol.instanceMatrix.needsUpdate=true;trunk.instanceMatrix.needsUpdate=true;if(fol.instanceColor)fol.instanceColor.needsUpdate=true;
    this._treeFol=fol;this._treeTrunk=trunk;fol.visible=false;trunk.visible=false;this.city.add(fol);this.city.add(trunk);
  }
  _buildCars(){
    // cars run the bridge→centre axis and a couple of avenues
    const geo=new THREE.BoxGeometry(0.9,0.5,1.9);const cols=[0xffffff,0xe4e9ed,0x9aa5b1,0x33414f,0x0e7c82,0xb44a3a];
    const nCars=this.tier==='low'?12:this.tier==='mid'?20:28;this.cars=[];
    const axisZ0=-70, axisZ1=CZ; // along x≈0
    for(let i=0;i<nCars;i++){const lane=(i%2?1:-1)*2.2;const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:cols[(Math.random()*cols.length)|0],roughness:0.4,metalness:0.35}));if(this.tier==='high')m.castShadow=true;const z=axisZ0+Math.random()*(axisZ1-axisZ0);m.position.set(lane,0.5,z);m.visible=false;this.scene.add(m);this.cars.push({mesh:m,x:lane,dir:i%2?1:-1,speed:9+Math.random()*15,z0:axisZ0,z1:axisZ1});}
  }

  /* ===================== NETWORK — converges from the edges to the centre ===================== */
  _buildNetwork(){
    this.snet=new THREE.Group();this.scene.add(this.snet);
    // avenues + rings as GLOWING RIBBONS (wide, clearly visible) with aR per vertex
    const P=[],A=[]; const y=0.16, hwRay=1.0, hwRing=0.8;
    const pushV=(x,z,r)=>{P.push(x,y,z);A.push(r);};
    const quad=(a,b,c,d,r1,r2)=>{pushV(a[0],a[1],r1);pushV(b[0],b[1],r1);pushV(c[0],c[1],r2);pushV(c[0],c[1],r2);pushV(b[0],b[1],r1);pushV(d[0],d[1],r2);};
    for(let k=0;k<RAYS;k++){const[dx,dz]=rayDir(k);const px=-dz,pz=dx;const n=40;
      for(let i=0;i<n;i++){const ra=i/n*ROUT,rb=(i+1)/n*ROUT;const ax=CX+dx*ra,az=CZ+dz*ra,bx=CX+dx*rb,bz=CZ+dz*rb;
        quad([ax+px*hwRay,az+pz*hwRay],[ax-px*hwRay,az-pz*hwRay],[bx+px*hwRay,bz+pz*hwRay],[bx-px*hwRay,bz-pz*hwRay],ra/ROUT,rb/ROUT);}}
    for(const rad of RINGS){const rn=rad/ROUT,n=80;
      for(let i=0;i<n;i++){const a1=i/n*Math.PI*2,a2=(i+1)/n*Math.PI*2;
        quad([CX+Math.cos(a1)*(rad-hwRing),CZ+Math.sin(a1)*(rad-hwRing)],[CX+Math.cos(a1)*(rad+hwRing),CZ+Math.sin(a1)*(rad+hwRing)],
             [CX+Math.cos(a2)*(rad-hwRing),CZ+Math.sin(a2)*(rad-hwRing)],[CX+Math.cos(a2)*(rad+hwRing),CZ+Math.sin(a2)*(rad+hwRing)],rn,rn);}}
    {const[dx,dz]=rayDir(3);const px=-dz,pz=dx;const ax=0,az=-70,bx=CX+dx*ROUT,bz=CZ+dz*ROUT;
      quad([ax+px*hwRay,az+pz*hwRay],[ax-px*hwRay,az-pz*hwRay],[bx+px*hwRay,bz+pz*hwRay],[bx-px*hwRay,bz-pz*hwRay],1.13,1.0);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aR',new THREE.Float32BufferAttribute(A,1));
    this.snetMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{uFront:{value:0},uFill:{value:0},uColor:{value:new THREE.Color(0x0ea6ba)},uTip:{value:new THREE.Color(0xffffff)}},
      vertexShader:`attribute float aR; varying float vR; void main(){ vR=aR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float uFront; uniform float uFill; uniform vec3 uColor; uniform vec3 uTip; varying float vR;
        void main(){ float edge=1.0-uFront; float on=step(edge,vR); float tip=on*(1.0-smoothstep(edge,edge+0.06,vR));
        vec3 c=mix(uColor,uTip,max(tip,uFill*0.6)); float a=on*(0.85+0.15*uFill)+tip*0.7; if(a<0.02)discard; gl_FragColor=vec4(c,a);}`});
    this.snet.add(new THREE.Mesh(g,this.snetMat));

    // intersection nodes (ray × ring) — clear knots
    this._interData=[];for(let k=0;k<RAYS;k++){const[dx,dz]=rayDir(k);for(const rr of RINGS)this._interData.push({x:CX+dx*rr,z:CZ+dz*rr,rN:rr/ROUT});}
    const nodes=new THREE.InstancedMesh(new THREE.SphereGeometry(1.2,10,10),new THREE.MeshBasicMaterial({transparent:true,opacity:0}),this._interData.length);
    const d=new THREE.Object3D();this._interData.forEach((it,i)=>{d.position.set(it.x,0.5,it.z);d.updateMatrix();nodes.setMatrixAt(i,d.matrix);nodes.setColorAt(i,this._sky);});
    nodes.instanceMatrix.needsUpdate=true;if(nodes.instanceColor)nodes.instanceColor.needsUpdate=true;this.snetNodes=nodes;this.snetNodeMat=nodes.material;this.snet.add(nodes);

    // converging heads rush inward and COLLIDE at the centre
    this.heads=[];for(let k=0;k<RAYS;k++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this._dotTex,color:0xffffff,transparent:true,opacity:0,depthWrite:false}));s.scale.setScalar(4);this.snet.add(s);this.heads.push({k,sp:s});}

    // the CENTRE: a filled disc that stays lit + the flare + a shockwave
    this.centerDisc=new THREE.Mesh(new THREE.CircleGeometry(7,40),new THREE.MeshBasicMaterial({color:0x14c6d6,transparent:true,opacity:0}));this.centerDisc.rotation.x=-Math.PI/2;this.centerDisc.position.set(CX,0.2,CZ);this.snet.add(this.centerDisc);
    this.core=new THREE.Sprite(new THREE.SpriteMaterial({map:this._dotTex,color:0xffffff,transparent:true,opacity:0,depthWrite:false}));this.core.position.set(CX,0.9,CZ);this.core.scale.setScalar(4);this.snet.add(this.core);
    this.shock=new THREE.Sprite(new THREE.SpriteMaterial({map:this._dotTex,color:COL.accentBright,transparent:true,opacity:0,depthWrite:false}));this.shock.position.set(CX,0.6,CZ);this.snet.add(this.shock);
  }

  /* ===================== CAMERA ===================== */
  get _shots(){return[
    {p:0.00,pos:[34,13,52],look:[-2,4,-6]},      // build (3/4 low)
    {p:0.26,pos:[27,11,30],look:[-4,4,-20]},     // assembly
    {p:0.46,pos:[16,7,15],look:[-4,3,-24]},      // close on cables
    {p:0.58,pos:[0,5.4,58],look:[0,3,-8]},       // behind near end, over water
    {p:0.66,pos:[0,4.6,8],look:[0,3,-70]},       // crossing the bridge, forward
    {p:0.73,pos:[0,52,-120],look:[0,3,-234]},    // exit + rising toward the city
    {p:0.83,pos:[0,170,-210],look:[0,0,-241]},   // rising to top-down, étoile reads
    {p:0.91,pos:[0,235,-240],look:[0,0,-240]},   // TRUE top-down, centred on the core
    {p:1.00,pos:[0,242,-240],look:[0,0,-240]},   // hold top-down for collision → B → BRUVENT
    {p:1.12,pos:[0,248,-240],look:[0,0,-240]},   // scroll tail
  ];}
  _applyCamera(p){const shots=this._shots;let i=0;while(i<shots.length-1&&p>shots[i+1].p)i++;const a=shots[i],b=shots[Math.min(i+1,shots.length-1)];const t=smooth((p-a.p)/((b.p-a.p)||1));const L=(u,v2)=>u+(v2-u)*t;let px=L(a.pos[0],b.pos[0]),py=L(a.pos[1],b.pos[1]),pz=L(a.pos[2],b.pos[2]);let lx=L(a.look[0],b.look[0]),ly=L(a.look[1],b.look[1]),lz=L(a.look[2],b.look[2]);if(p>=0.985&&!this.reducedMotion){const s=smooth((p-0.985)/0.015);px+=Math.sin(this.time*0.3)*1.2*s;py+=Math.cos(this.time*0.24)*0.6*s;}this.camera.position.set(px,py,pz);this.camera.lookAt(lx,ly,lz);}
  enterPage(){this._pageActive=true;this.setProgress(1);}
  setPage(t){this._page=clamp(t,0,1);}
  get _pageShots(){return[
    {p:0.00,pos:[0,242,-240],look:[0,0,-240]},   // top-down centred (matches the intro end)
    {p:0.28,pos:[26,190,-165],look:[0,2,-236]},  // tilt + rise off the centre
    {p:0.62,pos:[56,120,-80],look:[-4,5,-212]},  // 3/4 overview: bridge + water + glowing étoile
    {p:1.00,pos:[74,96,-40],look:[-6,6,-205]}];}
  _applyPage(t){const shots=this._pageShots;let i=0;while(i<shots.length-1&&t>shots[i+1].p)i++;const a=shots[i],b=shots[Math.min(i+1,shots.length-1)];const k=smooth((t-a.p)/((b.p-a.p)||1));const L=(u,v2)=>u+(v2-u)*k;const bob=this.reducedMotion?0:1;this.camera.position.set(L(a.pos[0],b.pos[0])+Math.sin(this.time*0.22)*1.3*bob,L(a.pos[1],b.pos[1])+Math.cos(this.time*0.18)*0.8*bob,L(a.pos[2],b.pos[2]));this.camera.lookAt(L(a.look[0],b.look[0]),L(a.look[1],b.look[1]),L(a.look[2],b.look[2]));}

  /* ===================== STATE ===================== */
  setProgress(p){
    this.progress=clamp(p,0,1.12);const P=this.progress;
    for(const part of this.parts){const active=P>=part.t0-0.0006;part.mesh.visible=active;if(!active)continue;const lt=easeInOut((P-part.t0)/(part.t1-part.t0));part.mesh.position.lerpVectors(part.fromPos,part.toPos,lt);part.mesh.quaternion.slerpQuaternions(part.fromQuat,part.toQuat,lt);}
    for(const c of this.cableParts){const on=P>=c.t0-0.0006;c.g.visible=on;if(!on)continue;c.g.scale.y=Math.max(0.001,easeInOut((P-c.t0)/(c.t1-c.t0)));}
    const roadRev=win(P,0.46,0.60);for(const m of this.roadMats)m.opacity=roadRev*0.95;
    this._cityReveal=win(P,0.48,0.70);this._updateCity(this._cityReveal);
    const show=this._cityReveal>0.12;if(this._treeFol){this._treeFol.visible=show;this._treeTrunk.visible=show;}
    if(this.cars){const cs=this._cityReveal>0.2;for(const c of this.cars)c.mesh.visible=cs;}
    this._netReveal=win(P,0.72,0.90);
    if(this.snetMat){this.snetMat.uniforms.uFront.value=this._netReveal;this.snetMat.uniforms.uFill.value=win(P,0.86,0.98);}
    if(this.snetNodeMat)this.snetNodeMat.opacity=smooth(this._netReveal*1.4);
    if(this.beacons)this.beacons.forEach(s=>s.material.opacity=win(P,0.5,0.62)*0.85);
    // centre: filled disc lights as the lines meet and STAYS lit (also under scroll)
    const conv=win(P,0.85,0.95);
    if(this.centerDisc)this.centerDisc.material.opacity=conv*0.9;
    // collision flare + shockwave
    const flare=win(P,0.87,0.97);if(this.core){this.core.material.opacity=Math.max(flare,win(P,0.9,1.0));this.core.scale.setScalar(5+flare*52);}
    if(this.shock){const sw=win(P,0.89,1.0);this.shock.material.opacity=sw*(1-sw)*2.6;this.shock.scale.setScalar(6+sw*190);}
    if(!this._running||this.reducedMotion)this._applyCamera(this.progress);
  }
  _updateCity(reveal){if(!this._buildings||Math.abs(this._cityRevApplied-reveal)<0.001)return;this._cityRevApplied=reveal;const d=this._bd;this.buildings.forEach((b,i)=>{const r=smooth((reveal-b.delay)*3.0);const h=Math.max(0.001,b.h*r);d.position.set(b.x,h/2,b.z);d.scale.set(b.w,h,b.d);d.rotation.set(0,b.rot,0);d.updateMatrix();this._buildings.setMatrixAt(i,d.matrix);});this._buildings.instanceMatrix.needsUpdate=true;}
  setScroll(){}
  setVisible(v){this._visible=v;}

  /* ===================== RENDER ===================== */
  _tick(){
    if(!this._running)return;const now=performance.now();const dt=Math.min(0.05,(now-this._last)/1000);this._last=now;this.time+=dt;
    if(this.cars&&this._cityReveal>0.2&&!this.reducedMotion){for(const c of this.cars){c.mesh.position.z+=c.dir*c.speed*dt;if(c.mesh.position.z>c.z0)c.mesh.position.z=c.z1;if(c.mesh.position.z<c.z1)c.mesh.position.z=c.z0;}}
    if(this._netReveal>0.01&&!this.reducedMotion){
      const front=this._netReveal, edge=1-front;
      if(this.snetNodes){for(let i=0;i<this._interData.length;i++){const on=this._interData[i].rN>=edge;this.snetNodes.setColorAt(i,on?this._bright:this._sky);}this.snetNodes.instanceColor.needsUpdate=true;}
      for(const h of this.heads){const[dx,dz]=rayDir(h.k);const r=edge*ROUT;h.sp.position.set(CX+dx*r,0.6,CZ+dz*r);h.sp.material.opacity=front<1?0.95:0.0;}
    }
    if(this._visible){if(this.reducedMotion){}else if(this._pageActive)this._applyPage(this._page);else this._applyCamera(this.progress);this.renderer.render(this.scene,this.camera);}
    this._raf=requestAnimationFrame(this._tick);
  }
  _onResize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
  dispose(){cancelAnimationFrame(this._raf);window.removeEventListener('resize',this._onResize);this.renderer.dispose();if(this.renderer.domElement.parentNode)this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);}
}
function v(x,y,z){return new THREE.Vector3(x,y,z);}
function e(x,y,z){return new THREE.Euler(x,y,z);}
