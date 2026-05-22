

let pttActive = false;

const NEXUS_PATTERNS = [
  'https://nexus-sooty-nine.vercel.app/*',
  'http://localhost:3000/*',
];

async function getNexusTabs() {
  const results = await Promise.all(
    NEXUS_PATTERNS.map(pattern => chrome.tabs.query({ url: pattern }))
  );
  return results.flat();
}

async function broadcastPTT(active) {
  const tabs = await getNexusTabs();
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'NEXUS_PTT', active });
    } catch (_) {

    }
  }
}

function updateIcon(active) {
  const suffix = active ? 'active' : 'icon';
  chrome.action.setIcon({
    path: {
      16:  `icons/${suffix}16.png`,
      48:  `icons/${suffix}48.png`,
      128: `icons/${suffix}128.png`,
    }
  }).catch(() => {});
  chrome.action.setBadgeText({ text: active ? '🔴' : '' }).catch(() => {});
  if (active) {
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' }).catch(() => {});
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'ptt-toggle') return;

  pttActive = !pttActive;
  updateIcon(pttActive);
  await broadcastPTT(pttActive);

  await chrome.storage.session.set({ pttActive }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    getNexusTabs().then(tabs => {
      sendResponse({ pttActive, nexusOpen: tabs.length > 0 });
    });
    return true;
  }

  if (msg.type === 'SET_PTT') {
    pttActive = msg.active;
    updateIcon(pttActive);
    broadcastPTT(pttActive);
    chrome.storage.session.set({ pttActive }).catch(() => {});
    sendResponse({ ok: true });
  }
});
