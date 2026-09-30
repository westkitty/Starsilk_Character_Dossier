(function(){
'use strict';
var root=document.getElementById('palimpsestMain');
if(!root||root.dataset.ready)return;
root.dataset.ready='1';

var KEY='starsilk-palimpsest-session-v1';
var milestones=[10,100,500,2000,4000,6000,8560];
var WALL_NODE_COUNT=40;
var state={phase:'claim',witnessed:[],nacreousChoice:null,ringResolution:100,wallProgress:0,timeIndex:0,hailReceived:false,mirrorPulled:false};
var reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var life=new AbortController();
var signal=life.signal;
var audio=null;
var pageVisible=!document.hidden;
var activePhaseVisible=true;
var timers=new Set();
var rafs=new Set();
var resizeObserver=null;
var phaseObserver=null;

function q(s){return root.querySelector(s)}
function qa(s){return Array.prototype.slice.call(root.querySelectorAll(s))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function announce(t){var x=document.getElementById('palimpsestStatus');if(x)x.textContent=t}
function later(fn,ms){var id=setTimeout(function(){timers.delete(id);fn()},ms);timers.add(id);return id}
function cancelLater(id){if(id!=null){clearTimeout(id);timers.delete(id)}}
function frame(fn){var id=requestAnimationFrame(function(ts){rafs.delete(id);fn(ts)});rafs.add(id);return id}
function cancelAllWork(){timers.forEach(clearTimeout);timers.clear();rafs.forEach(cancelAnimationFrame);rafs.clear()}
function save(){try{sessionStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function load(){
  try{
    var v=JSON.parse(sessionStorage.getItem(KEY)||'null');
    if(v&&typeof v==='object'){
      Object.assign(state,v);
      state.wallProgress=clamp(Number(state.wallProgress)||0,0,100);
      state.ringResolution=clamp(Number(state.ringResolution),0,100);
      if(!Number.isFinite(state.ringResolution))state.ringResolution=100;
      state.timeIndex=clamp(Number(state.timeIndex)||0,0,6);
      if(!Array.isArray(state.witnessed))state.witnessed=[];
      state.witnessed=state.witnessed.filter(function(id){return ['star-law','blood-ring','nacreous','siege-wall','beyond-wall','witness-record'].indexOf(id)>=0});
    }
  }catch(e){}
}
function witnessed(id){if(state.witnessed.indexOf(id)>=0)return false;state.witnessed.push(id);save();renderRail();return true}
function phaseNo(id){return({'star-law':1,'blood-ring':2,nacreous:3,'siege-wall':4,'beyond-wall':5,'witness-record':6})[id]||0}
function currentPhaseElement(){return document.getElementById('phase-'+state.phase)}
function canVisit(id){return id===state.phase||state.witnessed.indexOf(id)>=0}

function setPhaseTheme(id){
  document.body.setAttribute('data-palimpsest-phase',id);
  root.setAttribute('data-current-phase',id);
}

function renderRail(){
  var rail=document.getElementById('witnessRail');
  if(!rail)return;
  rail.hidden=state.phase==='claim';
  var n=phaseNo(state.phase);
  document.getElementById('railPhase').textContent=(n?String(n).padStart(2,'0'):'--')+' / 06';
  qa('#railMarks [data-rail]').forEach(function(button){
    var id=button.dataset.rail;
    var done=state.witnessed.indexOf(id)>=0;
    button.classList.toggle('is-witnessed',done);
    button.classList.toggle('is-current',state.phase===id);
    button.disabled=!done;
    button.setAttribute('aria-current',state.phase===id?'step':'false');
  });
}

function applyPhaseVisibility(id){
  qa('.experience-phase').forEach(function(el){el.hidden=el.dataset.phase!==id});
  var intro=document.getElementById('phase-claim');
  if(intro)intro.hidden=id!=='claim';
  setPhaseTheme(id);
}

function orientPhase(id,focus){
  var el=document.getElementById('phase-'+id);
  if(!el||focus===false)return;
  el.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
  var h=el.querySelector('h1,h2');
  if(h){h.tabIndex=-1;h.focus({preventScroll:true})}
}
function show(id,focus){
  if(!document.getElementById('phase-'+id))return;
  var previous=state.phase,mutate=function(){applyPhaseVisibility(id)},transition=null;
  if(!reduced&&document.startViewTransition&&previous!==id){
    try{transition=document.startViewTransition(mutate)}catch(e){mutate()}
  }else mutate();
  state.phase=id;
  save();
  if(id==='siege-wall'&&!document.getElementById('wallField').children.length)wall();
  renderRail();
  score(id);
  if(transition&&transition.updateCallbackDone){
    transition.updateCallbackDone.then(function(){orientPhase(id,focus)}).catch(function(){applyPhaseVisibility(id);orientPhase(id,focus)});
  }else orientPhase(id,focus);
}

// ---------------------------------------------------------------------
// Native Web Audio: three independent score voices, filtered noise bed,
// transient FX, and deliberate ducking. Nothing loads remotely.
// ---------------------------------------------------------------------
function createNoiseBuffer(ctx){
  var length=Math.max(1,Math.floor(ctx.sampleRate*1.5));
  var buffer=ctx.createBuffer(1,length,ctx.sampleRate);
  var data=buffer.getChannelData(0);
  var seed=173;
  for(var i=0;i<length;i++){
    seed=(seed*16807)%2147483647;
    data[i]=((seed/2147483647)*2-1)*0.32;
  }
  return buffer;
}
function buildAudio(){
  var C=window.AudioContext||window.webkitAudioContext;
  if(!C)return null;
  var ctx=new C();
  var master=ctx.createGain(),scoreGain=ctx.createGain(),fxGain=ctx.createGain();
  var comp=ctx.createDynamicsCompressor();
  master.gain.value=.085;
  scoreGain.gain.value=.45;
  fxGain.gain.value=.8;
  scoreGain.connect(master);fxGain.connect(master);master.connect(comp);comp.connect(ctx.destination);
  var freqs=[55,82.41,123.47];
  var voices=freqs.map(function(f,i){
    var o=ctx.createOscillator(),filter=ctx.createBiquadFilter(),g=ctx.createGain(),pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
    o.type=i===0?'sine':(i===1?'triangle':'sawtooth');
    o.frequency.value=f;
    filter.type='lowpass';filter.frequency.value=480+(i*260);filter.Q.value=.7;
    g.gain.value=.02;
    o.connect(filter);filter.connect(g);
    if(pan){g.connect(pan);pan.connect(scoreGain);pan.pan.value=(i-1)*.18}else g.connect(scoreGain);
    o.start();
    return{o:o,filter:filter,g:g,pan:pan};
  });
  var noise=ctx.createBufferSource(),noiseFilter=ctx.createBiquadFilter(),noiseGain=ctx.createGain();
  noise.buffer=createNoiseBuffer(ctx);noise.loop=true;noiseFilter.type='lowpass';noiseFilter.frequency.value=240;noiseGain.gain.value=.007;
  noise.connect(noiseFilter);noiseFilter.connect(noiseGain);noiseGain.connect(scoreGain);noise.start();
  return{ctx:ctx,master:master,scoreGain:scoreGain,fxGain:fxGain,voices:voices,noise:noise,noiseFilter:noiseFilter,noiseGain:noiseGain};
}
function score(phase){
  if(!audio)return;
  var map={
    claim:{f:[55,82.41,123.47],g:[.045,.018,.006],cut:380,noise:.003},
    'star-law':{f:[55,110,164.81],g:[.07,.026,.008],cut:720,noise:.006},
    'blood-ring':{f:[46.25,92.5,138.59],g:[.04,.016,.026],cut:410,noise:.012},
    nacreous:{f:[41.2,61.74,103],g:[.032,.018,.007],cut:300,noise:.008},
    'siege-wall':{f:[36.71,55,73.42],g:[.022,.008,.004],cut:210,noise:.016},
    'beyond-wall':{f:[43.65,65.41,130.81],g:[.016,.022,.009],cut:520,noise:.004},
    'witness-record':{f:[55,82.41,110],g:[.03,.015,.006],cut:330,noise:.004}
  };
  var s=map[phase]||map.claim,now=audio.ctx.currentTime;
  audio.voices.forEach(function(v,i){
    v.o.frequency.setTargetAtTime(s.f[i],now,.5);
    v.g.gain.setTargetAtTime(s.g[i],now,.25);
    v.filter.frequency.setTargetAtTime(s.cut+(i*190),now,.35);
  });
  audio.noiseFilter.frequency.setTargetAtTime(s.cut*.7,now,.4);
  audio.noiseGain.gain.setTargetAtTime(s.noise,now,.3);
  audio.scoreGain.gain.setTargetAtTime((pageVisible&&activePhaseVisible) ? .45 : 0,now,.15);
}
function fx(type,pan){
  if(!audio||!pageVisible)return;
  var ctx=audio.ctx,now=ctx.currentTime;
  var o=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createStereoPanner?ctx.createStereoPanner():null,filter=ctx.createBiquadFilter();
  var spec={tick:[220,90,.025,.11,'triangle'],threshold:[330,165,.04,.18,'sine'],collapse:[86,29,.08,.62,'sawtooth'],hail:[196,293.66,.035,.42,'sine'],mirror:[130.81,41.2,.05,.7,'triangle']}[type]||[160,80,.02,.12,'sine'];
  o.type=spec[4];o.frequency.setValueAtTime(spec[0],now);o.frequency.exponentialRampToValueAtTime(Math.max(20,spec[1]),now+spec[3]);
  filter.type='lowpass';filter.frequency.value=type==='collapse'?380:900;
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(spec[2],now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+spec[3]);
  o.connect(filter);filter.connect(g);
  if(p){g.connect(p);p.connect(audio.fxGain);p.pan.value=clamp(Number(pan)||0,-1,1)}else g.connect(audio.fxGain);
  o.start(now);o.stop(now+spec[3]+.03);
}
function duck(ms,amount){
  if(!audio)return;
  var now=audio.ctx.currentTime,target=amount==null ? .04 : amount;
  audio.scoreGain.gain.cancelScheduledValues(now);
  audio.scoreGain.gain.setTargetAtTime(target,now,.05);
  later(function(){if(audio&&pageVisible&&activePhaseVisible)audio.scoreGain.gain.setTargetAtTime(.45,audio.ctx.currentTime,.35)},ms||700);
}
function toggleSound(){
  var b=document.getElementById('soundToggle');
  if(audio){
    try{audio.ctx.close()}catch(e){}
    audio=null;b.textContent='Enable sound';b.setAttribute('aria-pressed','false');return;
  }
  audio=buildAudio();
  if(!audio){announce('Generative sound is unavailable in this browser.');return}
  score(state.phase);
  b.textContent='Disable sound';b.setAttribute('aria-pressed','true');
  announce('Generative score and interaction sounds enabled.');
}

// ---------------------------------------------------------------------
// Star law: spring-tension filament and staged irreversible collapse.
// ---------------------------------------------------------------------
var canvas=document.getElementById('starCanvas');
var ctx=canvas&&canvas.getContext('2d');
var star={x:.15,y:0,vx:0,vy:0,targetX:.15,targetY:0,drag:false,raf:0,collapsed:false,collapsing:false,collapseProgress:0,evidenceTimer:null};
function starPoint(){
  var w=canvas.width,h=canvas.height,x=w*.40,y=h*.5,r=Math.min(w,h)*.11;
  var px=x+r+star.x*w*.32,py=y+star.y*h*.22-r*.10-star.x*h*.035;
  return{x:x,y:y,r:r,px:px,py:py,w:w,h:h};
}
function drawStarStable(){
  if(!ctx)return;
  var s=starPoint(),w=s.w,h=s.h,x=s.x,y=s.y,r=s.r,stretch=clamp(Math.sqrt(star.x*star.x+star.y*star.y*.65),0,1.15);
  ctx.clearRect(0,0,w,h);
  var bg=ctx.createRadialGradient(x,y,0,x,y,w*.68);bg.addColorStop(0,'#142234');bg.addColorStop(.45,'#07101a');bg.addColorStop(1,'#010205');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.shadowColor='#e7fbff';ctx.shadowBlur=r*(.5+stretch*.24);ctx.fillStyle='#f4fdff';ctx.beginPath();ctx.arc(x,y,r*(1-stretch*.035),0,Math.PI*2);ctx.fill();ctx.restore();
  var tension=Math.pow(stretch,1.6),c1x=x+r*(.8+tension*.2),c1y=y-r*(.22+star.y*.3),c2x=s.px-w*(.09-tension*.02),c2y=s.py+h*(.05+star.y*.08);
  var gr=ctx.createLinearGradient(x,y,s.px,s.py);gr.addColorStop(0,'#d4fbff');gr.addColorStop(.3,'#55dfff');gr.addColorStop(.72,'#00aee8');gr.addColorStop(1,'rgba(0,174,232,'+(0.22+stretch*.55)+')');
  ctx.save();ctx.lineWidth=Math.max(7,w*.008)*(1+tension*.18);ctx.lineCap='round';ctx.strokeStyle=gr;ctx.shadowColor='#55dfff';ctx.shadowBlur=9+tension*22;ctx.beginPath();ctx.moveTo(x+r*.35,y);ctx.bezierCurveTo(c1x,c1y,c2x,c2y,s.px,s.py);ctx.stroke();ctx.restore();
  if(stretch>.55){ctx.strokeStyle='rgba(255,255,255,'+((stretch-.55)*.7)+')';ctx.lineWidth=Math.max(1,w*.001);ctx.beginPath();ctx.arc(x,y,r*(1.18+stretch*.16),0,Math.PI*2);ctx.stroke()}
  var status=document.getElementById('starStatus');
  if(status&&!star.collapsing&&!star.collapsed){
    status.textContent=stretch<.35?'The strand is intact.':stretch<.72?'Tension is increasing. The star is resisting extraction.':'Stellar equilibrium is destabilizing.';
  }
}
function drawStarCollapse(p){
  if(!ctx)return;
  var s=starPoint(),w=s.w,h=s.h,x=s.x,y=s.y,r=s.r;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#010205';ctx.fillRect(0,0,w,h);
  var stage=p<.24?0:p<.48?1:p<.72?2:3;
  if(stage===0){
    var t=p/.24,rr=r*(1-t*.35);ctx.save();ctx.shadowColor='#8cecff';ctx.shadowBlur=r*(.55+t*1.2);ctx.fillStyle='#effcff';ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fill();ctx.restore();
    for(var i=0;i<3;i++){ctx.strokeStyle='rgba(85,223,255,'+(0.16+t*.16)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,rr*(1.15+i*.17),0,Math.PI*2);ctx.stroke()}
  }else if(stage===1){
    var f=(p-.24)/.24,flash=Math.sin(Math.PI*f);var rg=ctx.createRadialGradient(x,y,0,x,y,r*(1.4+f*2.4));rg.addColorStop(0,'rgba(255,255,255,'+(1-flash*.1)+')');rg.addColorStop(.16,'rgba(130,235,255,'+(.9*flash)+')');rg.addColorStop(1,'rgba(85,223,255,0)');ctx.fillStyle=rg;ctx.fillRect(0,0,w,h);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,r*(.68+.18*flash),0,Math.PI*2);ctx.fill();
  }else if(stage===2){
    var d=(p-.48)/.24;var halo=ctx.createRadialGradient(x,y,r*.2,x,y,r*(2.3-d*.8));halo.addColorStop(0,'rgba(255,255,255,'+(1-d)+')');halo.addColorStop(.25,'rgba(85,223,255,'+(.55*(1-d))+')');halo.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);ctx.fillStyle='#000';ctx.beginPath();ctx.arc(x,y,r*(.28+d*.46),0,Math.PI*2);ctx.fill();
  }else{
    var v=(p-.72)/.28;ctx.fillStyle='#000';ctx.beginPath();ctx.arc(x,y,r*.70,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(150,205,225,'+(.36*(1-v*.35))+')';ctx.lineWidth=Math.max(2,w*.004);ctx.beginPath();ctx.ellipse(x,y,r*(1.25+v*.12),r*(.18+v*.03),-.12,0,Math.PI*2);ctx.stroke();
  }
}
function starSpringTick(){
  if(!canvas||star.collapsing||star.collapsed)return;
  var k=star.drag ? .28 : .12,damp=star.drag ? .72 : .78;
  star.vx=(star.vx+(star.targetX-star.x)*k)*damp;star.vy=(star.vy+(star.targetY-star.y)*k)*damp;
  star.x+=star.vx;star.y+=star.vy;drawStarStable();
  var stretch=Math.sqrt(star.x*star.x+star.y*star.y*.65);
  if(stretch>.965){startCollapse();return}
  if(star.drag||Math.abs(star.vx)+Math.abs(star.vy)+Math.abs(star.targetX-star.x)+Math.abs(star.targetY-star.y)>.004){star.raf=frame(starSpringTick)}else star.raf=0;
}
function scheduleStarSpring(){if(!star.raf&&!star.collapsing&&!star.collapsed)star.raf=frame(starSpringTick)}
function pointerToStar(e){
  var r=canvas.getBoundingClientRect();var nx=(e.clientX-r.left-r.width*.46)/(r.width*.33);var ny=(e.clientY-r.top-r.height*.50)/(r.height*.42);
  star.targetX=clamp(nx,-.08,1.05);star.targetY=clamp(ny,-.9,.9);scheduleStarSpring();
}
function revealStarConsequence(){
  star.evidenceTimer=null;document.getElementById('starEvidence').hidden=false;witnessed('star-law');announce('Star law witnessed: Starsilk extraction caused stellar collapse.');
}
function finishCollapse(){
  star.collapsing=false;star.collapsed=true;star.collapseProgress=1;drawStarCollapse(1);
  document.getElementById('extractStar').disabled=true;document.getElementById('starStatus').textContent='The star has collapsed. Restart the witness session to reset it.';document.getElementById('starSceneLabel').textContent='OBSERVED: STELLAR COLLAPSE';
  fx('collapse',-.18);duck(900,.008);score('star-law');
  if(reduced)revealStarConsequence();else star.evidenceTimer=later(revealStarConsequence,720);
}
function startCollapse(){
  if(star.collapsed||star.collapsing)return;
  star.drag=false;star.collapsing=true;star.x=1;star.y=0;document.getElementById('extractStar').disabled=true;document.getElementById('starStatus').textContent='Equilibrium failure in progress.';document.getElementById('starSceneLabel').textContent='IRREVERSIBLE EXTRACTION';
  if(reduced){finishCollapse();return}
  var start=performance.now(),duration=1420;
  function tick(now){star.collapseProgress=clamp((now-start)/duration,0,1);drawStarCollapse(star.collapseProgress);if(star.collapseProgress<1)frame(tick);else finishCollapse()}
  frame(tick);
}
function assistedExtraction(){
  if(star.collapsed||star.collapsing)return;
  if(reduced){startCollapse();return}
  var startX=star.x,start=performance.now(),duration=520;
  function tick(now){var t=clamp((now-start)/duration,0,1),ease=1-Math.pow(1-t,3);star.x=startX+(1-startX)*ease;star.y*=1-ease;drawStarStable();if(t<1)frame(tick);else startCollapse()}
  frame(tick);
}
function restoreStarFinal(){
  star.collapsed=true;star.collapsing=false;star.x=1;star.y=0;drawStarCollapse(1);document.getElementById('extractStar').disabled=true;document.getElementById('starStatus').textContent='The star has collapsed. Restart the witness session to reset it.';document.getElementById('starSceneLabel').textContent='OBSERVED: STELLAR COLLAPSE';document.getElementById('starEvidence').hidden=false;
}
function fitStar(){if(!canvas)return;var r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(640,Math.round(r.width*d));canvas.height=Math.round(Math.max(360,r.width*.53)*d);if(star.collapsed)drawStarCollapse(1);else if(star.collapsing)drawStarCollapse(star.collapseProgress);else drawStarStable()}
if(canvas){
  canvas.addEventListener('pointerdown',function(e){if(star.collapsed||star.collapsing)return;star.drag=true;canvas.setPointerCapture(e.pointerId);pointerToStar(e)},{signal:signal});
  canvas.addEventListener('pointermove',function(e){if(!star.drag||star.collapsed||star.collapsing)return;pointerToStar(e)},{signal:signal});
  function endDrag(e){if(!star.drag)return;star.drag=false;star.targetX=.15;star.targetY=0;if(canvas.hasPointerCapture&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);scheduleStarSpring()}
  canvas.addEventListener('pointerup',endDrag,{signal:signal});canvas.addEventListener('pointercancel',endDrag,{signal:signal});
  if(window.ResizeObserver){resizeObserver=new ResizeObserver(fitStar);resizeObserver.observe(canvas)}else addEventListener('resize',fitStar,{signal:signal});
  later(fitStar,0);
}

// ---------------------------------------------------------------------
// Blood Ring: continuous material exposure, explicit evidence detents.
// ---------------------------------------------------------------------
var lastRingBand=null;
function ringBand(raw){return raw<35?0:(raw<70?1:2)}
function ring(){
  var v=clamp(Number(state.ringResolution),0,100),raw=100-v,band=ringBand(raw),viz=document.getElementById('ringViz');
  state.ringResolution=v;document.getElementById('ringFilter').value=String(v);document.getElementById('filterReadout').textContent=v+'%';
  var exposure=raw/100,material=clamp((raw-20)/70,0,1);
  viz.style.setProperty('--exposure',exposure.toFixed(3));viz.style.setProperty('--integrity',(1-exposure).toFixed(3));viz.style.setProperty('--material',material.toFixed(3));viz.style.setProperty('--ring-border-alpha',(0.10+material*0.22).toFixed(3));viz.style.setProperty('--ring-shadow',(10+28*material).toFixed(1)+'px');viz.style.setProperty('--orbit-shadow',(24+25*material).toFixed(1)+'px');viz.style.setProperty('--orbit-scale-y',(0.34+exposure*0.045).toFixed(3));viz.style.setProperty('--orbit-saturate',(1-exposure*0.32).toFixed(3));viz.style.setProperty('--orbit-contrast',(1+exposure*0.38).toFixed(3));viz.style.setProperty('--orbit-opacity',(1-material*0.22).toFixed(3));viz.style.setProperty('--strata-a-y',(0.30+exposure*0.06).toFixed(3));viz.style.setProperty('--strata-a-scale',(0.91+material*0.04).toFixed(3));viz.style.setProperty('--strata-b-y',(0.39-exposure*0.03).toFixed(3));viz.style.setProperty('--strata-b-scale',(1.06+material*0.03).toFixed(3));viz.style.setProperty('--noise-opacity',(material*0.94).toFixed(3));viz.style.setProperty('--noise-contrast',(1+material*0.9).toFixed(3));viz.dataset.band=String(band);
  document.getElementById('materialLedger').classList.toggle('is-visible',raw>=45);
  document.getElementById('ringInterpretation').textContent=band===0?'At this resolution, the Ring remains legible as an orbital symbol.':band===1?'The clean geometry is resolving into rendered biosphere and population material.':'The symbol has failed. The material record is now legible.';
  document.getElementById('ringEvidence').hidden=band<2;
  if(lastRingBand!==null&&band!==lastRingBand){fx('threshold',band===2 ? .28 : 0);announce(band===2?'Blood Ring classification threshold crossed. Material record exposed.':'Blood Ring resolution crossed an evidence threshold.')}
  lastRingBand=band;
  if(band===2)witnessed('blood-ring');
}

// ---------------------------------------------------------------------
// Nacreous VI: visitor decision and historical record stay separate.
// ---------------------------------------------------------------------
var nacreousTimer=null;
function revealNacreousHistory(){nacreousTimer=null;document.getElementById('nacreousEvidence').hidden=false;witnessed('nacreous');announce('Historical record revealed: Codec authorized the firewall.')}
function nacreous(choice,restore){
  state.nacreousChoice=choice;save();
  qa('[data-nacreous-choice]').forEach(function(b){b.classList.toggle('is-selected',b.dataset.nacreousChoice===choice);b.setAttribute('aria-pressed',b.dataset.nacreousChoice===choice?'true':'false')});
  var out=document.getElementById('nacreousResult');out.hidden=false;
  out.innerHTML=choice==='authorize'?'<span class="result-kicker">Visitor decision</span><strong>YOU AUTHORIZE THE MODELED FIREWALL.</strong><p>This records only your route through the scenario. No morality score is applied.</p>':'<span class="result-kicker">Visitor decision</span><strong>YOU WITHHOLD AUTHORIZATION.</strong><p>You refuse the modeled Firewall path. The historical decision remains separate from yours.</p>';
  cancelLater(nacreousTimer);
  if(restore||reduced)revealNacreousHistory();else nacreousTimer=later(revealNacreousHistory,620);
}

// ---------------------------------------------------------------------
// Siege Wall: one authoritative input pipeline, one node = one state step.
// ---------------------------------------------------------------------
var wallHold={pending:null,timer:null,active:false,suppressClick:false,start:0};
function wallNodes(){
  var f=document.getElementById('wallField');
  if(!f.children.length){for(var i=0;i<WALL_NODE_COUNT;i++){var n=document.createElement('span');n.className='wall-node';n.setAttribute('aria-hidden','true');n.style.setProperty('--node-index',String(i));f.appendChild(n)}}
  return Array.prototype.slice.call(f.children);
}
function wallCollapsedCount(){return clamp(Math.round(WALL_NODE_COUNT*state.wallProgress/100),0,WALL_NODE_COUNT)}
var wallLanguage=[
  {count:0,text:'STAR LOST'},
  {count:6,text:'SYSTEM LOST'},
  {count:13,text:'SYSTEM REMOVED'},
  {count:20,text:'DENIED CORRIDOR'},
  {count:27,text:'CONTAINMENT RESOURCE'},
  {count:34,text:'CONTAINMENT NODE'},
  {count:40,text:'CONTAINMENT COMPLETE'}
];
function wallLanguageFor(count){var text=wallLanguage[0].text;wallLanguage.forEach(function(item){if(count>=item.count)text=item.text});return text}
function wall(){
  var nodes=wallNodes(),count=wallCollapsedCount();
  nodes.forEach(function(n,i){var should=i<count,was=n.classList.contains('is-collapsed');n.classList.toggle('is-collapsed',should);if(should&&!was){n.classList.add('just-collapsed');later(function(){n.classList.remove('just-collapsed')},360)}});
  var pct=Math.round(count/nodes.length*100),reachable=Math.round((nodes.length-count)/nodes.length*100);
  state.wallProgress=pct;document.getElementById('containmentMetric').textContent=pct+'%';document.getElementById('reachMetric').textContent=reachable+'%';document.getElementById('wallLanguage').textContent=wallLanguageFor(count);var wallField=document.getElementById('wallField'),progress=pct/100;wallField.style.setProperty('--wall-progress',String(progress));wallField.style.setProperty('--wall-border-alpha',(0.08+progress*0.15).toFixed(3));wallField.style.setProperty('--wall-band-alpha',(progress*0.035).toFixed(3));
  if(count>=nodes.length){document.getElementById('containButton').disabled=true;document.getElementById('wallEvidence').hidden=false;witnessed('siege-wall');score('siege-wall');duck(1050,.003)}
  save();
}
function advanceWallNodes(amount){
  if(state.wallProgress>=100)return;
  var before=wallCollapsedCount(),after=clamp(before+(amount||1),0,WALL_NODE_COUNT);state.wallProgress=after/WALL_NODE_COUNT*100;wall();
  if(after>before)fx('tick',((after/(WALL_NODE_COUNT-1))*2)-1);
  if(after===WALL_NODE_COUNT)announce('Siege Wall containment complete. The source record states that it worked.')
}
function stopWallHold(){
  cancelLater(wallHold.pending);cancelLater(wallHold.timer);wallHold.pending=null;wallHold.timer=null;
  if(wallHold.active)wallHold.suppressClick=true;
  wallHold.active=false;
}
function wallHoldStep(){
  if(!wallHold.active||state.wallProgress>=100){stopWallHold();return}
  advanceWallNodes(1);
  var elapsed=performance.now()-wallHold.start,delay=Math.max(70,300-Math.floor(elapsed/12));wallHold.timer=later(wallHoldStep,delay);
}
function startWallHold(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(state.wallProgress>=100)return;
  stopWallHold();wallHold.suppressClick=false;wallHold.start=performance.now();
  wallHold.pending=later(function(){wallHold.pending=null;wallHold.active=true;wallHoldStep()},280);
}
function wallTap(){if(wallHold.suppressClick){wallHold.suppressClick=false;return}advanceWallNodes(5)}

// ---------------------------------------------------------------------
// Long Silence: each source-safe milestone changes presentation, not canon.
// ---------------------------------------------------------------------
var timeNotes=[
  'Ten years. The Wall remains the dominant horizon. Palimpsest asserts no new encounter here.',
  'A century. Duration is visible; a complete history is not supplied by this route.',
  'Five centuries. The interface preserves the gap instead of inventing events to fill it.',
  'Two millennia. The Wall persists as geography. Silence is still evidence of missing record, not proof of inactivity.',
  'Four millennia. Palimpsest advances time without manufacturing a civilization summary.',
  'Six millennia. The distance from the Blood Eclipse War is now the point of the frame.',
  'Approximately 8,560 years. The source-backed post-Mother first-contact sequence becomes visible.'
];
function time(){
  state.timeIndex=clamp(Number(state.timeIndex)||0,0,6);var y=milestones[state.timeIndex];
  document.getElementById('timeSlider').value=String(state.timeIndex);document.getElementById('timeValue').textContent=y===8560?'~8,560 years':'+'+y.toLocaleString()+' years';document.getElementById('timeSignal').textContent=timeNotes[state.timeIndex];
  var field=document.getElementById('silenceField');if(field){var era=state.timeIndex/6;field.dataset.era=String(state.timeIndex);field.style.setProperty('--era',String(era));field.style.setProperty('--silence-glow-alpha',(0.03+era*0.07).toFixed(3));field.style.setProperty('--silence-line-alpha',(0.008+era*0.01).toFixed(3));field.style.setProperty('--silence-overlay-opacity',(0.22+era*0.4).toFixed(3));field.style.setProperty('--silence-drift-opacity',(0.12+era*0.3).toFixed(3));field.style.setProperty('--drift-a-scale',(0.4+era*0.6).toFixed(3));field.style.setProperty('--drift-b-scale',(0.25+era*0.75).toFixed(3));field.style.setProperty('--signal-opacity',state.timeIndex===6?'1':'0')}
  document.getElementById('contactFrame').hidden=state.timeIndex!==6;save();
  if(state.timeIndex===6)fx('threshold',.35);
}
function hail(restore){
  state.hailReceived=true;save();document.getElementById('receiveHail').disabled=true;
  var msg=document.getElementById('wordstreamMessage');msg.hidden=false;
  if(reduced||restore){msg.classList.add('is-decoded');document.getElementById('beyondEvidence').hidden=false;witnessed('beyond-wall');score('beyond-wall');return}
  msg.classList.remove('is-decoded');msg.classList.add('is-decoding');fx('hail',.32);duck(520,.09);
  later(function(){msg.classList.remove('is-decoding');msg.classList.add('is-decoded');document.getElementById('beyondEvidence').hidden=false;witnessed('beyond-wall');score('beyond-wall');announce('Concept received: YOU HARMED NEED AID?')},760);
}

// ---------------------------------------------------------------------
// Final claim: the same words return with different evidence states.
// ---------------------------------------------------------------------
var evidence={
  tiger:{label:'TIGER',state:'supported',stateLabel:'SOURCE-SUPPORTED SUBJECT',text:'Shard-God. Starsilk creator. Systematic heliocide answered mortal access to a vulnerability. The Hal’Ven collapses became the Siege Wall.'},
  saved:{label:'SAVED',state:'contested',stateLabel:'FACTUAL EFFECT / CONTESTED MEANING',text:'The Wall contained Drakken expansion. The same source record gives its cost as thousands of stars and trillions of lives.'},
  us:{label:'US',state:'unknown',stateLabel:'UNRESOLVED REFERENT',text:'UNRESOLVED REFERENT. Palimpsest will not decide who the word includes.'},
  from:{label:'FROM',state:'bounded',stateLabel:'BOUNDED CAUSAL RELATION',text:'A causal containment relation is visible in this route. The preposition does not settle the moral meaning of the act.'},
  drakken:{label:'THE DRAKKEN',state:'temporal',stateLabel:'TEMPORALLY COMPLICATED',text:'Blood Rings remain true. So does a much later post-Mother civilization whose first substantive contact begins with an offer of aid.'}
};
function applyClaimStates(){
  qa('[data-final-word]').forEach(function(b){var e=evidence[b.dataset.finalWord];if(!e)return;b.dataset.evidenceState=e.state;b.dataset.stateLabel=e.stateLabel;b.setAttribute('aria-label',b.textContent.trim()+'. '+e.stateLabel)})
}
function inspect(word){var e=evidence[word];if(!e)return;document.getElementById('claimInspector').innerHTML='<span class="evidence-label">'+e.label+' · '+e.stateLabel+'</span><h3>'+e.text+'</h3>'}
function ledger(){
  ensureMirror();
  var rows=[
    ['STAR LAW',state.witnessed.indexOf('star-law')>=0?'experienced':'unwitnessed','star-law'],
    ['BLOOD RING','unfiltered '+(100-state.ringResolution)+'%','blood-ring'],
    ['NACREOUS VI',state.nacreousChoice||'unmade','nacreous'],
    ['SIEGE WALL',state.wallProgress>=100?'completed':Math.round(state.wallProgress)+'%','siege-wall'],
    ['BEYOND WALL',state.hailReceived?'hail received':'unwitnessed','beyond-wall'],
    ['CLAIM','factually legible / morally unresolved','witness-record']
  ];
  document.getElementById('witnessLedger').innerHTML=rows.map(function(r){var review=canVisit(r[2])?'<button type="button" data-ledger-phase="'+r[2]+'">Review</button>':'';return'<div><dt>'+r[0]+'</dt><dd>'+r[1]+review+'</dd></div>'}).join('');
  applyClaimStates();
}

// ---------------------------------------------------------------------
// Starbinding mirror: recognisable single gesture -> accelerating field.
// ---------------------------------------------------------------------
var mirrorTimer=null;
function ensureMirror(){
  var f=document.getElementById('mirrorField');
  if(!f.children.length){for(var i=0;i<120;i++){var s=document.createElement('span');s.className='mirror-star';var row=Math.floor(i/20),col=i%20,delay=Math.round((col*26)+(Math.abs(row-2.5)*42));s.style.setProperty('--mirror-delay',delay+'ms');s.setAttribute('aria-hidden','true');f.appendChild(s)}}
  return f;
}
function finishMirror(){
  mirrorTimer=null;var f=ensureMirror();f.classList.remove('is-collapsing');f.classList.add('is-collapsed');document.getElementById('mirrorPull').disabled=true;document.getElementById('mirrorScale').textContent='VISUAL SAMPLE: 120 COLLAPSED · SOURCE SCALE: BILLIONS OF CONCURRENT STAR DIVES';document.getElementById('mirrorResult').textContent='The gesture scales. The source records billions of concurrent star dives collapsing billions of stars; their stellar data becomes material for the Partition.';duck(1150,.002)
}
function mirror(animate){
  var f=ensureMirror();
  if(!state.mirrorPulled){f.classList.remove('is-collapsing','is-collapsed');document.getElementById('mirrorScale').textContent='VISUAL SAMPLE: 120 STARS · SOURCE SCALE NOT YET APPLIED';return}
  if(!animate||reduced){finishMirror();return}
  f.classList.remove('is-collapsed');void f.offsetWidth;f.classList.add('is-collapsing');document.getElementById('mirrorPull').disabled=true;document.getElementById('mirrorScale').textContent='THE SAME GESTURE IS REPEATING';fx('mirror',0);mirrorTimer=later(finishMirror,1750)
}
function startMirror(){if(state.mirrorPulled)return;state.mirrorPulled=true;save();mirror(true)}

// ---------------------------------------------------------------------
// Restore, event binding, visibility lifecycle.
// ---------------------------------------------------------------------
function restore(){
  lastRingBand=null;ring();time();
  if(state.nacreousChoice)nacreous(state.nacreousChoice,true);
  if(state.hailReceived)hail(true);
  if(state.witnessed.indexOf('star-law')>=0)restoreStarFinal();
  if(state.mirrorPulled)mirror(false);
  if(state.phase==='witness-record')ledger();
  applyClaimStates();show(state.phase,false);
}

document.getElementById('beginWitness').addEventListener('click',function(){show('star-law');score('star-law')},{signal:signal});
document.getElementById('soundToggle').addEventListener('click',toggleSound,{signal:signal});
document.getElementById('extractStar').addEventListener('click',assistedExtraction,{signal:signal});
document.getElementById('ringFilter').addEventListener('input',function(e){state.ringResolution=Number(e.target.value);save();ring()},{signal:signal});
qa('[data-nacreous-choice]').forEach(function(b){b.addEventListener('click',function(){nacreous(b.dataset.nacreousChoice,false)},{signal:signal})});
var cb=document.getElementById('containButton');
cb.addEventListener('pointerdown',startWallHold,{signal:signal});
cb.addEventListener('pointerup',stopWallHold,{signal:signal});
cb.addEventListener('pointercancel',stopWallHold,{signal:signal});
cb.addEventListener('lostpointercapture',stopWallHold,{signal:signal});
cb.addEventListener('click',wallTap,{signal:signal});
document.getElementById('timeSlider').addEventListener('input',function(e){state.timeIndex=Number(e.target.value);time()},{signal:signal});
document.getElementById('continueWaiting').addEventListener('click',function(){state.timeIndex=clamp(state.timeIndex+1,0,6);time()},{signal:signal});
document.getElementById('receiveHail').addEventListener('click',function(){hail(false)},{signal:signal});
qa('.continue-action[data-next]').forEach(function(b){b.addEventListener('click',function(){if(b.dataset.next==='witness-record'){witnessed('witness-record');ledger()}show(b.dataset.next)},{signal:signal})});
qa('[data-final-word]').forEach(function(b){b.addEventListener('click',function(){inspect(b.dataset.finalWord)},{signal:signal})});
document.getElementById('mirrorPull').addEventListener('click',startMirror,{signal:signal});
document.getElementById('restartWitness').addEventListener('click',function(){try{sessionStorage.removeItem(KEY)}catch(e){};location.reload()},{signal:signal});
qa('#railMarks [data-rail]').forEach(function(b){b.addEventListener('click',function(){if(canVisit(b.dataset.rail)){if(b.dataset.rail==='witness-record')ledger();show(b.dataset.rail)}},{signal:signal})});
document.getElementById('witnessLedger').addEventListener('click',function(e){var b=e.target.closest('[data-ledger-phase]');if(b&&canVisit(b.dataset.ledgerPhase)){if(b.dataset.ledgerPhase==='witness-record')ledger();show(b.dataset.ledgerPhase)}},{signal:signal});

document.addEventListener('visibilitychange',function(){
  pageVisible=!document.hidden;
  if(audio){var now=audio.ctx.currentTime;audio.scoreGain.gain.setTargetAtTime((pageVisible&&activePhaseVisible) ? .45 : 0,now,.08)}
  if(!pageVisible){stopWallHold();star.drag=false}
},{signal:signal});
if('IntersectionObserver' in window){
  phaseObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.target===currentPhaseElement()){activePhaseVisible=entry.isIntersecting;if(audio)audio.scoreGain.gain.setTargetAtTime((pageVisible&&activePhaseVisible) ? .45 : 0,audio.ctx.currentTime,.1)}})},{threshold:.03});
  qa('.experience-phase').forEach(function(el){phaseObserver.observe(el)});
}

function teardown(){
  stopWallHold();cancelLater(nacreousTimer);cancelLater(star.evidenceTimer);cancelLater(mirrorTimer);cancelAllWork();
  if(resizeObserver)resizeObserver.disconnect();if(phaseObserver)phaseObserver.disconnect();
  life.abort();if(audio){try{audio.ctx.close()}catch(e){}audio=null}
}
addEventListener('pagehide',teardown,{once:true});

load();restore();
})();
