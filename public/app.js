import { transformPixels, fittedSize, SPECIES } from './vision.js';

const $ = id => document.getElementById(id);
const original = $('original-canvas'), transformed = $('animal-canvas');
const originalContext = original.getContext('2d', {willReadFrequently:true, colorSpace:'srgb'});
const transformedContext = transformed.getContext('2d', {colorSpace:'srgb'});
const state = {animal:'dog', loaded:false, busy:false, mode:'split', ticket:0, revision:0, blob:null, blobRevision:-1, exportURL:null, sample:true};
let exportJob = null;
const setStatus = message => { $('status').textContent = message; };
let exportTimer;
function scheduleExport() {
  clearTimeout(exportTimer);
  if(state.loaded) exportTimer=setTimeout(()=>prepareExport().catch(()=>{}),250);
}
function setBusy(busy) {
  state.busy = busy;
  $('comparison').setAttribute('aria-busy', String(busy));
  for (const id of ['save-button','share-button','view-button']) $(id).disabled = busy || !state.loaded;
  $('upload-button').disabled = busy;
  $('sample-button').disabled = busy;
}
function invalidateExport() {
  state.revision++;
  state.blob = null;
  state.blobRevision = -1;
  if (state.exportURL) URL.revokeObjectURL(state.exportURL);
  state.exportURL = null;
  scheduleExport();
}
function setAnimal(animal) {
  state.animal = animal;
  const species = SPECIES[animal];
  document.body.dataset.animal = animal;
  document.querySelectorAll('[data-animal]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.animal === animal));
  });
  $('animal-label').textContent = (animal === 'dog' ? '犬' : '猫') + 'の色覚（近似）';
  $('species-title').textContent = species.title;
  $('species-note').textContent = species.note;
  transformed.setAttribute('aria-label', `${species.label}の色覚の参考イメージ。人の二色型モデルによる近似。`);
  invalidateExport();
  if (state.loaded) setStatus('');
}
function updateSplit() {
  const value = Number($('split-range').value);
  $('comparison').style.setProperty('--split', `${value}%`);
  $('split-range').setAttribute('aria-valuetext', `元の写真 ${value}%、色覚の参考 ${100-value}%`);
}
function toggleView() {
  state.mode = state.mode === 'split' ? 'animal' : 'split';
  $('comparison').dataset.view = state.mode;
  $('view-button').textContent = state.mode === 'split' ? '全体表示' : '比較表示';
  $('view-button').setAttribute('aria-pressed', String(state.mode === 'animal'));
  $('split-range').disabled = state.mode !== 'split';
}
function imageFromURL(url) {
  return new Promise((resolve,reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}
async function decodePhoto(file) {
  // createImageBitmap's default orientation honors EXIF; <img> is a Safari fallback.
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, {imageOrientation:'from-image'}); } catch {}
  }
  const url = URL.createObjectURL(file);
  try { return await imageFromURL(url); } finally { URL.revokeObjectURL(url); }
}
async function loadImage(source, sample) {
  const ticket = ++state.ticket;
  setBusy(true);
  setStatus('写真を変換しています…');
  let image;
  try {
    if (!sample) {
      if (source.size > 30*1024*1024) throw new Error('large');
      if (!(source.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|avif)$/i.test(source.name))) throw new Error('type');
    }
    image = sample ? await imageFromURL('./sample.jpg') : await decodePhoto(source);
    if (ticket !== state.ticket) return;
    const {width,height} = fittedSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
    // Stage offscreen so a bad input cannot erase the previous usable picture.
    const work = document.createElement('canvas');
    work.width = width; work.height = height;
    const context = work.getContext('2d', {willReadFrequently:true, colorSpace:'srgb'});
    context.fillStyle = '#fff'; context.fillRect(0,0,width,height);
    context.drawImage(image,0,0,width,height);
    const pixels = context.getImageData(0,0,width,height);
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (ticket !== state.ticket) return;
    const result = transformPixels(pixels.data);
    original.width = transformed.width = width;
    original.height = transformed.height = height;
    originalContext.drawImage(work,0,0);
    transformedContext.putImageData(new ImageData(result,width,height),0,0);
    // Static image surfaces keep comparison stable across mobile compositor resizes.
    $('original-preview').src=original.toDataURL('image/png');
    $('animal-preview').src=transformed.toDataURL('image/png');
    $('comparison').style.setProperty('--image-ratio', Math.min(1.6, Math.max(0.8,width/height)));
    state.loaded = true; state.sample = sample;
    $('comparison').classList.add('is-loaded');
    const sourceLabel = $('source-label');
    if (sourceLabel) sourceLabel.textContent = sample ? 'サンプル写真' : '選んだ写真';
    invalidateExport();
    setStatus('');
  } catch (error) {
    if (ticket !== state.ticket) return;
    setStatus(error.message === 'large' ? '写真は30MB以下で選んでね。スクリーンショットでも試せます。' : error.message === 'type' ? '写真ファイルを選んでね。JPEG・PNGなどに対応しています。' : 'この写真を開けませんでした。HEICなどで開けないときは、JPEGやスクリーンショットで試してね。');
  } finally {
    image?.close?.();
    if (ticket === state.ticket) setBusy(false);
  }
}
function roundedRect(ctx,x,y,width,height,radius) {
  ctx.beginPath(); ctx.roundRect(x,y,width,height,radius);
}
function exportCanvas() {
  const canvas = document.createElement('canvas');
  const w = 1080, padding = 52, imageWidth = w-padding*2;
  const imageHeight = Math.round(Math.max(500,Math.min(1000,imageWidth*original.height/original.width)));
  const top = 210;
  canvas.width=w; canvas.height=top+imageHeight+200;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f7f8f5';ctx.fillRect(0,0,w,canvas.height);
  ctx.fillStyle='#25352d';ctx.font='bold 44px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.fillText('わんにゃん視覚',padding,83);
  ctx.font='25px sans-serif';ctx.fillText('写真でくらべる、色の区別',padding,132);
  ctx.font='bold 24px sans-serif';ctx.fillText('元の写真',padding,185);
  ctx.textAlign='right';ctx.fillText(`${SPECIES[state.animal].label}の色覚（近似）`,w-padding,185);ctx.textAlign='left';
  roundedRect(ctx,padding,top,imageWidth,imageHeight,28);ctx.save();ctx.clip();
  ctx.fillStyle='#ece7df';ctx.fillRect(padding,top,imageWidth,imageHeight);
  const scale=Math.min(imageWidth/original.width,imageHeight/original.height);
  const dw=original.width*scale,dh=original.height*scale,dx=(w-dw)/2,dy=top+(imageHeight-dh)/2;
  ctx.drawImage(original,dx,dy,dw,dh);
  ctx.save();ctx.beginPath();ctx.rect(w/2,top,imageWidth/2,imageHeight);ctx.clip();ctx.drawImage(transformed,dx,dy,dw,dh);ctx.restore();
  ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(w/2,top);ctx.lineTo(w/2,top+imageHeight);ctx.stroke();ctx.restore();
  ctx.fillStyle='#25352d';ctx.font='23px sans-serif';
  ctx.fillText('犬・猫の色の区別を知るための参考イメージ',padding,top+imageHeight+57);
  ctx.font='20px sans-serif';
  ctx.fillText('人の二色型モデルによる近似。実際の見え方を再現したものではありません。',padding,top+imageHeight+94);
  ctx.fillStyle='#5e6c63';ctx.font='19px sans-serif';
  ctx.fillText('wannyan-vision.pages.dev',padding,canvas.height-38);
  if(state.sample) {ctx.textAlign='right';ctx.fillText('写真：Thegreatmutata / CC0',w-padding,canvas.height-38);}
  return canvas;
}
async function prepareExport() {
  if (state.blob && state.blobRevision === state.revision) return state.blob;
  const revision=state.revision;
  if(exportJob?.revision === revision) return exportJob.promise;
  const job={revision,promise:null};
  job.promise=(async()=>{
    const blob=await new Promise((resolve,reject)=>exportCanvas().toBlob(b=>b?resolve(b):reject(new Error('export')),'image/png'));
    if (revision !== state.revision) return prepareExport();
    state.blob=blob;state.blobRevision=revision;
    if(state.exportURL)URL.revokeObjectURL(state.exportURL);
    state.exportURL=URL.createObjectURL(blob);
    return blob;
  })();
  exportJob=job;
  try {return await job.promise;} finally {if(exportJob===job)exportJob=null;}
}
async function showExport() {
  if(!state.loaded || state.busy)return;
  $('save-button').disabled=true;
  try {
    await prepareExport();
    $('export-image').src=state.exportURL;
    $('export-image').alt=`元の写真と${SPECIES[state.animal].label}の色覚の近似を半分ずつ比べた画像`;
    $('download-link').href=state.exportURL;
    $('download-link').download=`わんにゃん視覚-${SPECIES[state.animal].label}.png`;
    $('export-dialog').showModal();
  } catch {setStatus('画像を作れませんでした。写真を小さくして、もう一度試してね。');}
  finally{$('save-button').disabled=false;}
}
async function share() {
  if(!state.loaded || state.busy)return;
  const text=`いつもの世界、うちの子にはどう見える？「わんにゃん視覚」で比べてみた。※色覚の参考イメージ`;
  const url=new URL('.',location.href).href;
  try {
    // Call share while the click activation is still live; do not encode a PNG first.
    if(navigator.share) {
      const file=state.blob && state.blobRevision===state.revision ? new File([state.blob],`wannyan-${state.animal}.png`,{type:'image/png'}) : null;
      if(file && navigator.canShare?.({files:[file]})) await navigator.share({files:[file],title:'わんにゃん視覚',text,url});
      else await navigator.share({title:'わんにゃん視覚',text,url});
      setStatus('共有先に渡しました。送信は共有先の画面で確認してね。');
    } else if(navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${url}`);setStatus('紹介文とアプリのリンクをコピーしました。写真は画像保存から。');
    } else {setStatus('共有には、このページのURLをコピーしてね。写真は「比較画像を保存」から保存できます。');}
  } catch(error) {
    if(error.name==='AbortError'){setStatus('共有をキャンセルしました。');return;}
    setStatus('このブラウザでは共有を開けませんでした。画像保存、またはページURLのコピーを試してね。');
  }
}

$('upload-button').addEventListener('click',()=>$('photo-input').click());
$('photo-input').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';if(file)loadImage(file,false);});
$('sample-button').addEventListener('click',()=>loadImage(null,true));
document.querySelectorAll('button[data-animal]').forEach(button=>button.addEventListener('click',()=>setAnimal(button.dataset.animal)));
$('split-range').addEventListener('input',updateSplit);
let dragPointer = null;
function pointSplit(event) {
  const box=$('comparison').getBoundingClientRect();
  $('split-range').value=String(Math.round(Math.min(100,Math.max(0,(event.clientX-box.left)/box.width*100))));
  updateSplit();
}
$('comparison').addEventListener('pointerdown',event=>{
  if(state.mode!=='split'||!state.loaded||event.button!==0)return;
  dragPointer=event.pointerId;$('comparison').setPointerCapture(event.pointerId);pointSplit(event);
});
$('comparison').addEventListener('pointermove',event=>{if(event.pointerId===dragPointer)pointSplit(event);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('comparison').addEventListener(type,()=>{dragPointer=null;});
$('about-button').addEventListener('click',()=>{$('science-dialog').showModal();});
$('close-science').addEventListener('click',()=>{$('science-dialog').close();});
$('science-dialog').addEventListener('click',event=>{if(event.target===$('science-dialog'))$('science-dialog').close();});
$('view-button').addEventListener('click',toggleView);
$('save-button').addEventListener('click',showExport);
$('share-button').addEventListener('click',share);
$('close-export').addEventListener('click',()=>$('export-dialog').close());
$('export-dialog').addEventListener('click',event=>{if(event.target===$('export-dialog'))$('export-dialog').close();});
$('download-link').addEventListener('click',()=>setStatus('保存用の画像を開きました。保存先はブラウザで確認してね。'));
window.addEventListener('pagehide',event=>{if(event.persisted)return;clearTimeout(exportTimer);if(state.exportURL)URL.revokeObjectURL(state.exportURL);state.exportURL=null;state.blob=null;});
setAnimal('dog');updateSplit();loadImage(null,true);
