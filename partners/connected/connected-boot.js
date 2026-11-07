(() => {
  const root = document.documentElement;
  const requested = new URLSearchParams(location.search).get('connected-app');
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
