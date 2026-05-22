

const pttBtn     = document.getElementById('pttBtn');
const pttIcon    = document.getElementById('pttIcon');
const pttLabel   = document.getElementById('pttLabel');
const statusEl   = document.getElementById('nexusStatus');
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const shortcutEl = document.getElementById('shortcutKey');

let currentActive = false;

chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
  if (chrome.runtime.lastError || !res) return;
  updateUI(res.pttActive, res.nexusOpen);
  currentActive = res.pttActive;
});

chrome.commands.getAll((commands) => {
  const pttCmd = commands.find(c => c.name === 'ptt-toggle');
  if (pttCmd?.shortcut) {
    shortcutEl.textContent = pttCmd.shortcut;
  } else {
    shortcutEl.textContent = 'Nie ustawiono';
    shortcutEl.style.color = '#f87171';
  }
});

function updateUI(active, nexusOpen) {

  if (nexusOpen) {
    statusEl.className    = 'nexus-status found';
    statusDot.className   = 'dot green';
    statusText.textContent = '✓ Połączono z Nexus';
  } else {
    statusEl.className    = 'nexus-status notfound';
    statusDot.className   = 'dot red';
    statusText.textContent = 'Nexus nie jest otwarty';
  }

  pttBtn.className = `ptt-btn ${active ? 'active' : 'inactive'}`;
  pttIcon.textContent  = active ? '🔴' : '🎙';
  pttLabel.textContent = active ? 'Mikrofon AKTYWNY — kliknij aby wyłączyć' : 'Kliknij aby mówić';
  currentActive = active;
}

pttBtn.addEventListener('click', () => {
  const newActive = !currentActive;
  chrome.runtime.sendMessage({ type: 'SET_PTT', active: newActive }, () => {
    updateUI(newActive, statusEl.classList.contains('found'));
  });
});

document.getElementById('btnShortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

document.getElementById('btnNexus').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://nexus-sooty-nine.vercel.app' });
});
