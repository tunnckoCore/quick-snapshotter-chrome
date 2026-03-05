document.addEventListener('DOMContentLoaded', () => {
  const subfolderInput = document.getElementById('subfolder');
  const btnSave = document.getElementById('btn-save');
  const btnShortcuts = document.getElementById('btn-shortcuts');
  const saveStatus = document.getElementById('save-status');
  const currentShortcutEl = document.getElementById('current-shortcut');

  // Load existing settings
  chrome.storage.sync.get({ subfolder: '' }, (items) => {
    subfolderInput.value = items.subfolder;
  });

  // Load current shortcut
  chrome.commands.getAll((commands) => {
    const takeScreenshotCommand = commands.find(c => c.name === 'take-screenshot');
    if (takeScreenshotCommand && takeScreenshotCommand.shortcut) {
      currentShortcutEl.textContent = takeScreenshotCommand.shortcut;
    } else {
      currentShortcutEl.textContent = 'Not set';
    }
  });

  // Save settings
  btnSave.addEventListener('click', () => {
    let folder = subfolderInput.value.trim();
    // sanitize folder name slightly
    folder = folder.replace(/^[\/\\]+|[\/\\]+$/g, ''); 

    chrome.storage.sync.set({ subfolder: folder }, () => {
      saveStatus.style.display = 'block';
      setTimeout(() => {
        saveStatus.style.display = 'none';
      }, 2000);
    });
  });

  // Open shortcuts settings
  btnShortcuts.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
});