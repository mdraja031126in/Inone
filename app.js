(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { clips: [], selected: -1, captions: [], keyframes: [], markers: [], sequence: {resolution:'1920x1080',fps:'30',color:'Rec.709',aspect:'16:9'}, projectName: 'My IN ONE Project', photoUrl: null, audioUrls: [], audioIndex: 0, textStyle: 'neon', textAnimation: 'fade' };
  let mediaElement = null, photoFile = null, nativeVideoUri = null;

  function go(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));
    document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    const nav = document.querySelector(`[data-page="${page}"]`);
    $('pageTitle').textContent = nav ? nav.innerText.trim() : page;
  }
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => go(b.dataset.goto)));

  const fmt = s => Number.isFinite(s) ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '00:00';
  const safeName = s => (s || 'inone-project').replace(/[^a-z0-9-_]/gi, '_').slice(0, 80);
  function updateProjectInfo() {
    $('clipCount').textContent = `${state.clips.length} clips`;
    $('projectInfo').textContent = `${state.projectName} · ${state.clips.length} clips · ${state.captions.length} captions`;
  }
  function releaseClip(c) { if (c && c.url) URL.revokeObjectURL(c.url); }
  function showEmptyPreview(message = 'Select a clip to preview.') {
    mediaElement = null;
    $('preview').innerHTML = `<div class="empty">${message}</div>`;
    $('mediaType').textContent = 'No media';
    $('timeReadout').textContent = '00:00 / 00:00';
    $('seek').value = 0;
    $('inspectorBody').textContent = 'Select a clip from the timeline.';
  }
  function renderTimeline() {
    const root = $('timeline'); root.replaceChildren();
    if (!state.clips.length) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Your imported media will appear as timeline clips.'; root.appendChild(empty);
    }
    state.clips.forEach((clip, i) => {
      const el = document.createElement('div'); el.className = `clip${i === state.selected ? ' selected' : ''}`;
      const title = document.createElement('strong'); title.textContent = clip.name;
      const meta = document.createElement('small'); meta.textContent = `${clip.kind.toUpperCase()} · ${clip.duration ? fmt(clip.duration) : 'Duration unknown'}`;
      const trackRow = document.createElement('div'); trackRow.className = 'clip-track';
      const trackSelect = document.createElement('select'); trackSelect.setAttribute('aria-label','Assign track');
      ['V1','V2','V3','V4','A1','A2','A3','A4'].forEach(t => { const o=document.createElement('option');o.value=t;o.textContent=t;o.selected=(clip.track|| (clip.kind==='audio'?'A1':'V1'))===t;trackSelect.appendChild(o); });
      trackSelect.onchange=()=>{clip.track=trackSelect.value;renderTimeline();};
      const labelDot=document.createElement('span');labelDot.className='clip-label';labelDot.style.background=({Blue:'#60a5fa',Red:'#f87171',Green:'#4ade80',Yellow:'#facc15',Purple:'#c084fc'}[clip.label||'Blue']);
      const labelSelect=document.createElement('select');labelSelect.setAttribute('aria-label','Clip color label');
      ['Blue','Red','Green','Yellow','Purple'].forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;o.selected=(clip.label||'Blue')===t;labelSelect.appendChild(o);});
      labelSelect.onchange=()=>{clip.label=labelSelect.value;renderTimeline();};
      trackRow.append(trackSelect,labelDot,labelSelect);
      const actions = document.createElement('div'); actions.className = 'clip-actions';
      [['up', '↑'], ['down', '↓'], ['delete', '✕']].forEach(([act, label]) => {
        const b = document.createElement('button'); b.className = 'btn secondary'; b.type = 'button'; b.dataset.act = act; b.textContent = label;
        b.setAttribute('aria-label', act === 'up' ? 'Move clip left' : act === 'down' ? 'Move clip right' : 'Delete clip'); actions.appendChild(b);
      });
      el.append(title, meta, trackRow, actions);
      el.addEventListener('click', e => { if (!e.target.closest('button')) selectClip(i); });
      actions.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
        if (b.dataset.act === 'delete') {
          releaseClip(state.clips[i]); state.clips.splice(i, 1);
          state.selected = state.clips.length ? Math.min(i, state.clips.length - 1) : -1;
        } else {
          const j = b.dataset.act === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= state.clips.length) return;
          [state.clips[i], state.clips[j]] = [state.clips[j], state.clips[i]];
          if (state.selected === i) state.selected = j; else if (state.selected === j) state.selected = i;
        }
        if (state.selected >= 0) selectClip(state.selected); else showEmptyPreview('Timeline is empty.');
        renderTimeline();
      });
      root.appendChild(el);
    });
    updateProjectInfo();
  }
  function syncTransport() {
    if (!mediaElement || !Number.isFinite(mediaElement.duration)) return;
    const duration = mediaElement.duration || 0;
    $('seek').value = duration ? Math.round(mediaElement.currentTime / duration * 1000) : 0;
    $('timeReadout').textContent = `${fmt(mediaElement.currentTime)} / ${fmt(duration)}`;
    $('playPause').textContent = mediaElement.paused ? '▶ Play' : 'Ⅱ Pause';
  }
  function selectClip(i) {
    const clip = state.clips[i]; if (!clip) return;
    state.selected = i; renderTimeline();
    const root = $('preview'); root.replaceChildren(); mediaElement = null;
    if (clip.relink || !clip.url) { const note = document.createElement('div'); note.className = 'empty'; note.textContent = 'Source media is not embedded in the project. Re-import this file to preview it.'; root.appendChild(note); $('mediaType').textContent = 'RELINK REQUIRED'; $('inspectorBody').textContent = `${clip.name} · Original media must be re-imported.`; return; }
    if (clip.kind === 'video' || clip.kind === 'audio') {
      const player = document.createElement(clip.kind); mediaElement = player; player.src = clip.url; player.controls = true; player.preload = 'metadata';
      if (clip.kind === 'video') { player.playsInline = true; player.className = 'preview-media'; }
      player.addEventListener('loadedmetadata', () => { clip.duration = Number.isFinite(player.duration) ? player.duration : 0; renderTimeline(); syncTransport(); });
      player.addEventListener('timeupdate', syncTransport); player.addEventListener('play', syncTransport); player.addEventListener('pause', syncTransport); player.addEventListener('ended', syncTransport);
      root.appendChild(player);
    } else {
      const img = document.createElement('img'); img.src = clip.url; img.alt = clip.name; root.appendChild(img);
    }
    $('mediaType').textContent = clip.kind.toUpperCase();
    $('inspectorBody').replaceChildren();
    const name = document.createElement('p'); const strong = document.createElement('b'); strong.textContent = clip.name; name.appendChild(strong);
    const details = document.createElement('p'); details.className = 'muted'; details.textContent = `Type: ${clip.kind} · Size: ${(clip.size / 1048576).toFixed(2)} MB · Duration: ${clip.duration ? fmt(clip.duration) : 'Not available'}`;
    const remove = document.createElement('button'); remove.className = 'btn secondary'; remove.textContent = 'Remove clip'; remove.onclick = () => {
      releaseClip(clip); state.clips.splice(i, 1); state.selected = state.clips.length ? Math.min(i, state.clips.length - 1) : -1;
      if (state.selected >= 0) selectClip(state.selected); else showEmptyPreview('Select a clip to preview.'); renderTimeline();
    };
    const speedLabel=document.createElement('label');speedLabel.textContent='Clip preview speed';
    const speedSelect=document.createElement('select');speedSelect.innerHTML='<option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option>';speedSelect.value=String(clip.speed||1);
    speedSelect.onchange=()=>{clip.speed=Number(speedSelect.value);if(mediaElement)mediaElement.playbackRate=clip.speed;};
    speedLabel.appendChild(speedSelect);
    const trackLabel=document.createElement('label');trackLabel.textContent='Track assignment';
    const trackSelect=document.createElement('select');trackSelect.innerHTML='<option>V1</option><option>V2</option><option>V3</option><option>V4</option><option>A1</option><option>A2</option><option>A3</option><option>A4</option>';trackSelect.value=clip.track|| (clip.kind==='audio'?'A1':'V1');trackSelect.onchange=()=>{clip.track=trackSelect.value;renderTimeline();};
    trackLabel.appendChild(trackSelect);
    $('inspectorBody').append(name, details, speedLabel, trackLabel, remove); syncTransport();
    if(mediaElement && clip.speed) mediaElement.playbackRate=clip.speed;
    applyClipGrade();
  }
  function addFiles(fileList) {
    [...fileList].forEach(file => {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : null;
      if (!kind) return;
      state.clips.push({ name: file.name, kind, size: file.size, type: file.type, url: URL.createObjectURL(file), duration: 0, track: kind === 'audio' ? 'A1' : 'V1', label: 'Blue', speed: 1 });
    });
    renderTimeline(); if (state.clips.length) selectClip(state.clips.length - 1);
  }
  $('mediaInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  $('clearTimeline').onclick = () => { state.clips.forEach(releaseClip); state.clips = []; state.selected = -1; showEmptyPreview('Timeline cleared.'); renderTimeline(); };
  $('playPause').onclick = () => { if (!mediaElement) return; if (mediaElement.paused) mediaElement.play().catch(() => {}); else mediaElement.pause(); };
  $('seek').oninput = () => { if (mediaElement && Number.isFinite(mediaElement.duration)) mediaElement.currentTime = Number($('seek').value) / 1000 * mediaElement.duration; };

  function serialise() {
    return { app: 'IN ONE Studio Pro', version: 2, name: $('projectName').value || state.projectName,
      clips: state.clips.map(({ name, kind, size, type, duration, track, label, speed }) => ({ name, kind, size, type, duration, track: track || 'V1', label: label || 'Blue', speed: speed || 1 })),
      markers: state.markers, sequence: state.sequence,
      captions: state.captions, keyframes: state.keyframes, textDesign: { text: $('designText')?.value || 'YOUR TITLE', style: $('textStyle')?.value || 'neon', animation: $('textAnimation')?.value || 'fade' }, createdAt: new Date().toISOString(),
      note: 'Project JSON stores edit metadata only. Source media is not embedded; re-import media after loading.' };
  }
  function download(name, blob) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function saveLocal() {
    state.projectName = $('projectName').value.trim() || 'My IN ONE Project';
    try {
      localStorage.setItem('inone-project', JSON.stringify(serialise()));
      $('saveStatus').textContent = `Saved locally at ${new Date().toLocaleString()}. Media files are not embedded.`;
    } catch (err) { $('saveStatus').textContent = `Save failed: ${err.name === 'QuotaExceededError' ? 'device storage is full' : err.message}`; }
    updateProjectInfo();
  }
  function exportProject() { download(`${safeName($('projectName').value)}.json`, new Blob([JSON.stringify(serialise(), null, 2)], { type: 'application/json' })); }
  $('saveProject').onclick = $('saveProject2').onclick = saveLocal;
  $('exportProject').onclick = $('exportProject2').onclick = exportProject;
  $('projectName').oninput = () => { state.projectName = $('projectName').value; updateProjectInfo(); };
  $('projectInput').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Invalid project format');
      state.projectName = typeof d.name === 'string' ? d.name : 'Imported project'; $('projectName').value = state.projectName;
      state.captions = Array.isArray(d.captions) ? d.captions : []; state.keyframes = Array.isArray(d.keyframes) ? d.keyframes : []; state.markers = Array.isArray(d.markers) ? d.markers : []; state.sequence = d.sequence || state.sequence; applySequenceToUI(); renderMarkers();
      // Clip metadata is restored as relink placeholders; browser file URLs cannot survive an app restart.
      state.clips.forEach(releaseClip); state.clips = Array.isArray(d.clips) ? d.clips.map(c => ({ ...c, url: null, relink: true })) : [];
      state.selected = -1; renderCaptions(); renderKeyframes(); renderTimeline(); showEmptyPreview(state.clips.length ? 'Project loaded. Re-import source media to relink clips.' : 'Project loaded.');
      $('saveStatus').textContent = 'Project metadata imported. Re-import source media because media files are not stored in JSON.';
    } catch (err) { alert(`Could not import project: ${err.message}`); }
    e.target.value = '';
  };
  try {
    const saved = JSON.parse(localStorage.getItem('inone-project') || 'null');
    if (saved) { state.projectName = saved.name || state.projectName; $('projectName').value = state.projectName; state.captions = Array.isArray(saved.captions) ? saved.captions : []; state.keyframes = Array.isArray(saved.keyframes) ? saved.keyframes : []; state.markers = Array.isArray(saved.markers) ? saved.markers : []; state.sequence = saved.sequence || state.sequence; state.clips = Array.isArray(saved.clips) ? saved.clips.map(c => ({ ...c, url: null, relink: true })) : []; }
  } catch (_) { $('saveStatus').textContent = 'A saved project could not be read; create a new save.'; }


  // Sequence settings are saved as project metadata and restored on import.
  function applySequenceToUI(){
    $('projectResolution').value=state.sequence.resolution||'1920x1080';
    $('projectFps').value=state.sequence.fps||'30';
    $('projectColor').value=state.sequence.color||'Rec.709';
    $('projectAspect').value=state.sequence.aspect||'16:9';
  }
  $('saveSequence').onclick=()=>{
    state.sequence={resolution:$('projectResolution').value,fps:$('projectFps').value,color:$('projectColor').value,aspect:$('projectAspect').value};
    $('sequenceStatus').textContent=`Applied ${state.sequence.resolution} · ${state.sequence.fps} fps · ${state.sequence.color}. These settings guide the project; export engine support is separate.`;
    saveLocal();
  };
  applySequenceToUI();
  let autosaveTimer=null;
  function configureAutosave(){
    if(autosaveTimer)clearInterval(autosaveTimer);
    const mins=Number($('autosaveInterval').value);
    if(mins>0)autosaveTimer=setInterval(()=>{saveLocal();$('saveStatus').textContent=`Auto-saved at ${new Date().toLocaleTimeString()}.`;},mins*60000);
  }
  $('autosaveInterval').onchange=configureAutosave;configureAutosave();

  // Timeline markers store the current selected media timecode.
  function renderMarkers(){
    const root=$('markerList');root.replaceChildren();
    $('markerCount').textContent=`${state.markers.length} markers`;
    if(!state.markers.length){root.textContent='No markers yet.';return;}
    state.markers.forEach((m,i)=>{
      const chip=document.createElement('span');chip.className='marker-chip';
      const jump=document.createElement('button');jump.className='btn secondary';jump.textContent=`${m.label||'Marker'} · ${fmt(m.time)}`;
      jump.onclick=()=>{if(mediaElement && Number.isFinite(mediaElement.duration))mediaElement.currentTime=Math.min(m.time,mediaElement.duration);};
      const del=document.createElement('button');del.className='btn secondary';del.textContent='×';del.setAttribute('aria-label','Delete marker');
      del.onclick=()=>{state.markers.splice(i,1);renderMarkers();};
      chip.append(jump,del);root.appendChild(chip);
    });
  }
  $('addMarker').onclick=()=>{
    const time=mediaElement?mediaElement.currentTime:0;
    state.markers.push({time,label:`Marker ${state.markers.length+1}`,clip:state.clips[state.selected]?.name||''});
    state.markers.sort((a,b)=>a.time-b.time);renderMarkers();
  };
  $('clearMarkers').onclick=()=>{state.markers=[];renderMarkers();};
  renderMarkers();

  // Non-destructive color preview: adjustments affect the selected preview only.
  function applyClipGrade(){
    if(!mediaElement || !['VIDEO','video'].includes(mediaElement.tagName))return;
    const exposure=Number($('gradeExposure').value)/100;
    const contrast=Number($('gradeContrast').value)/100;
    const saturation=Number($('gradeSaturation').value)/100;
    const warmth=Number($('gradeWarmth').value);
    mediaElement.style.filter=`brightness(${exposure}) contrast(${contrast}) saturate(${saturation}) sepia(${Math.abs(warmth)/250}) hue-rotate(${warmth<0?180:0}deg)`;
  }
  ['gradeExposure','gradeContrast','gradeSaturation','gradeWarmth'].forEach(id=>$(id).oninput=applyClipGrade);
  $('resetGrade').onclick=()=>{ $('gradeExposure').value=100;$('gradeContrast').value=100;$('gradeSaturation').value=100;$('gradeWarmth').value=0;applyClipGrade(); };
  $('clipSpeed').onchange=()=>{if(mediaElement){mediaElement.playbackRate=Number($('clipSpeed').value);const c=state.clips[state.selected];if(c)c.speed=Number($('clipSpeed').value);}};

  function applyMotion() {
    const x = +$('posX').value, y = +$('posY').value, s = +$('scale').value, r = +$('rotation').value, o = +$('opacity').value, z = +$('camZoom').value;
    $('motionObject').style.transform = `translate(${x}px,${y}px) scale(${s / 100 * z / 100}) rotate(${r}deg)`; $('motionObject').style.opacity = o / 100;
  }
  ['posX', 'posY', 'scale', 'rotation', 'opacity', 'camZoom'].forEach(id => $(id).addEventListener('input', applyMotion));
  $('resetMotion').onclick = () => { ['posX', 'posY', 'rotation'].forEach(id => $(id).value = 0); ['scale', 'opacity', 'camZoom'].forEach(id => $(id).value = 100); applyMotion(); };
  function renderKeyframes() {
    const root = $('keyframes'); root.replaceChildren();
    if (!state.keyframes.length) { root.textContent = 'No keyframes yet.'; return; }
    state.keyframes.forEach((k, i) => { const el = document.createElement('div'); el.className = 'clip'; const a = document.createElement('strong'); a.textContent = `Keyframe ${i + 1}`; const b = document.createElement('small'); b.textContent = `Frame ${k.time}`; const c = document.createElement('small'); c.textContent = `X:${k.x} Y:${k.y} Scale:${k.scale}% Rotation:${k.rotation}°`; el.append(a, b, c); root.appendChild(el); });
  }
  $('addKeyframe').onclick = () => { state.keyframes.push({ time: state.keyframes.length + 1, x: +$('posX').value, y: +$('posY').value, scale: +$('scale').value, rotation: +$('rotation').value, opacity: +$('opacity').value }); renderKeyframes(); };
  $('playKeyframes').onclick=()=>{
    if(state.keyframes.length<2){alert('Add at least two keyframes first.');return;}
    const frames=state.keyframes.map(k=>({transform:`translate(${k.x}px,${k.y}px) scale(${k.scale/100}) rotate(${k.rotation}deg)`,opacity:(k.opacity??100)/100}));
    $('motionObject').animate(frames,{duration:Math.max(1000,frames.length*900),iterations:1,easing:'ease-in-out',fill:'forwards'});
  };

  $('photoInput').onchange = e => {
    const f = e.target.files[0]; if (!f) return; photoFile = f;
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl); state.photoUrl = URL.createObjectURL(f);
    $('photoPreview').src = state.photoUrl; $('photoPreview').hidden = false; $('photoStage').querySelector('.muted')?.remove(); applyPhoto(); e.target.value = '';
  };
  function applyPhoto() { $('photoPreview').style.filter = `brightness(${$('brightness').value}%) contrast(${$('contrast').value}%) saturate(${$('saturation').value}%) blur(${$('blur').value}px)`; }
  ['brightness', 'contrast', 'saturation', 'blur'].forEach(id => $(id).oninput = applyPhoto);
  $('downloadPhoto').onclick = () => {
    if (!photoFile) { alert('Import a photo first.'); return; }
    const img = $('photoPreview'); if (!img.complete || !img.naturalWidth) { alert('Photo is still loading. Please try again.'); return; }
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    ctx.filter = img.style.filter || 'none'; ctx.drawImage(img, 0, 0);
    canvas.toBlob(blob => blob ? download('inone-photo-edit.png', blob) : alert('Could not export this photo.'), 'image/png');
  };

  function renderAudioList(files) {
    const root = $('audioList'); root.replaceChildren();
    files.forEach((file, i) => {
      const b = document.createElement('button'); b.className = 'btn secondary'; b.type = 'button'; b.textContent = `${i + 1}. ${file.name}`;
      b.onclick = () => { state.audioIndex = i; $('audioPlayer').src = state.audioUrls[i]; $('audioPlayer').play().catch(() => {}); };
      root.appendChild(b);
    });
  }
  $('audioInput').onchange = e => {
    state.audioUrls.forEach(url => URL.revokeObjectURL(url)); state.audioUrls = []; const files = [...e.target.files]; if (!files.length) return;
    state.audioUrls = files.map(f => URL.createObjectURL(f)); state.audioIndex = 0; $('audioPlayer').src = state.audioUrls[0]; $('audioPlayer').volume = Number($('audioVolume').value) / 100; renderAudioList(files); e.target.value = '';
  };
  $('audioPlayer').addEventListener('ended', () => { if (state.audioIndex + 1 < state.audioUrls.length) { state.audioIndex++; $('audioPlayer').src = state.audioUrls[state.audioIndex]; $('audioPlayer').play().catch(() => {}); } });
  $('audioVolume').oninput = e => $('audioPlayer').volume = Number(e.target.value) / 100;

  // Optional Web Audio EQ chain for live preview. Browser support is detected safely.
  let audioContext=null,audioSource=null,audioFilters=null,audioCompressorNode=null;
  function ensureAudioFx(){
    const player=$('audioPlayer');
    if(!window.AudioContext && !window.webkitAudioContext){$('audioFxStatus').textContent='Web Audio is not supported on this device.';return false;}
    try{
      if(!audioContext){
        const Ctx=window.AudioContext||window.webkitAudioContext;audioContext=new Ctx();
        audioSource=audioContext.createMediaElementSource(player);
        const bass=audioContext.createBiquadFilter();bass.type='lowshelf';bass.frequency.value=120;
        const mid=audioContext.createBiquadFilter();mid.type='peaking';mid.frequency.value=1000;mid.Q.value=0.8;
        const treble=audioContext.createBiquadFilter();treble.type='highshelf';treble.frequency.value=6000;
        audioCompressorNode=audioContext.createDynamicsCompressor();
        audioFilters={bass,mid,treble};
        audioSource.connect(bass);bass.connect(mid);mid.connect(treble);treble.connect(audioCompressorNode);audioCompressorNode.connect(audioContext.destination);
      }
      if(audioContext.state==='suspended')audioContext.resume();
      return true;
    }catch(e){$('audioFxStatus').textContent=`Audio FX unavailable: ${e.message}`;return false;}
  }
  function updateAudioFx(){
    if(!ensureAudioFx())return;
    audioFilters.bass.gain.value=Number($('eqBass').value);
    audioFilters.mid.gain.value=Number($('eqMid').value);
    audioFilters.treble.gain.value=Number($('eqTreble').value);
    const mode=$('audioCompressor').value;
    audioCompressorNode.threshold.value=mode==='strong'?-28:mode==='light'?-16:0;
    audioCompressorNode.ratio.value=mode==='strong'?6:mode==='light'?2:1;
    $('audioFxStatus').textContent='Live EQ / compressor applied to audio playback.';
  }
  ['eqBass','eqMid','eqTreble','audioCompressor'].forEach(id=>$(id).addEventListener('input',updateAudioFx));
  $('resetAudioFx').onclick=()=>{$('eqBass').value=0;$('eqMid').value=0;$('eqTreble').value=0;$('audioCompressor').value='off';updateAudioFx();};
  $('audioPlayer').addEventListener('play',()=>{if(audioContext)updateAudioFx();});


  function updateCaptionPreview() { $('captionPreview').textContent = state.captions.length ? state.captions[state.captions.length - 1].text : 'Your caption preview'; }
  function renderCaptions() {
    const root = $('captionList'); root.replaceChildren();
    state.captions.forEach((c, i) => {
      const row = document.createElement('div'); row.className = 'caption-row';
      const inputs = [
        Object.assign(document.createElement('input'), { type: 'text', value: c.start || '00:00:00,000', 'aria-label': 'Start time' }),
        Object.assign(document.createElement('input'), { type: 'text', value: c.end || '00:00:02,000', 'aria-label': 'End time' }),
        Object.assign(document.createElement('input'), { type: 'text', value: c.text || '', 'aria-label': 'Caption text' })
      ];
      inputs.forEach((el, j) => el.addEventListener('input', () => { c[['start', 'end', 'text'][j]] = el.value; updateCaptionPreview(); }));
      const del = document.createElement('button'); del.className = 'btn secondary'; del.type = 'button'; del.textContent = 'Delete'; del.onclick = () => { state.captions.splice(i, 1); renderCaptions(); };
      row.append(...inputs, del); root.appendChild(row);
    });
    $('captionCount').textContent = `${state.captions.length} captions`; updateCaptionPreview(); updateProjectInfo();
  }
  $('addCaption').onclick = () => { state.captions.push({ start: '00:00:00,000', end: '00:00:02,000', text: 'New caption' }); renderCaptions(); };
  function parseCaptions(text) {
    return text.replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\s*\n/).map(block => {
      const lines = block.split('\n'), ti = lines.findIndex(x => x.includes('-->')); if (ti < 0) return null;
      const [start, end] = lines[ti].split('-->').map(x => x.trim().split(/\s+/)[0]);
      return start && end ? { start, end, text: lines.slice(ti + 1).join(' ').trim() } : null;
    }).filter(Boolean);
  }
  $('srtInput').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { state.captions = parseCaptions(await f.text()); renderCaptions(); } catch (_) { alert('Could not read subtitle file.'); } e.target.value = ''; };
  $('downloadSrt').onclick = () => {
    if (!state.captions.length) { alert('Add or import captions first.'); return; }
    const txt = state.captions.map((c, i) => `${i + 1}\n${c.start} --> ${c.end}\n${c.text}`).join('\n\n'); download('captions.srt', new Blob([txt], { type: 'text/plain;charset=utf-8' }));
  };

  document.querySelectorAll('.effect').forEach(b => b.onclick = () => { const filter = b.dataset.filter === 'none' ? 'none' : b.dataset.filter; $('effectPreview').style.filter = filter; if (mediaElement && (mediaElement.tagName === 'VIDEO' || mediaElement.tagName === 'IMG')) mediaElement.style.filter = filter; });
  function rotateCube() { $('cube').style.transform = `rotateX(${$('rotX').value}deg) rotateY(${$('rotY').value}deg)`; }
  $('rotX').oninput = rotateCube; $('rotY').oninput = rotateCube; rotateCube();

  // Text designer: live styles, animation previews, caption creation and PNG export.
  const textArtwork = $('textArtwork');
  function updateTextArtwork() {
    if (!textArtwork) return;
    textArtwork.textContent = $('designText').value || ' ';
    textArtwork.className = `text-artwork style-${$('textStyle').value}`;
    textArtwork.style.fontSize = `${$('textSize').value}px`; textArtwork.style.fontFamily=$('textFont').value; textArtwork.style.letterSpacing=`${$('textTracking').value}px`; textArtwork.style.webkitTextStroke=`${$('textStroke').value}px ${$('textColor').value}`;
    if (['outline','gradient','neon','gold','retro','bubble','glitch'].indexOf($('textStyle').value) < 0) textArtwork.style.color = $('textColor').value;
    const alpha = Number($('textBgOpacity').value) / 100;
    const hex = $('textBg').value.replace('#','');
    const rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
    $('textStage').style.background = alpha ? `linear-gradient(rgba(${rgb.join(',')},${alpha}),rgba(${rgb.join(',')},${alpha})),radial-gradient(circle at 20% 20%,#33406b,#080c18 70%)` : 'radial-gradient(circle at 20% 20%,#33406b,#080c18 70%)';
  }
  ['designText','textStyle','textSize','textColor','textBg','textBgOpacity','textFont','textTracking','textStroke'].forEach(id => $(id)?.addEventListener('input', updateTextArtwork));
  function animateText() {
    updateTextArtwork();
    const names = {fade:'text-fade',zoom:'text-zoom',bounce:'text-bounce',slide:'text-slide',type:'text-fade',flip:'text-flip',pulse:'text-pulse',shake:'text-shake',float:'text-float',glow:'text-glow'};
    textArtwork.style.animation = 'none'; void textArtwork.offsetWidth;
    textArtwork.style.animation = `${names[$('textAnimation').value] || 'text-fade'} 1.25s ease both`;
    if ($('textAnimation').value === 'type') {
      const full = $('designText').value; textArtwork.textContent = ''; let n=0;
      const timer = setInterval(() => { textArtwork.textContent = full.slice(0,++n); if (n >= full.length) clearInterval(timer); }, 55);
    }
  }
  $('textAnimation').onchange = updateTextArtwork;
  $('playTextAnimation').onclick = animateText;
  $('stopTextAnimation').onclick = () => { textArtwork.style.animation = 'none'; updateTextArtwork(); };
  $('addTextCaption').onclick = () => { state.captions.push({start:'00:00:00,000',end:'00:00:03,000',text:$('designText').value || 'New title'}); renderCaptions(); alert('Text added to Caption Studio. Adjust its timing there.'); };
  $('exportTextPng').onclick = () => {
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'); canvas.width=1920; canvas.height=1080;
    const bg=ctx.createLinearGradient(0,0,1920,1080); bg.addColorStop(0,'#10182f'); bg.addColorStop(1,'#34205d'); ctx.fillStyle=bg; ctx.fillRect(0,0,canvas.width,canvas.height);
    const text=$('designText').value || 'YOUR TITLE'; const size=Number($('textSize').value)*1.55;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${size}px system-ui,Arial`;ctx.shadowColor='#000';ctx.shadowBlur=22;ctx.shadowOffsetY=8;
    const style=$('textStyle').value;
    if(style==='outline'){ctx.lineWidth=4;ctx.strokeStyle=$('textColor').value;ctx.strokeText(text,960,540,1740);}
    else {ctx.fillStyle=style==='gold'?'#ffe7a3':style==='retro'?'#ffd166':style==='neon'?'#b8ffff':$('textColor').value;ctx.fillText(text,960,540,1740);}
    if(style==='neon'){ctx.shadowColor='#22d3ee';ctx.shadowBlur=36;ctx.fillText(text,960,540,1740);}
    canvas.toBlob(blob=>blob?download('inone-title-card.png',blob):alert('PNG export failed.'),'image/png');
  };
  updateTextArtwork();

  // Preset motion animations operate on the visible motion stage.
  document.querySelectorAll('.motion-preset').forEach(button => button.addEventListener('click', () => {
    const target=$('motionObject'), name=button.dataset.animation; target.style.animation='none';
    if(name==='stop') return;
    const durations={float:'3s',pulse:'1.1s',swing:'1.4s',shake:'0.45s',spin:'2.5s'};
    target.style.animation=`inone-${name} ${durations[name] || '1s'} ease-in-out infinite`;
  }));

  // Local video quality inspection. Samples three frames and scores basic visual signals.
  function getSelectedVideo() { const c=state.clips[state.selected]; return c && c.kind==='video' && c.url ? c : null; }
  function frameMetrics(video, time) {
    return new Promise(resolve => {
      let settled=false; const done=()=>{if(settled)return;settled=true;try{const canvas=document.createElement('canvas'),w=96,h=54;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,w,h);const d=ctx.getImageData(0,0,w,h).data;let sum=0,sum2=0,edges=0,prev=0,n=0;
        for(let i=0;i<d.length;i+=4){const lum=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];sum+=lum;sum2+=lum*lum;if(n%w)edges+=Math.abs(lum-prev);prev=lum;n++;}
        const mean=sum/n,contrast=Math.sqrt(Math.max(0,sum2/n-mean*mean)),sharp=edges/n;resolve({time,mean,contrast,sharp,image:canvas.toDataURL('image/jpeg',0.48)});}catch(e){resolve({time,error:e.message});}};
      const seek=()=>{video.removeEventListener('seeked',seek);done();};video.addEventListener('seeked',seek,{once:true});try{video.currentTime=time;}catch(e){resolve({time,error:e.message});}
      setTimeout(()=>{video.removeEventListener('seeked',seek);done();},1800);
    });
  }
  let latestReview = null;
  async function runLocalReview() {
    const clip=getSelectedVideo(); if(!clip) throw new Error('Please import and select a video clip first.');
    const v=document.createElement('video');v.src=clip.url;v.muted=true;v.playsInline=true;v.preload='auto';
    await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(new Error('Could not read this video.'));});
    const duration=Number.isFinite(v.duration)?v.duration:0;const times=[0,Math.max(0,duration*.5),Math.max(0,duration-.2)];
    const frames=[];for(const t of times){const m=await frameMetrics(v,t);if(!m.error)frames.push(m);}
    const width=v.videoWidth,height=v.videoHeight;const avg=frames.length?frames.reduce((a,f)=>a+f.mean,0)/frames.length:128;
    const contrast=frames.length?frames.reduce((a,f)=>a+f.contrast,0)/frames.length:0;const sharp=frames.length?frames.reduce((a,f)=>a+f.sharp,0)/frames.length:0;
    const resolution=width*height;let score=100;const notes=[];
    if(resolution<1280*720){score-=18;notes.push('Resolution is below 720p; use a higher-resolution source for crisp output.');}
    if(avg<55){score-=15;notes.push('Sampled frames look dark; consider exposure or shadow correction.');}else if(avg>210){score-=12;notes.push('Sampled frames look very bright; check highlights.');}
    if(contrast<28){score-=10;notes.push('Low contrast detected; a gentle contrast adjustment may help.');}
    if(sharp<12){score-=12;notes.push('Frame detail appears soft; check focus and motion blur.');}
    if(duration<10){notes.push('Short-form clip: use a strong opening hook in the first 1–2 seconds.');}else notes.push('Consider tightening pauses and placing the strongest moment early.');
    score=Math.max(25,Math.min(98,score));
    const report=`LOCAL VIDEO REVIEW\nQuality estimate: ${score}/100 (heuristic, not a professional certification)\nResolution: ${width} × ${height}\nDuration: ${fmt(duration)}\nSampled frames: ${frames.length}\nAverage brightness: ${avg.toFixed(1)}/255 · Contrast: ${contrast.toFixed(1)} · Edge detail: ${sharp.toFixed(1)}\n\nRECOMMENDATIONS\n${notes.map((x,i)=>`${i+1}. ${x}`).join('\n')}`;
    latestReview={clip:clip.name,duration,width,height,score,notes,frames,report};return latestReview;
  }
  $('analyzeVideo').onclick=async()=>{ $('analysisStatus').textContent='Analyzing frames…';$('analysisResults').textContent='Reading video metadata and sampling frames…';try{const r=await runLocalReview();$('analysisResults').textContent=`QUALITY SCORE: ${r.score}/100\n\n${r.report}\n\nTITLE IDEAS\n• ${r.clip.replace(/\.[^.]+$/,'')} — The Story Behind the Moment\n• Watch This Before You Scroll\n• One Moment. A Big Story.\n\nBANNER DIRECTION\nUse one clear subject, high contrast text, a short 3–5 word hook and safe margins.`;$('analysisStatus').textContent='Local analysis complete';}catch(e){$('analysisStatus').textContent='Review failed';$('analysisResults').textContent=e.message;}};

  // Native API bridge: keys are sent only for an explicit request and never persisted.
  function callAI(prompt) {
    const provider=$('aiProvider').value,key=$('aiKey').value.trim(),model=$('aiModel').value.trim();
    if(!key){$('aiConnectionStatus').textContent='Add an API key first';return;}
    const endpoint=$('aiEndpoint').value.trim();
    const payload=JSON.stringify({review:latestReview, prompt, clipName:getSelectedVideo()?.name || 'No selected clip'});
    $('aiConnectionStatus').textContent='Sending request…';
    if(window.InOneNative && InOneNative.requestAI){InOneNative.requestAI(provider,endpoint,model,key,payload);}
    else {$('aiConnectionStatus').textContent='AI network bridge is available in Android build only.';}
  }
  window.onAIResponse=(ok,message)=>{ $('aiConnectionStatus').textContent=ok?'AI response received':'AI request failed';$('aiCreativeOutput').textContent=message; if(ok)$('analysisResults').textContent += `\n\nAI CREATIVE REVIEW\n${message}`; };
  $('testAIConnection').onclick=()=>callAI('Reply with a short confirmation that the API connection works.',false);
  $('generateTitles').onclick=()=>callAI('Review this video and generate 10 clickable but honest titles, 5 short opening hooks, and explain the best title.');
  $('generateBannerBrief').onclick=()=>callAI('Create 3 YouTube thumbnail/banner concepts for this video. Give headline text, composition, subject placement, colors, and a detailed image-generation prompt.');
  $('generateEditPlan').onclick=()=>callAI('Act as a professional video editor. Recommend a detailed edit plan with hook, pacing, cuts, transitions, sound design, captions, color grade, ending and export settings.');

  renderCaptions(); renderKeyframes(); renderTimeline(); renderMarkers(); if (state.clips.length) showEmptyPreview('Saved project loaded. Re-import source media to preview clips.'); updateProjectInfo(); applyMotion();
  if (window.InOneNative) document.querySelector('.status').textContent = `● Android · ${InOneNative.appVersion()}`;

  window.onNativeVideoPicked = uri => { nativeVideoUri = uri; $('nativeExportStatus').textContent = 'Video selected. Set trim range and export.'; if (window.InOneNative) InOneNative.toast('Video selected for trim export'); };
  window.onNativeExportProgress = message => { $('nativeExportStatus').textContent = message; };
  window.onNativeExportComplete = uriOrPath => { $('nativeExportStatus').textContent = `Export complete: ${uriOrPath}`; if (window.InOneNative) InOneNative.toast('MP4 export complete'); };
  window.onNativeExportError = message => { $('nativeExportStatus').textContent = `Export error: ${message}`; };
  $('nativePickVideo').onclick = () => window.InOneNative ? InOneNative.pickVideo() : alert('Native video picker is available in the Android app build.');
  $('nativeTrimExport').onclick = () => {
    const start = Math.max(0, Number($('trimStart').value) || 0), end = Math.max(0, Number($('trimEnd').value) || 0);
    if (!nativeVideoUri) { alert("Choose a video using 'Choose video for MP4 trim' first."); return; }
    if (end <= start) { alert('End time must be greater than start time.'); return; }
    if (window.InOneNative) InOneNative.exportTrim(nativeVideoUri, Math.round(start * 1000), Math.round(end * 1000));
  };
  $('cancelNativeExport').onclick = () => { if (window.InOneNative) { InOneNative.cancelExport(); $('nativeExportStatus').textContent = 'Cancellation requested.'; } };

  // === v1.5.0-PRO NATIVE BRIDGE UPGRADES ===
  if ($('grantPermissionsBtn')) {
    $('grantPermissionsBtn').onclick = () => {
      if (window.InOneNative && InOneNative.requestPermissions) {
        InOneNative.requestPermissions();
      } else {
        alert('Permissions are automatically requested on Android device.');
      }
    };
  }

  window.onPermissionsResult = resStr => {
    try {
      const res = JSON.parse(resStr);
      const denied = Object.keys(res).filter(k => !res[k]);
      if (denied.length === 0 && window.InOneNative) {
        InOneNative.toast('All permissions enabled!');
      }
    } catch (_) {}
  };

  // Fix Android WebView Blob Downloads (Photo PNG, Title Card PNG, SRT, Project JSON)
  const originalDownload = download;
  download = function(name, blob) {
    if (window.InOneNative && InOneNative.saveDownloadFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        InOneNative.saveDownloadFile(name, blob.type || 'application/octet-stream', reader.result);
      };
      reader.readAsDataURL(blob);
    } else {
      originalDownload(name, blob);
    }
  };

  // Live preview rotation sync
  if ($('clipRotation')) {
    $('clipRotation').onchange = () => {
      const deg = Number($('clipRotation').value) || 0;
      if (mediaElement && ['VIDEO', 'video'].includes(mediaElement.tagName)) {
        mediaElement.style.transform = `rotate(${deg}deg)`;
      }
    };
  }

  // Multi-Video Picker & Pro Render Export Bridge
  let nativeVideoList = [];
  window.onNativeVideosPicked = jsonStr => {
    try {
      nativeVideoList = JSON.parse(jsonStr);
      nativeVideoUri = nativeVideoList[0] || null;
      $('nativeExportStatus').textContent = `${nativeVideoList.length} video(s) ready for Pro MP4 export!`;
      if (window.InOneNative) InOneNative.toast(`${nativeVideoList.length} video(s) selected for export`);
    } catch (e) {
      $('nativeExportStatus').textContent = 'Error reading selected videos.';
    }
  };

  $('nativePickVideo').onclick = () => {
    if (window.InOneNative && InOneNative.pickVideos) {
      InOneNative.pickVideos();
    } else {
      alert('Native multi-video picker is available in the Android APK build.');
    }
  };

  $('nativeTrimExport').onclick = () => {
    if (!nativeVideoList.length && !nativeVideoUri) {
      alert("पहले 'Select Videos for Pro MP4 Export' बटन दबाकर गैलरी से वीडियो चुनें।");
      return;
    }
    const uris = nativeVideoList.length ? nativeVideoList : [nativeVideoUri];
    const startSec = Math.max(0, Number($('trimStart').value) || 0);
    const endSec = Math.max(0, Number($('trimEnd').value) || 0);
    const speed = Number($('clipSpeed').value) || 1.0;

    // Convert UI sliders to Media3 ranges
    const brightness = (Number($('gradeExposure').value) - 100) / 100;
    const contrast = (Number($('gradeContrast').value) - 100) / 100;
    const saturation = Number($('gradeSaturation').value) - 100;
    const rotation = $('clipRotation') ? Number($('clipRotation').value) || 0 : 0;

    const clipsPayload = uris.map((u, idx) => ({
      uri: u,
      startMs: idx === 0 ? Math.round(startSec * 1000) : 0,
      endMs: (idx === 0 && endSec > startSec) ? Math.round(endSec * 1000) : 0,
      speed: speed,
      brightness: brightness,
      contrast: contrast,
      saturation: saturation,
      rotation: rotation
    }));

    if (window.InOneNative && InOneNative.exportProVideo) {
      InOneNative.exportProVideo(JSON.stringify({ clips: clipsPayload }));
    } else if (window.InOneNative && InOneNative.exportTrim) {
      InOneNative.exportTrim(uris[0], Math.round(startSec * 1000), Math.round(endSec * 1000));
    }
  };
})();
