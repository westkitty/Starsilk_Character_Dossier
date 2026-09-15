/* Browser-local Witness Engine. Draft text never leaves this page. */
(function(){
  'use strict';
  var panel=document.getElementById('witnessEngine'), toggle=document.getElementById('witnessEngineToggle');
  var close=document.getElementById('witnessEngineClose'), draft=document.getElementById('witnessDraft');
  var fileInput=document.getElementById('witnessFile'), compileBtn=document.getElementById('witnessCompile');
  var clearBtn=document.getElementById('witnessClear'), report=document.getElementById('witnessReport');
  var trace=document.getElementById('witnessTrace'), status=document.getElementById('witnessStatus');
  var copyBtn=document.getElementById('witnessCopyPack'), downloadBtn=document.getElementById('witnessDownloadReport');
  var readerBridge=document.getElementById('readerToWitness');
  if(!panel||!toggle||!close||!draft||!fileInput||!compileBtn||!clearBtn||!report||!trace||!status||!copyBtn||!downloadBtn) return;

  var DATA=window.STARSILK_WITNESS_DATA||{records:[],locks:[],protected_literals:[]};
  var lastResult=null, lastOpener=toggle;

  function announce(message){status.textContent=message;}
  function esc(value){return String(value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
  function regex(pattern){try{pattern=String(pattern||'');if(pattern.indexOf('(?i)')===0)pattern=pattern.slice(4);return new RegExp(pattern,'i');}catch(error){return null;}}
  function literalRegex(value){return new RegExp('(^|[^A-Za-z0-9])'+String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^A-Za-z0-9])','i');}
  function wordMatch(text,value){if(!value||String(value).length<2)return false;return literalRegex(value).test(text);}
  function splitPassages(text){return text.split(/\n\s*\n+/).map(function(v){return v.trim();}).filter(Boolean).slice(0,240);}
  function recordAliases(record){var out=[record.stable_id,String(record.stable_id).replace(/-/g,' '),record.title];(record.aliases||[]).forEach(function(v){out.push(v);});return out.filter(Boolean).filter(function(v,i,a){return a.indexOf(v)===i;});}
  function matchedRecords(text){return DATA.records.filter(function(record){return recordAliases(record).some(function(alias){return wordMatch(text,alias);});});}
  function applicableLocks(records){var ids=records.map(function(r){return r.stable_id;});return DATA.locks.filter(function(lock){return lock.scope==='document'||(lock.target_stable_id&&ids.indexOf(lock.target_stable_id)!==-1);});}
  function violations(text,locks){var out=[];locks.forEach(function(lock){(lock.prohibitions||[]).forEach(function(pattern){var re=regex(pattern);if(re&&re.test(text))out.push({lock:lock,pattern:pattern});});});return out;}
  function matchedLiterals(text){return (DATA.protected_literals||[]).filter(function(value){return wordMatch(text,value);});}
  function sourceWords(value){return String(value||'').toLowerCase().replace(/[’‘]/g,"'").match(/[a-z0-9]+(?:'[a-z0-9]+)?/g)||[];}
  function sourceMatch(passage,records){var words=sourceWords(passage);if(words.length<6||!records.length)return null;var windows=[];for(var i=0;i<=words.length-6;i+=1)windows.push(words.slice(i,i+6).join(' '));for(var r=0;r<records.length;r+=1){var section=document.getElementById(records[r].stable_id);if(!section)continue;var hay=sourceWords(section.textContent).join(' ');for(var w=0;w<windows.length;w+=1){if(hay.indexOf(windows[w])!==-1)return {record:records[r],phrase:windows[w]};}}return null;}
  function makeDiagnostic(type,title,summary,evidence){return {id:type+'-'+Math.random().toString(36).slice(2),type:type,title:title,summary:summary,evidence:evidence||{}};}

  function compile(){
    var text=draft.value.trim();
    if(!text){announce('Add or import a draft before compiling.');return;}
    if(text.length>300000){announce('Draft is too large for this browser-local compiler. Keep it under 300,000 characters.');return;}
    var records=matchedRecords(text), locks=applicableLocks(records), bad=violations(text,locks), literals=matchedLiterals(text), passages=splitPassages(text), diagnostics=[];
    records.forEach(function(record){diagnostics.push(makeDiagnostic('recognized','RECOGNIZED · '+record.title,'Existing stable record matched by exact title, alias, or stable ID.',{record:record}));});
    locks.forEach(function(lock){diagnostics.push(makeDiagnostic('locked','LOCKED · '+lock.description,'An existing machine-enforced lock applies to this draft context. Missing positive text is not treated as a violation.',{lock:lock}));});
    bad.forEach(function(item){diagnostics.push(makeDiagnostic('conflict','CONFLICT · '+item.lock.description,'Draft text matched a prohibited pattern from an applicable machine-enforced lock.',{lock:item.lock,pattern:item.pattern}));});
    literals.forEach(function(value){diagnostics.push(makeDiagnostic('literal','PROTECTED LITERAL · '+value,'Exact canonical literal detected. Preserve spelling and capitalization unless canon is intentionally changed.',{literal:value}));});
    var supported=0;passages.forEach(function(passage,index){var hits=matchedRecords(passage), matched=sourceMatch(passage,hits), quoted=/[“”"']/.test(passage);if(matched){supported+=1;diagnostics.push(makeDiagnostic('supported','SUPPORTED PHRASE · Passage '+(index+1),'An exact six-word sequence from this draft also exists in the referenced source record. This supports the phrase only; it does not validate a broader interpretation.',{passage:passage,records:hits,source_match:matched}));}else{diagnostics.push(makeDiagnostic(hits.length?'source-local':'unknown',(hits.length?'SOURCE-LOCAL':'UNKNOWN')+' · Passage '+(index+1),hits.length?'This passage references existing records but no exact source phrase established the new assertion. It remains draft-local until a human changes an authoritative source.':'No stable record or machine lock evidence was matched here. That does not make the passage false or non-canon; it remains unresolved by this compiler.',{passage:passage,records:hits}));}if(quoted)diagnostics.push(makeDiagnostic('speech','ATTRIBUTED SPEECH CANDIDATE · Passage '+(index+1),'Quotation marks were detected. The compiler will not treat quoted dialogue as omniscient canon assertion.',{passage:passage,records:hits}));});
    lastResult={schema:'starsilk-witness-report/1',generated_at:new Date().toISOString(),draft_length:text.length,summary:{recognized_records:records.length,applicable_locks:locks.length,conflicts:bad.length,protected_literals:literals.length,supported_passages:supported,passages:passages.length},recognized_records:records,applicable_locks:locks,conflicts:bad.map(function(item){return {lock_id:item.lock.lock_id,description:item.lock.description,pattern:item.pattern};}),protected_literals:literals,diagnostics:diagnostics};
    render(lastResult);
    announce(bad.length?('Compile finished with '+bad.length+' explicit conflict'+(bad.length===1?'':'s')+'.'):('Compile finished. No explicit machine-lock conflict detected.'));
  }

  function render(result){
    var counts=result.summary;
    report.innerHTML='<div class="witness-counts"><span>Recognized <b>'+counts.recognized_records+'</b></span><span>Locks <b>'+counts.applicable_locks+'</b></span><span>Conflicts <b>'+counts.conflicts+'</b></span><span>Supported <b>'+counts.supported_passages+'</b></span><span>Passages <b>'+counts.passages+'</b></span></div><div class="witness-diagnostics"></div>';
    var list=report.querySelector('.witness-diagnostics');
    result.diagnostics.forEach(function(item){var button=document.createElement('button');button.type='button';button.className='witness-diagnostic witness-'+item.type;button.dataset.witnessId=item.id;button.innerHTML='<strong>'+esc(item.title)+'</strong><span>'+esc(item.summary)+'</span>';list.appendChild(button);});
    trace.innerHTML='<div class="witness-trace-empty"><span class="eyebrow">Witness trace</span><p>Select a diagnostic to inspect exactly what evidence produced it.</p></div>';
  }

  function showTrace(item){
    var html='<span class="eyebrow">Witness trace</span><h3>'+esc(item.title)+'</h3><p>'+esc(item.summary)+'</p>';
    if(item.evidence.record){var r=item.evidence.record;html+='<dl><div><dt>Stable ID</dt><dd><code>'+esc(r.stable_id)+'</code></dd></div><div><dt>Source</dt><dd><code>'+esc(r.source_ref)+'</code></dd></div></dl><p><a href="'+esc(r.canonical_url)+'">Open canonical record</a> · <a href="'+esc(r.context_packet_url)+'">Open context packet</a></p>';}
    if(item.evidence.lock){var l=item.evidence.lock;html+='<dl><div><dt>Lock ID</dt><dd><code>'+esc(l.lock_id)+'</code></dd></div><div><dt>Scope</dt><dd>'+esc(l.scope)+'</dd></div><div><dt>Authority</dt><dd><code>src/canon/invariants.json</code></dd></div></dl>';if(item.evidence.pattern)html+='<p>Matched prohibition: <code>'+esc(item.evidence.pattern)+'</code></p>';}
    if(item.evidence.literal)html+='<p>Exact literal: <code>'+esc(item.evidence.literal)+'</code></p>';if(item.evidence.source_match)html+='<dl><div><dt>Exact source phrase</dt><dd><code>'+esc(item.evidence.source_match.phrase)+'</code></dd></div><div><dt>Matched record</dt><dd><a href="'+esc(item.evidence.source_match.record.canonical_url)+'">'+esc(item.evidence.source_match.record.title)+'</a></dd></div></dl>';
    if(item.evidence.records&&item.evidence.records.length)html+='<p>Referenced records: '+item.evidence.records.map(function(r){return '<a href="'+esc(r.canonical_url)+'">'+esc(r.title)+'</a>';}).join(', ')+'</p>';
    if(item.evidence.passage)html+='<blockquote>'+esc(item.evidence.passage.slice(0,1800))+'</blockquote>';
    trace.innerHTML=html;
  }

  function contextPack(){
    if(!lastResult)return '';
    var lines=['# Starsilk Witness Context Pack','','Status: draft under review; this packet is evidence, not canon authority.','Do not invent missing lore. Absence of evidence is not a negative canon fact.','','## Draft','',draft.value.trim(),'','## Recognized records'];
    lastResult.recognized_records.forEach(function(r){lines.push('- '+r.title+' ['+r.stable_id+'] — '+r.canonical_url+' — source: '+r.source_ref+' — context: '+r.context_packet_url);});
    if(!lastResult.recognized_records.length)lines.push('- None matched.');
    lines.push('','## Applicable machine-enforced locks');lastResult.applicable_locks.forEach(function(l){lines.push('- '+l.lock_id+': '+l.description+' (scope: '+l.scope+')');});if(!lastResult.applicable_locks.length)lines.push('- None matched.');
    lines.push('','## Explicit conflicts');lastResult.conflicts.forEach(function(c){lines.push('- '+c.lock_id+': '+c.description+' — matched prohibition '+c.pattern);});if(!lastResult.conflicts.length)lines.push('- None detected.');
    lines.push('','## Handling rule','Treat SOURCE-LOCAL and UNKNOWN passages as unresolved draft material. Compile success is not permission to promote the draft to canon.');
    return lines.join('\n');
  }

  function copy(text){if(!text){announce('Compile a draft first.');return;}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){announce('Context pack copied.');}).catch(function(){announce('Clipboard copy was blocked by this browser.');});else announce('Clipboard access is unavailable in this browser.');}
  function downloadReport(){if(!lastResult){announce('Compile a draft first.');return;}var blob=new Blob([JSON.stringify(lastResult,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='starsilk-witness-report.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},0);announce('Witness report exported.');}
  function visibleOpener(){var candidate=lastOpener||toggle;if(candidate&&window.getComputedStyle(candidate).display!=='none')return candidate;return document.getElementById('readerWorkbenchToggle')||toggle;}
  function setOpen(open,focus){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open&&focus)draft.focus();if(!open&&focus)visibleOpener().focus();}

  toggle.addEventListener('click',function(){lastOpener=toggle;setOpen(panel.hidden,true);});
  close.addEventListener('click',function(){setOpen(false,true);});
  if(readerBridge)readerBridge.addEventListener('click',function(){lastOpener=document.getElementById('readerWorkbenchToggle')||toggle;var readerClose=document.getElementById('readerWorkbenchClose');if(readerClose)readerClose.click();setOpen(true,true);});
  compileBtn.addEventListener('click',compile);
  clearBtn.addEventListener('click',function(){draft.value='';fileInput.value='';lastResult=null;report.innerHTML='<p class="witness-empty">Nothing compiled yet.</p>';trace.innerHTML='<div class="witness-trace-empty"><span class="eyebrow">Witness trace</span><p>Select a diagnostic after compiling.</p></div>';announce('Draft cleared.');draft.focus();});
  copyBtn.addEventListener('click',function(){copy(contextPack());});
  downloadBtn.addEventListener('click',downloadReport);
  fileInput.addEventListener('change',function(){var file=fileInput.files&&fileInput.files[0];if(!file)return;if(file.size>300000){announce('File is too large. Keep imported drafts under 300 KB.');fileInput.value='';return;}file.text().then(function(text){draft.value=text;announce('Imported '+file.name+'. Draft remains local to this browser.');}).catch(function(){announce('This browser could not read that file.');});});
  report.addEventListener('click',function(event){var button=event.target.closest('[data-witness-id]');if(!button||!lastResult)return;var item=lastResult.diagnostics.find(function(d){return d.id===button.dataset.witnessId;});if(item)showTrace(item);});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!panel.hidden){event.preventDefault();setOpen(false,true);}if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='k'){event.preventDefault();lastOpener=window.getComputedStyle(toggle).display==='none'?(document.getElementById('readerWorkbenchToggle')||toggle):toggle;setOpen(panel.hidden,true);}});
})();
