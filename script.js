/* /custom-map/script.js */
const els = {
  viewport: document.getElementById('viewport'),
  dynmap: document.getElementById('dynmap'),
  overlay: document.getElementById('overlay'),
  gridCanvas: document.getElementById('grid'),
  chunkCanvas: document.getElementById('chunkgrid'),
  shield: document.getElementById('shield'),

  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  zoomInfo: document.getElementById('zoomInfo'),
  btnSave: document.getElementById('btnSave'),

  side: document.getElementById('side'),
  btnMenu: document.getElementById('btnMenu'),
  openSide: document.getElementById('openSide'),
  closeSide: document.getElementById('closeSide'),
  tabs: document.querySelectorAll('.tabs > button'),

  objList: document.getElementById('objList'),

  p_name: document.getElementById('p_name'),
  p_stroke: document.getElementById('p_stroke'),
  p_fill: document.getElementById('p_fill'),
  p_width: document.getElementById('p_width'),
  p_op: document.getElementById('p_op'),
  p_rot: document.getElementById('p_rot'),
  p_lock: document.getElementById('p_lock'),
  p_hide: document.getElementById('p_hide'),
  toFront: document.getElementById('toFront'),
  toBack: document.getElementById('toBack'),

  modeEdit: document.getElementById('modeEdit'),
  modeMap: document.getElementById('modeMap'),
  toolSeg: document.getElementById('toolSeg'),
  undo: document.getElementById('undoBtn'),
  redo: document.getElementById('redoBtn'),
  exportPng: document.getElementById('exportPng'),
  clearAll: document.getElementById('clearAll'),

  gridToggle: document.getElementById('gridToggle'),
  gridSize: document.getElementById('gridSize'),
  chunkToggle: document.getElementById('chunkToggle'),

  calBlocks: document.getElementById('calBlocks'),
  doCal: document.getElementById('doCal'),
};

const ctxGrid = els.gridCanvas.getContext('2d');
const ctxChunk = els.chunkCanvas.getContext('2d');

let editMode = false;
let tool = 'select';
let shapes = [];
let sel = null;
let drawing = null;
let undoStack = [], redoStack = [];

let currentZoom = 2;
let baseZoom    = 2;
let baseBPP     = 1.0;
const zoomStepFactor = 2;

function uid(){ return 's'+Math.random().toString(36).slice(2,9); }
function snapshot(){ return JSON.parse(JSON.stringify(shapes)); }
function pushUndo(){ undoStack.push(snapshot()); if (undoStack.length>200) undoStack.shift(); redoStack.length=0; }
function replaceZoomInUrl(u, z){ return String(u).replace(/;(?:\d+)(?=$|[^\d])/,(m)=>';'+z+(m.endsWith(';')?';':'')); }
function parseZoomFromUrl(u){ const m = String(u).match(/;(\d+)(?:$|[^\d])/); return m ? parseInt(m[1],10) : null; }
function currentBPP(){ const dz=currentZoom-baseZoom; return baseBPP*Math.pow(zoomStepFactor, dz); }
function updateZoomInfo(){ els.zoomInfo.textContent = `Zoom: ${currentZoom} • Maßstab: ${currentBPP().toFixed(4)} Blöcke/px`; }
function toHex(c){ if (!c) return '#dc3545'; if (c.startsWith('#')) return c; const m=c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i); if(!m) return '#dc3545'; const [r,g,b]=[m[1],m[2],m[3]].map(v=>('0'+parseInt(v).toString(16)).slice(-2)); return '#'+r+g+b; }
function rgbaWithOpacity(color, op){
  if (color?.startsWith('#')){ let r,g,b;
    if (color.length===7){ r=parseInt(color.slice(1,3),16); g=parseInt(color.slice(3,5),16); b=parseInt(color.slice(5,7),16); }
    else { r=parseInt(color[1]+color[1],16); g=parseInt(color[2]+color[2],16); b=parseInt(color[3]+color[3],16); }
    return `rgba(${r},${g},${b},${op??0.15})`;
  }
  return color||'rgba(220,53,69,0.15)';
}
function snapIf(v){ const g=Math.max(1, Number(els.gridSize.value)||8); return (els.gridToggle.checked) ? Math.round(v/g)*g : v; }

(async function boot(){
  try{
    const r = await fetch(API.load); const data = await r.json();
    currentZoom = Number(data.zoom ?? 2) || 2;
    baseZoom    = Number(data.baseZoom ?? currentZoom) || currentZoom;
    baseBPP     = Number(data.baseBPP ?? 1) || 1;
    shapes      = Array.isArray(data.shapes) ? data.shapes : [];
  }catch(e){}

  updateZoomInfo();
  bindUI();
  resizeCanvases();
  setMode(false);
  renderAll();

  window.addEventListener('beforeunload', autoSave);
})();

function bindUI(){
  els.tabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      els.tabs.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab').forEach(t=>t.classList.add('hide'));
      document.getElementById('tab-'+btn.dataset.tab)?.classList.remove('hide');
    });
  });

  els.btnMenu.onclick = ()=>els.side.classList.toggle('open');
  els.openSide.onclick= ()=>els.side.classList.add('open');
  els.closeSide.onclick=()=>els.side.classList.remove('open');

  els.modeEdit.onclick=()=>setMode(true);
  els.modeMap.onclick =()=>setMode(false);

  els.toolSeg.addEventListener('click', e=>{
    const b = e.target.closest('button'); if (!b) return;
    [...els.toolSeg.children].forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); tool = b.dataset.tool; els.overlay.style.cursor = (tool==='select')?'default':'crosshair';
  });

  els.zoomIn.onclick  = ()=>setZoom(currentZoom+1);
  els.zoomOut.onclick = ()=>setZoom(currentZoom-1);

  window.addEventListener('resize', resizeCanvases);
  [els.gridToggle, els.gridSize].forEach(el=>el.addEventListener('input', drawGrid));
  els.chunkToggle.addEventListener('input', drawChunk);

  els.undo.onclick=()=>{ if (!undoStack.length) return; redoStack.push(snapshot()); shapes = undoStack.pop(); renderAll(); };
  els.redo.onclick=()=>{ if (!redoStack.length) return; undoStack.push(snapshot()); shapes = redoStack.pop(); renderAll(); };
  document.addEventListener('keydown', (e)=>{
    if (e.ctrlKey && e.key.toLowerCase()==='z'){ e.preventDefault(); els.undo.click(); }
    if (e.ctrlKey && e.key.toLowerCase()==='y'){ e.preventDefault(); els.redo.click(); }
    if (e.key==='Delete' && sel){ pushUndo(); shapes = shapes.filter(x=>x.id!==sel); sel=null; renderAll(); }
  });

  els.overlay.addEventListener('pointerdown', onCanvasPointerDown);

  hookProps();

  els.exportPng.onclick = exportPNG;
  els.clearAll.onclick  = ()=>{ if (confirm('Alle Overlays löschen?')){ pushUndo(); shapes=[]; sel=null; renderAll(); } };
  els.btnSave.onclick   = saveNow;

  els.doCal.onclick = ()=>{
    const s = shapes.find(x=>x.id===sel && x.type==='line');
    if (!s){ alert('Bitte zuerst eine Linie auswählen.'); return; }
    const blocks = Number(els.calBlocks.value);
    if (!(blocks>0)) { alert('Ungültige Blockzahl.'); return; }
    const px = Math.max(1, s.w||1);
    baseZoom = currentZoom;
    baseBPP  = blocks / px;
    updateZoomInfo(); renderAll();
  };
}

function setZoom(z){
  z = Math.max(0, Math.min(10, z|0));
  currentZoom = z;
  els.dynmap.src = replaceZoomInUrl(els.dynmap.src || window.DYNMAP_URL, z);
  updateZoomInfo();
  renderAll();
}

function resizeCanvases(){
  els.gridCanvas.width  = els.overlay.clientWidth;  els.gridCanvas.height  = els.overlay.clientHeight;
  els.chunkCanvas.width = els.overlay.clientWidth;  els.chunkCanvas.height = els.overlay.clientHeight;
  drawGrid(); drawChunk();
}
function drawGrid(){
  const on = els.gridToggle.checked;
  els.gridCanvas.classList.toggle('on', on);
  ctxGrid.clearRect(0,0,els.gridCanvas.width,els.gridCanvas.height);
  if (!on) return;
  const g = Math.max(1, Number(els.gridSize.value)||8);
  ctxGrid.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid') || '#233048';
  ctxGrid.lineWidth = 1;
  ctxGrid.beginPath();
  for(let x=0;x<els.gridCanvas.width;x+=g){ ctxGrid.moveTo(x+.5,0); ctxGrid.lineTo(x+.5,els.gridCanvas.height); }
  for(let y=0;y<els.gridCanvas.height;y+=g){ ctxGrid.moveTo(0,y+.5); ctxGrid.lineTo(els.gridCanvas.width,y+.5); }
  ctxGrid.stroke();
}
function drawChunk(){
  const on = els.chunkToggle.checked;
  els.chunkCanvas.classList.toggle('on', on);
  ctxChunk.clearRect(0,0,els.chunkCanvas.width,els.chunkCanvas.height);
  if (!on) return;
  const g = Math.max(1, Number(els.gridSize.value)||8);
  const c = 16*g;
  ctxChunk.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--chunk') || '#2b3b57';
  ctxChunk.lineWidth = 1.5;
  ctxChunk.beginPath();
  for(let x=0;x<els.chunkCanvas.width;x+=c){ ctxChunk.moveTo(x+.5,0); ctxChunk.lineTo(x+.5,els.chunkCanvas.height); }
  for(let y=0;y<els.chunkCanvas.height;y+=c){ ctxChunk.moveTo(0,y+.5); ctxChunk.lineTo(els.chunkCanvas.width,y+.5); }
  ctxChunk.stroke();
}

function renderAll(){
  els.overlay.innerHTML='';
  shapes.sort((a,b)=>(a.z??0)-(b.z??0));
  for(const s of shapes) createEl(s);
  refreshList(); applyProps(); updateZoomInfo();
}
function createEl(s){
  const el = document.createElement('div');
  el.className = 'shape '+s.type+(s.id===sel?' sel':'')+(s.locked?' locked':'')+(s.hide?' hide':'');
  el.dataset.id = s.id;

  const sw = s.sw??3;
  el.style.left = s.x+'px'; el.style.top=s.y+'px';
  el.style.width = (s.w??0)+'px'; el.style.height = (s.h??0)+'px';
  el.style.border = s.type==='line' ? 'none' : `${sw}px solid ${s.stroke||'#dc3545'}`;
  el.style.background = s.type==='text' ? (s.fill||'rgba(0,0,0,0.65)') : rgbaWithOpacity(s.fill||'#dc3545', s.op??0.15);
  el.style.transform = `rotate(${Number(s.rot||0)}deg)`;
  el.style.zIndex = s.z??0;
  if (s.type==='circle') el.style.borderRadius='50%';
  if (s.type==='text'){ el.classList.add('text'); el.textContent = s.text ?? 'Text'; }
  if (s.type==='line'){
    const len = Math.max(1, s.w||1);
    el.style.height = (sw)+'px';
    el.style.width = len+'px';
    el.style.background = s.stroke||'#dc3545';
    el.style.transformOrigin='0 50%';
  }

  if (!s.locked && s.type!=='line'){ ['nw','ne','sw','se','rot'].forEach(h=>{ const d=document.createElement('div'); d.className='handle '+h; el.appendChild(d); }); }
  else if (!s.locked && s.type==='line'){ const d=document.createElement('div'); d.className='handle se'; el.appendChild(d); }

  el.addEventListener('pointerdown', onShapePointerDown);
  els.overlay.appendChild(el);

  if (s.type==='line'){
    const badge = document.createElement('div');
    badge.className='len-badge';
    const px = Math.max(1, s.w||1);
    const bl = currentBPP()*px;
    badge.textContent = `${px|0}px  |  ${bl.toFixed(1)} Blöcke`;
    badge.style.left = (s.x + (px/2))+'px';
    const offset = Math.sin((s.rot||0)*Math.PI/180)*12;
    badge.style.top = (s.y - 8 - offset)+'px';
    els.overlay.appendChild(badge);
  }
}

function select(id){ sel = id; renderAll(); }
function refreshList(){
  els.objList.innerHTML='';
  for (const s of shapes){
    const row = document.createElement('div'); row.className='row-inline';
    const label = document.createElement('button'); label.className='btn'; label.textContent=(s.name||s.type)+' #'+s.id.slice(-4); label.onclick=()=>select(s.id);
    const vis = document.createElement('button'); vis.className='btn'; vis.textContent=s.hide?'Einbl.':'Ausbl.'; vis.onclick=()=>{ pushUndo(); s.hide=!s.hide; renderAll(); };
    const lock= document.createElement('button'); lock.className='btn'; lock.textContent=s.locked?'Unlock':'Lock'; lock.onclick=()=>{ pushUndo(); s.locked=!s.locked; renderAll(); };
    row.append(label,vis,lock); els.objList.appendChild(row);
  }
}
function applyProps(){
  const s = shapes.find(x=>x.id===sel);
  const disabled = !s;
  [els.p_name,els.p_stroke,els.p_fill,els.p_width,els.p_op,els.p_rot,els.p_lock,els.p_hide,els.toFront,els.toBack].forEach(el=>el.disabled=disabled);
  if (!s) return;
  els.p_name.value = s.name||'';
  els.p_stroke.value = toHex(s.stroke||'#dc3545');
  els.p_fill.value   = toHex(s.fill||'#dc3545');
  els.p_width.value  = s.sw??3;
  els.p_op.value     = s.op??0.15;
  els.p_rot.value    = s.rot??0;
  els.p_lock.checked = !!s.locked;
  els.p_hide.checked = !!s.hide;
}
function updateSelected(cb){ const s=shapes.find(x=>x.id===sel); if(!s) return; pushUndo(); cb(s); renderAll(); }
function hookProps(){
  els.p_name.addEventListener('input', e=>updateSelected(s=>s.name=e.target.value));
  els.p_stroke.addEventListener('input', e=>updateSelected(s=>s.stroke=e.target.value));
  els.p_fill.addEventListener('input', e=>updateSelected(s=>s.fill=e.target.value));
  els.p_width.addEventListener('input', e=>updateSelected(s=>s.sw=Number(e.target.value)||0));
  els.p_op.addEventListener('input', e=>updateSelected(s=>s.op=Number(e.target.value)));
  els.p_rot.addEventListener('input', e=>updateSelected(s=>s.rot=Number(e.target.value)||0));
  els.p_lock.addEventListener('input', e=>updateSelected(s=>s.locked=!!e.target.checked));
  els.p_hide.addEventListener('input', e=>updateSelected(s=>s.hide=!!e.target.checked));
  els.toFront.onclick=()=>updateSelected(s=>s.z=(s.z??0)+1);
  els.toBack.onclick =()=>updateSelected(s=>s.z=(s.z??0)-1);
}

function onCanvasPointerDown(e){
  if (!editMode) return;
  const rect = els.overlay.getBoundingClientRect();
  const ox = e.clientX - rect.left;
  const oy = e.clientY - rect.top;

  if (tool==='select'){ sel=null; renderAll(); return; }

  if (tool==='text'){
    pushUndo();
    const s = {id:uid(), type:'text', name:'', x:snapIf(ox-70), y:snapIf(oy-16), w:140, h:32, rot:0, stroke:'#ffffff', fill:'rgba(0,0,0,0.65)', op:1, sw:0, text:'Text', z:(shapes.length?Math.max(...shapes.map(a=>a.z||0))+1:1)};
    shapes.push(s); sel=s.id; renderAll();
    const el = els.overlay.querySelector(`.shape[data-id="${s.id}"]`); quickEditText(el, s);
    return;
  }

  if (tool==='measure' || tool==='line'){
    pushUndo();
    const s = {id:uid(), type:'line', name:'Linie', x:snapIf(ox), y:snapIf(oy), w:1, h:0, rot:0, stroke:'#dc3545', fill:'#0000', op:1, sw:3, z:(shapes.length?Math.max(...shapes.map(a=>a.z||0))+1:1)};
    shapes.push(s); sel=s.id; drawing={id:s.id, ox:s.x, oy:s.y};
    dragDrawLine(e, s, rect);
    return;
  }

  if (tool==='rect' || tool==='circle'){
    pushUndo();
    const s = {id:uid(), type:tool, name:'', x:snapIf(ox), y:snapIf(oy), w:10, h:10, rot:0, stroke:'#dc3545', fill:'#dc3545', op:.15, sw:3, z:(shapes.length?Math.max(...shapes.map(a=>a.z||0))+1:1)};
    shapes.push(s); sel=s.id; drawing={id:s.id, ox:s.x, oy:s.y};
    dragDrawRect(e, s, rect);
    return;
  }
}
function dragDrawRect(e, s, rect){
  function move(ev){
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    const nx = snapIf(Math.min(drawing.ox, cx)), ny = snapIf(Math.min(drawing.oy, cy));
    const nw = snapIf(Math.abs(cx - drawing.ox)), nh = snapIf(Math.abs(cy - drawing.oy));
    s.x=nx; s.y=ny; s.w=Math.max(1,nw); s.h=Math.max(1,nh);
    renderAll();
  }
  function up(){ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); drawing=null; }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}
function dragDrawLine(e, s, rect){
  function move(ev){
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    const dx = cx - drawing.ox, dy = cy - drawing.oy;
    s.x = snapIf(drawing.ox); s.y = snapIf(drawing.oy);
    s.w = Math.max(1, Math.hypot(dx,dy));
    s.rot = (Math.atan2(dy,dx)*180/Math.PI)||0;
    renderAll();
  }
  function up(){ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); drawing=null; }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}
function onShapePointerDown(e){
  if (!editMode) return;
  const el = e.currentTarget;
  const id = el.dataset.id;
  const s = shapes.find(x=>x.id===id);
  if (!s) return;

  const handle = e.target.classList.contains('handle') ? e.target : null;
  if (s.locked){ select(id); return; }
  select(id);

  const rect = els.overlay.getBoundingClientRect();
  const start = {x: e.clientX - rect.left, y: e.clientY - rect.top};
  const base = {x:s.x, y:s.y, w:s.w||0, h:s.h||0, r:s.rot||0};

  function move(ev){
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    if (handle){
      if (handle.classList.contains('rot')){
        const ang = Math.atan2((cy - s.y),(cx - s.x))*180/Math.PI;
        s.rot = Math.round(ang);
      } else {
        let nx = base.x, ny = base.y, nw = base.w, nh = base.h;
        if (handle.classList.contains('se')){ nw = cx - base.x; nh = cy - base.y; }
        if (handle.classList.contains('ne')){ nw = cx - base.x; ny = cy; nh = base.y + base.h - cy; }
        if (handle.classList.contains('sw')){ nx = cx; nw = base.x + base.w - cx; nh = cy - base.y; }
        if (handle.classList.contains('nw')){ nx = cx; ny = cy; nw = base.x + base.w - cx; nh = base.y + base.h - cy; }
        s.x = snapIf(Math.min(nx, nx+nw)===nx?nx:nx); s.y = snapIf(Math.min(ny, ny+nh)===ny?ny:ny);
        s.w = Math.max(1, snapIf(Math.abs(nw))); s.h = Math.max(1, snapIf(Math.abs(nh)));
      }
    } else {
      const dx = snapIf(cx - start.x), dy = snapIf(cy - start.y);
      s.x = base.x + dx; s.y = base.y + dy;
    }
    renderAll();
  }
  function up(){ window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }
  pushUndo();
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  e.preventDefault();
}
function quickEditText(el, s){
  const input = document.createElement('textarea');
  input.value = s.text||'';
  Object.assign(input.style, {position:'absolute', left:'0', top:'0', width:'100%', height:'100%', background:'#0000', color:'inherit', font:'inherit', border:'none', outline:'none', resize:'none'});
  el.appendChild(input); input.focus();
  input.addEventListener('blur', ()=>{ pushUndo(); s.text=input.value; renderAll(); });
}

function exportPNG(){
  const w = els.overlay.clientWidth, h = els.overlay.clientHeight;
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const cx = c.getContext('2d'); cx.clearRect(0,0,w,h);
  const list = [...shapes].sort((a,b)=>(a.z??0)-(b.z??0)).filter(s=>!s.hide);
  for (const s of list){
    cx.save(); cx.translate(s.x, s.y); cx.rotate((s.rot||0)*Math.PI/180);
    const sw = s.sw??3; cx.lineWidth = sw; cx.strokeStyle = s.stroke||'#dc3545';
    let fill = s.fill||'#dc3545', op=s.op??0.15;
    if (fill.startsWith('#')){ const r=parseInt(fill.slice(1,3),16), g=parseInt(fill.slice(3,5),16), b=parseInt(fill.slice(5,7),16); cx.fillStyle=`rgba(${r},${g},${b},${op})`; }
    else cx.fillStyle=fill;
    if (s.type==='rect' || s.type==='circle'){
      if (s.type==='circle'){ const rx=(s.w||0)/2, ry=(s.h||0)/2; cx.beginPath(); cx.ellipse(rx, ry, Math.max(1,rx), Math.max(1,ry), 0, 0, Math.PI*2); cx.fill(); cx.stroke(); }
      else { cx.beginPath(); cx.rect(0,0, Math.max(1,s.w||0), Math.max(1,s.h||0)); cx.fill(); cx.stroke(); }
    } else if (s.type==='line'){ cx.beginPath(); cx.moveTo(0,0); cx.lineTo(Math.max(1,s.w||1), 0); cx.stroke(); }
    else if (s.type==='text'){ cx.fillStyle = s.fill||'rgba(0,0,0,0.65)'; cx.fillRect(0,0, Math.max(64,s.w||140), Math.max(32,s.h||32)); cx.fillStyle='#fff'; cx.font='18px system-ui, Arial'; cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText(s.text||'Text', Math.max(64,(s.w||140))/2, Math.max(32,(s.h||32))/2); }
    cx.restore();
  }
  c.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='overlay.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 800); }, 'image/png', .92);
}

async function saveNow(){
  try{
    const body = { zoom: currentZoom, pan:{x:0,y:0}, baseBPP, baseZoom, shapes };
    const res = await fetch(API.save, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    if (!res.ok) throw new Error('save failed');
  }catch(e){ alert('Speichern fehlgeschlagen.'); }
}
function autoSave(){ navigator.sendBeacon(API.save, new Blob([JSON.stringify({zoom:currentZoom, pan:{x:0,y:0}, baseBPP, baseZoom, shapes})], {type:'application/json'})); }

function setMode(edit){
  editMode = !!edit;
  els.modeEdit.classList.toggle('active', editMode);
  els.modeMap .classList.toggle('active', !editMode);
  els.overlay.style.cursor = editMode ? ((tool==='select') ? 'default' : 'crosshair') : 'default';
  try {
    const map     = document.querySelector('iframe.map');
    const overlay = document.getElementById('overlay');
    const shield  = document.getElementById('shield');
    if (editMode) {
      if (map)     map.style.pointerEvents     = 'none';
      if (overlay) overlay.style.pointerEvents = 'auto';
      if (shield)  shield.style.pointerEvents  = 'none';
    } else {
      if (map)     map.style.pointerEvents     = 'auto';
      if (overlay) overlay.style.pointerEvents = 'none';
      if (shield)  shield.style.pointerEvents  = 'none';
    }
  } catch(e){}
}
