/* Codec-first Wound Graph. Source-backed reading lens; never canon authority. */
(function(){
  'use strict';
  var LEDGER_SOURCE='src/content/sections/canon-ledger.body.html';
  var PILOT=[
    {key:'event',label:'EVENT',ids:['C038','C039','C044']},
    {key:'action',label:'ACTION',ids:['C085','C086','C087','C088','C091','C093']},
    {key:'consequence',label:'CONSEQUENCE',ids:['C048','C094']},
    {key:'belief',label:'BELIEF / IDEOLOGICAL TURN',ids:['C095']},
    {key:'contradiction',label:'CONTRADICTION / TENSION',ids:['C079','C096']},
    {key:'later',label:'LATER CANON',ids:['C097','C099','C100','C101','C108','C118','C119','C120']}
  ];
  var AUTH=['UNSET','LOCKED','PROVISIONAL','INFERRED','CONTRADICTED','DEPRECATED'];
  var TYPES=['UNSET','WORLD FACT','OBSERVATION','CHARACTER BELIEF','INSTITUTIONAL CLAIM','PROPAGANDA','INTERPRETATION','SYMBOLIC LANGUAGE'];
  var annotations=Object.create(null), activeId='C094', panel, evidence, launcher, reader;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function claim(id){
    var article=document.querySelector('#canon-ledger [data-lore-record="'+id+'"]');
    if(!article)return null;
    var group=article.closest('.lore-group'), h3=group&&group.querySelector('h3'), tag=article.querySelector('.lore-tag'), label=article.querySelector('h4'), p=article.querySelector('p'), refs=[];
    article.querySelectorAll('a.xref-link[href^="#"]').forEach(function(a){var h=a.getAttribute('href')||'';if(h.length>1)refs.push(h.slice(1));});
    return {claim_id:id,order:Number(id.slice(1))||0,domain:h3?h3.textContent.replace(/\s+/g,' ').trim():'',tag:tag?tag.textContent.replace(/\s+/g,' ').trim():'',label:label?label.textContent.replace(/\s+/g,' ').trim():id,statement:p?p.textContent.replace(/\s+/g,' ').trim():'',source_ref:LEDGER_SOURCE,source_locator:'data-lore-record="'+id+'"',authority:'authored-source',evidence_class:'authored-lore-record',entity_stable_ids:Array.from(new Set(refs))};
  }
  function pilotClaims(){var out=[];PILOT.forEach(function(l){l.ids.forEach(function(id){var c=claim(id);if(c)out.push(c);});});return out;}
  function analysisFor(id){return annotations[id]||(annotations[id]={authority:'UNSET',type:'UNSET',era_from:'',era_to:''});}
  function addCss(){if(document.querySelector('link[data-wound-graph-style]'))return;var l=document.createElement('link');l.rel='stylesheet';l.href='wound-graph.css';l.dataset.woundGraphStyle='true';document.head.appendChild(l);}
  function options(values,current){return values.map(function(v){return '<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>';}).join('');}
  function buildPanel(){
    if(document.getElementById('woundGraph'))return document.getElementById('woundGraph');
    var a=document.createElement('aside');a.id='woundGraph';a.className='wound-graph';a.hidden=true;a.setAttribute('aria-labelledby','woundGraphHeading');a.innerHTML=''
      +'<header class="wound-head"><div><span class="eyebrow">Codec / analysis lens 01</span><h2 id="woundGraphHeading">Wound Graph</h2></div><button type="button" id="woundGraphClose">Close</button></header>'
      +'<p class="wound-boundary"><strong>Evidence network, not causal authority.</strong> Every node below is an authored Canon Loom claim. Lane placement, path order, Dual Truth selections, and ripple grouping are local analysis only. They do not create canon, prove causation, assign morality, or convert an interpretation into a world fact.</p>'
      +'<div id="woundGraphStatus" class="wound-status" role="status" aria-live="polite"></div>'
      +'<div class="wound-layout"><section class="wound-graph-pane"><div class="wound-pane-head"><div><span class="eyebrow">01 / Evidence path</span><h3>Codec wound map</h3></div><p>Scroll the six analytical lanes. Select any claim for exact evidence and downstream review.</p></div><div id="woundLanes" class="wound-lanes"></div></section>'
      +'<section class="wound-side"><div id="woundDualTruth" class="wound-card"></div><div id="woundRipple" class="wound-card"></div></section></div>'
      +'<aside id="woundEvidence" class="wound-evidence" aria-labelledby="woundEvidenceHeading" hidden><header><div><span class="eyebrow">Evidence mode</span><h3 id="woundEvidenceHeading">Source drawer</h3></div><button type="button" id="woundEvidenceClose">Close evidence</button></header><div id="woundEvidenceBody"></div></aside>';
    document.body.appendChild(a);return a;
  }
  function ensureLauncher(){
    reader=document.getElementById('readerWorkbench');var actions=document.querySelector('.reader-workbench-head-actions');
    if(!actions)return null;
    launcher=document.getElementById('readerToWoundGraph');
    if(!launcher){launcher=document.createElement('button');launcher.type='button';launcher.id='readerToWoundGraph';launcher.textContent='Wound Graph';var close=document.getElementById('readerWorkbenchClose');actions.insertBefore(launcher,close||null);}
    return launcher;
  }
  function renderLanes(){
    var root=document.getElementById('woundLanes');if(!root)return;root.innerHTML='';
    PILOT.forEach(function(lane,index){var s=document.createElement('section');s.className='wound-lane';s.dataset.lane=lane.key;s.innerHTML='<header><span class="wound-lane-index">0'+(index+1)+'</span><h4>'+esc(lane.label)+'</h4><small>EDITORIAL LANE</small></header><div class="wound-node-list"></div>';var list=s.querySelector('.wound-node-list');lane.ids.forEach(function(id){var c=claim(id);if(!c)return;var b=document.createElement('button');b.type='button';b.className='wound-node'+(id===activeId?' is-active':'');b.dataset.claimId=id;b.setAttribute('aria-pressed',String(id===activeId));b.innerHTML='<span class="wound-node-id">'+id+'</span><strong>'+esc(c.label)+'</strong><span>'+esc(c.tag)+'</span>';list.appendChild(b);});root.appendChild(s);});
  }
  function renderDual(){
    var c=claim(activeId), root=document.getElementById('woundDualTruth');if(!c||!root)return;var a=analysisFor(activeId);
    root.innerHTML='<span class="eyebrow">02 / Dual Truth</span><h3>'+esc(c.claim_id)+' · '+esc(c.label)+'</h3><blockquote>'+esc(c.statement)+'</blockquote><p class="wound-local-flag">LOCAL ANALYSIS · ZERO CANON AUTHORITY</p>'
      +'<label><span>Authority reading</span><select id="woundAuthority">'+options(AUTH,a.authority)+'</select></label>'
      +'<label><span>Statement type</span><select id="woundStatementType">'+options(TYPES,a.type)+'</select></label>'
      +'<div class="wound-era"><label><span>Era from</span><input id="woundEraFrom" value="'+esc(a.era_from)+'" placeholder="optional / local" autocomplete="off"></label><label><span>Era to</span><input id="woundEraTo" value="'+esc(a.era_to)+'" placeholder="optional / local" autocomplete="off"></label></div>'
      +'<p class="wound-help">UNSET is deliberate. The Canon Ledger does not structurally author these classifications per claim, so this panel never invents them for you.</p><button type="button" id="woundOpenEvidence">Open Evidence Mode</button>';
    root.querySelector('#woundAuthority').addEventListener('change',function(e){a.authority=e.target.value;announce('Local Dual Truth reading updated. Canon unchanged.');});
    root.querySelector('#woundStatementType').addEventListener('change',function(e){a.type=e.target.value;announce('Local statement-type reading updated. Canon unchanged.');});
    root.querySelector('#woundEraFrom').addEventListener('input',function(e){a.era_from=e.target.value.slice(0,80);});
    root.querySelector('#woundEraTo').addEventListener('input',function(e){a.era_to=e.target.value.slice(0,80);});
    root.querySelector('#woundOpenEvidence').addEventListener('click',openEvidence);
  }
  function observedTouches(c){var ids=new Set(['codec'].concat(c.entity_stable_ids||[])),out=[];document.querySelectorAll('a.xref-link[data-xref-source][data-xref-target]').forEach(function(a){var s=a.dataset.xrefSource,t=a.dataset.xrefTarget;if(ids.has(s)||ids.has(t))out.push({source:s,target:t,id:a.id||'',kind:'mentions'});});var seen=new Set();return out.filter(function(x){var k=x.source+'>'+x.target+'|'+x.id;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,8);}
  function renderRipple(){
    var c=claim(activeId), root=document.getElementById('woundRipple');if(!c||!root)return;var all=pilotClaims().sort(function(a,b){return a.order-b.order;}), later=all.filter(function(x){return x.order>c.order;}).slice(0,8), touches=observedTouches(c);
    var html='<span class="eyebrow">03 / Canon ripple</span><h3>Downstream review queue</h3><p class="wound-help"><strong>Not proof of causation.</strong> This is a review neighborhood: later-authored pilot claims plus observed xref touchpoints. Canon Ledger order is evidence order, not guaranteed chronology.</p>';
    html+='<h4>Later-authored Codec-path evidence</h4><ul class="wound-ripple-list">'+(later.length?later.map(function(x){return '<li><button type="button" data-ripple-id="'+x.claim_id+'"><code>'+x.claim_id+'</code> '+esc(x.label)+'</button><span>evidence-order touchpoint</span></li>';}).join(''):'<li class="wound-empty">No later pilot claims in this bounded lens.</li>')+'</ul>';
    html+='<h4>Observed xref touchpoints</h4><ul class="wound-ripple-list">'+(touches.length?touches.map(function(x){return '<li><code>'+esc(x.source)+' → '+esc(x.target)+'</code><span>mentions · observed-xref'+(x.id?' · #'+esc(x.id):'')+'</span></li>';}).join(''):'<li class="wound-empty">No rendered observed-xref touchpoints for this bounded evidence set.</li>')+'</ul>';
    root.innerHTML=html;root.querySelectorAll('[data-ripple-id]').forEach(function(b){b.addEventListener('click',function(){select(b.dataset.rippleId);});});
  }
  function renderEvidence(){
    var c=claim(activeId), body=document.getElementById('woundEvidenceBody');if(!c||!body)return;var refs=(c.entity_stable_ids||[]);
    body.innerHTML='<dl><div><dt>Claim</dt><dd><code>'+c.claim_id+'</code></dd></div><div><dt>Domain</dt><dd>'+esc(c.domain)+'</dd></div><div><dt>Tag</dt><dd>'+esc(c.tag)+'</dd></div><div><dt>Label</dt><dd>'+esc(c.label)+'</dd></div><div><dt>Authored proposition</dt><dd class="wound-evidence-statement">'+esc(c.statement)+'</dd></div><div><dt>Source</dt><dd><code>'+esc(c.source_ref)+'</code></dd></div><div><dt>Locator</dt><dd><code>'+esc(c.source_locator)+'</code></dd></div><div><dt>Authority</dt><dd><code>'+c.authority+'</code></dd></div><div><dt>Evidence class</dt><dd><code>'+c.evidence_class+'</code></dd></div><div><dt>Explicit xref IDs</dt><dd>'+(refs.length?refs.map(function(v){return '<code>'+esc(v)+'</code>';}).join(' '):'None in this claim')+'</dd></div></dl><p class="wound-help">Evidence Mode exposes what the authored source says and where it says it. It does not upgrade the selected Dual Truth reading into canon.</p>';
  }
  function openEvidence(){evidence.hidden=false;renderEvidence();document.getElementById('woundEvidenceClose').focus();}
  function closeEvidence(){evidence.hidden=true;var b=document.getElementById('woundOpenEvidence');if(b)b.focus();}
  function announce(msg){var s=document.getElementById('woundGraphStatus');if(s)s.textContent=msg;}
  function select(id){if(!claim(id))return;activeId=id;renderLanes();renderDual();renderRipple();if(!evidence.hidden)renderEvidence();announce('Selected '+id+'. Exact authored evidence loaded.');}
  function openGraph(){if(!panel)return;reader=document.getElementById('readerWorkbench');if(reader)reader.hidden=true;panel.hidden=false;renderLanes();renderDual();renderRipple();var n=panel.querySelector('.wound-node.is-active')||panel.querySelector('.wound-node');if(n)n.focus();announce('Codec Wound Graph opened. Analysis remains local and non-canonical.');}
  function closeGraph(){if(!panel)return;panel.hidden=true;evidence.hidden=true;if(reader){reader.hidden=false;var rt=document.getElementById('readerWorkbenchToggle');if(rt)rt.setAttribute('aria-expanded','true');}if(launcher)launcher.focus();}
  function init(){
    if(!document.getElementById('canon-ledger'))return;addCss();panel=buildPanel();evidence=document.getElementById('woundEvidence');launcher=ensureLauncher();if(!launcher)return;
    launcher.addEventListener('click',openGraph);document.getElementById('woundGraphClose').addEventListener('click',closeGraph);document.getElementById('woundEvidenceClose').addEventListener('click',closeEvidence);
    document.getElementById('woundLanes').addEventListener('click',function(e){var b=e.target.closest('[data-claim-id]');if(b)select(b.dataset.claimId);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&evidence&&!evidence.hidden){e.preventDefault();closeEvidence();return;}if(e.key==='Escape'&&panel&&!panel.hidden){e.preventDefault();closeGraph();return;}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='g'){e.preventDefault();if(panel.hidden)openGraph();else closeGraph();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
