

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'NEXUS_PTT') return;

  window.dispatchEvent(new CustomEvent('nexus-ext-ptt', {
    detail: { active: message.active }
  }));
});

window.dispatchEvent(new CustomEvent('nexus-ext-ready', {
  detail: { version: '1.0.0' }
}));

setInterval(() => {
  window.dispatchEvent(new CustomEvent('nexus-ext-ping'));
}, 5000);
