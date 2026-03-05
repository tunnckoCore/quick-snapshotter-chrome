(function() {
  if (window.__screenshotExtensionActive) return;
  window.__screenshotExtensionActive = true;

  const overlay = document.createElement('div');
  overlay.id = 'screenshot-extension-overlay';
  document.body.appendChild(overlay);

  const highlight = document.createElement('div');
  highlight.id = 'screenshot-extension-highlight';
  document.body.appendChild(highlight);
  
  const actionUi = document.createElement('div');
  actionUi.id = 'screenshot-extension-actions';
  actionUi.innerHTML = `
    <button id="screenshot-btn-download">Download</button>
    <button id="screenshot-btn-copy">Copy to Clipboard</button>
    <button id="screenshot-btn-cancel">Cancel</button>
  `;
  document.body.appendChild(actionUi);

  let currentTarget = null;
  let locked = false;
  
  let isMouseDown = false;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let selectedRect = null;

  function onMouseDown(e) {
    if (e.target.closest('#screenshot-extension-actions')) return;
    
    if (locked) {
      // Click outside to unlock
      locked = false;
      actionUi.style.display = 'none';
      
      // Update hover highlight immediately based on mouse position
      isMouseDown = true;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;
      return;
    }
    
    if (e.button !== 0) return; // Only left click
    
    isMouseDown = true;
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
  }

  function onMouseMove(e) {
    if (locked) return;
    
    if (isMouseDown) {
      isDragging = true;
      const currentX = e.clientX;
      const currentY = e.clientY;
      
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(startX - currentX);
      const height = Math.abs(startY - currentY);
      
      selectedRect = { 
        x, y, width, height,
        bottom: y + height,
        right: x + width,
        top: y,
        left: x
      };
      
      highlight.style.left = `${x}px`;
      highlight.style.top = `${y}px`;
      highlight.style.width = `${width}px`;
      highlight.style.height = `${height}px`;
      highlight.style.display = 'block';
      highlight.style.border = '2px dashed #007bff';
      highlight.style.background = 'rgba(0, 123, 255, 0.1)';
      
    } else {
      // Element hover mode
      overlay.style.pointerEvents = 'none';
      highlight.style.pointerEvents = 'none';
      actionUi.style.pointerEvents = 'none';
      
      const target = document.elementFromPoint(e.clientX, e.clientY);
      
      overlay.style.pointerEvents = 'auto';
      actionUi.style.pointerEvents = 'auto';
      
      if (target && target !== currentTarget && target !== document.body && target !== document.documentElement) {
        currentTarget = target;
        const rect = target.getBoundingClientRect();
        
        selectedRect = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
          top: rect.top,
          left: rect.left
        };
        
        highlight.style.left = `${rect.left}px`;
        highlight.style.top = `${rect.top}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        highlight.style.display = 'block';
        highlight.style.border = '2px solid #007bff';
        highlight.style.background = 'rgba(0, 123, 255, 0.2)';
      } else if (!target || target === document.body || target === document.documentElement) {
        currentTarget = null;
        selectedRect = null;
        highlight.style.display = 'none';
      }
    }
  }

  function onMouseUp(e) {
    if (e.target.closest('#screenshot-extension-actions')) return;
    
    if (!isMouseDown) return;
    isMouseDown = false;
    
    if (isDragging) {
      if (selectedRect && selectedRect.width > 10 && selectedRect.height > 10) {
        lockSelection();
      } else {
        // Drag was too small, cancel
        highlight.style.display = 'none';
        selectedRect = null;
      }
    } else {
      // Just a click, lock the currently hovered element
      if (selectedRect) {
        lockSelection();
      }
    }
  }

  function lockSelection() {
    locked = true;
    
    actionUi.style.opacity = '0';
    actionUi.style.display = 'flex';
    
    const uiWidth = actionUi.offsetWidth || 200;
    const uiHeight = actionUi.offsetHeight || 40;
    
    let topPos = selectedRect.bottom + 10;
    if (topPos + uiHeight > window.innerHeight) {
      topPos = selectedRect.top - uiHeight - 10;
    }
    
    let leftPos = selectedRect.right - uiWidth;
    if (leftPos < 0) {
      leftPos = selectedRect.left;
      if (leftPos < 0) leftPos = 10;
    }
    
    actionUi.style.top = `${topPos}px`;
    actionUi.style.left = `${leftPos}px`;
    actionUi.style.opacity = '1';
    
    highlight.style.border = isDragging ? '2px dashed #ff3366' : '2px solid #ff3366';
    highlight.style.background = 'rgba(255, 51, 102, 0.1)';
  }

  function onClick(e) {
    if (e.target.closest('#screenshot-extension-actions')) {
      const id = e.target.id;
      
      if (id === 'screenshot-btn-download' || id === 'screenshot-btn-copy') {
        const action = id === 'screenshot-btn-download' ? 'download' : 'copy';
        const rectToCapture = selectedRect;
        cleanup();
        
        if (rectToCapture) {
          chrome.runtime.sendMessage({
            type: "ELEMENT_SELECTED",
            action: action,
            rect: {
              x: rectToCapture.x,
              y: rectToCapture.y,
              width: rectToCapture.width,
              height: rectToCapture.height
            },
            dpr: window.devicePixelRatio
          }, async (response) => {
            if (response && response.success && action === 'copy') {
              try {
                const res = await fetch(response.dataUrl);
                const blob = await res.blob();
                await navigator.clipboard.write([
                  new ClipboardItem({
                    [blob.type]: blob
                  })
                ]);
              } catch (err) {
                console.error('Failed to copy image: ', err);
                alert('Failed to copy to clipboard.');
              }
            }
          });
        }
      } else if (id === 'screenshot-btn-cancel') {
        cleanup();
      }
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
    }
  }

  function cleanup() {
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (highlight.parentNode) highlight.parentNode.removeChild(highlight);
    if (actionUi.parentNode) actionUi.parentNode.removeChild(actionUi);
    window.__screenshotExtensionActive = false;
  }

  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  
})();