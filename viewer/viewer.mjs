import * as pdfjs from '/vendor/pdfjs/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
const query = new URLSearchParams(location.search);
const file = query.get('file') || '';
const zh = query.get('lang') === 'zh';
document.documentElement.lang = zh ? 'zh-CN' : 'en';
const $ = id => document.getElementById(id);
const isCv = /^\/attaches\/(Liang_Zhang_CV_(ZH|EN)|CV)\.pdf$/.test(file);
const backPath = isCv ? (zh ? '/zh/' : '/') : (zh ? '/zh/Publications/' : '/Publications/');
$('back').href = backPath;
$('back').textContent = zh ? (isCv ? '← 个人主页' : '← 学术论文') : (isCv ? '← Home' : '← Publications');
$('download').textContent = zh ? '下载 PDF' : 'Download PDF';
$('previous').textContent = zh ? '上一页' : 'Previous';
$('next').textContent = zh ? '下一页' : 'Next';
$('page-label').textContent = zh ? '页码' : 'Page';
$('zoom-label').textContent = zh ? '缩放' : 'Zoom';
$('toolbar').setAttribute('aria-label', zh ? 'PDF 阅读导航' : 'PDF navigation');
$('zoom').options[0].textContent = zh ? '适应宽度' : 'Fit width';
$('status').textContent = zh ? '正在载入 PDF…' : 'Loading PDF…';
let pdf, currentPage = 1, renderTask = null, request = 0;
const canvas = $('pdf-canvas');
async function render() {
  const ticket = ++request;
  if (renderTask) { renderTask.cancel(); try { await renderTask.promise; } catch {} }
  if (!pdf || ticket !== request) return;
  const page = await pdf.getPage(currentPage);
  if (ticket !== request) return;
  const natural = page.getViewport({scale:1});
  const available = Math.min(1100, Math.max(220, $('paper').clientWidth - 32));
  const scale = $('zoom').value === 'fit' ? available / natural.width : Number($('zoom').value);
  const viewport = page.getViewport({scale});
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(viewport.width * density);
  canvas.height = Math.ceil(viewport.height * density);
  canvas.style.width = `${Math.ceil(viewport.width)}px`;
  canvas.style.height = `${Math.ceil(viewport.height)}px`;
  canvas.setAttribute('aria-label', zh ? `PDF 第 ${currentPage} 页` : `PDF page ${currentPage}`);
  $('page-number').value = currentPage;
  $('previous').disabled = currentPage <= 1;
  $('next').disabled = currentPage >= pdf.numPages;
  $('status').textContent = zh ? '正在显示…' : 'Rendering…';
  renderTask = page.render({canvasContext:canvas.getContext('2d'), viewport, transform:density === 1 ? null : [density,0,0,density,0,0]});
  try {
    await renderTask.promise;
    if (ticket === request) {
      canvas.dataset.rendered = String(currentPage);
      $('status').textContent = zh ? `第 ${currentPage} 页，共 ${pdf.numPages} 页` : `Page ${currentPage} of ${pdf.numPages}`;
    }
  } catch (error) { if (error.name !== 'RenderingCancelledException') throw error; }
}
function onError(error) {
  console.error(error);
  $('status').textContent = zh ? '此页面暂时无法显示，请使用上方链接下载原文件。' : 'This page could not be displayed. Use the download link for the original PDF.';
}
async function start() {
  if (!/^\/attaches\/(?:papers\/)?[A-Za-z0-9][A-Za-z0-9_.-]*\.pdf$/.test(file)) throw new Error('Invalid PDF path');
  $('download').href = file;
  $('download').download = file.split('/').pop();
  $('download').hidden = false;
  $('document-name').textContent = file.split('/').pop();
  pdf = await pdfjs.getDocument({url:file,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/'}).promise;
  $('page-count').textContent = `/ ${pdf.numPages}`;
  $('page-number').max = pdf.numPages;
  $('page-number').disabled = false;
  $('zoom').disabled = false;
  await render();
  const metadata = await pdf.getMetadata().catch(()=>null);
  if (metadata?.info?.Title) { $('document-name').textContent = metadata.info.Title; document.title = metadata.info.Title + ' · PDF'; }
}
$('previous').addEventListener('click',()=>{if(currentPage>1){currentPage--;render().catch(onError);}});
$('next').addEventListener('click',()=>{if(pdf && currentPage<pdf.numPages){currentPage++;render().catch(onError);}});
$('page-number').addEventListener('change',()=>{currentPage=Math.min(pdf.numPages,Math.max(1,Math.floor(Number($('page-number').value))||1));render().catch(onError);});
$('zoom').addEventListener('change',()=>render().catch(onError));
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>render().catch(onError),180);});
start().catch(onError);
