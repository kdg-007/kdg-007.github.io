(() => {
  const root = document.documentElement;
  root.dataset.connectedBoot='true';
  document.querySelectorAll('link[data-connected-style]').forEach(link=>{
    link.addEventListener('load',()=>{link.media='all';},{once:true});
    if(link.sheet)link.media='all';
  });
  // Styles are non-blocking. Apply them after download, including fast cache hits.
  window.addEventListener('load',()=>document.querySelectorAll('link[data-connected-style]').forEach(link=>{link.media='all';}),{once:true});
  const requested = new URLSearchParams(location.search).get('connected-app');
  if(requested==='travelit'){const preload=document.createElement('link');preload.rel='modulepreload';preload.href='/partners/travelit/thinkit/afda98f5ced9406d0fe5/js/app-fast.js?v=keepit-files-1';document.head.append(preload);}
  if (requested === 'keepit') return;
  root.dataset.connectedStarting = 'true';
  document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('connected-startup');
    const label = {liveit: 'LiveIt', thinkit: 'ThinkIt', travelit: 'TravelIt'}[requested] || 'LiveIt';
    if (status) status.textContent = 'Opening ' + label + '…';
    const timeout = setTimeout(() => {
      if (!root.dataset.connectedStarting || !status) return;
      status.textContent = label + ' is taking longer to open. ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Reload';
      retry.addEventListener('click', () => location.reload());
      status.append(retry);
    }, 20000);
    window.addEventListener('connected-workspace-ready', () => clearTimeout(timeout), {once: true});
  }, {once: true});
})();
