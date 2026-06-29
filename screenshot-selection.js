(function () {
    if (window.__testSolverScreenshotInjected) {
        return;
    }
    window.__testSolverScreenshotInjected = true;

    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;

    const overlay = document.createElement('div');
    overlay.id = 'test-solver-screenshot-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '2147483647',
        background: 'rgba(0, 0, 0, 0.25)',
        cursor: 'crosshair',
        display: 'none',
        pointerEvents: 'auto'
    });

    const instructions = document.createElement('div');
    instructions.textContent = 'Przeciągnij, aby zaznaczyć obszar';
    Object.assign(instructions.style, {
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 14px',
        background: 'rgba(17, 24, 39, 0.9)',
        color: '#ffffff',
        borderRadius: '999px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        zIndex: '2147483648'
    });

    const selectionBox = document.createElement('div');
    Object.assign(selectionBox.style, {
        position: 'absolute',
        border: '2px solid #3b82f6',
        background: 'rgba(59, 130, 246, 0.16)',
        boxSizing: 'border-box',
        display: 'none'
    });

    overlay.appendChild(instructions);
    overlay.appendChild(selectionBox);

    const cleanup = () => {
        overlay.style.display = 'none';
        selectionBox.style.display = 'none';
        isSelecting = false;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.removeEventListener('keydown', handleKeyDown);
        overlay.remove();
    };

    const updateSelectionBox = () => {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.max(2, Math.abs(currentX - startX));
        const height = Math.max(2, Math.abs(currentY - startY));

        selectionBox.style.display = 'block';
        selectionBox.style.left = `${x}px`;
        selectionBox.style.top = `${y}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
    };

    function handleMove(event) {
        if (!isSelecting) {
            return;
        }
        currentX = event.clientX;
        currentY = event.clientY;
        updateSelectionBox();
    }

    function handleUp(event) {
        if (!isSelecting) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();

        const x = Math.min(startX, event.clientX);
        const y = Math.min(startY, event.clientY);
        const width = Math.max(2, Math.abs(event.clientX - startX));
        const height = Math.max(2, Math.abs(event.clientY - startY));

        cleanup();
        chrome.runtime.sendMessage({
            action: 'screenshotSelectionDone',
            rect: { x, y, width, height }
        });
    }

    function handleKeyDown(event) {
        if (event.key === 'Escape') {
            cleanup();
            chrome.runtime.sendMessage({ action: 'screenshotSelectionCancelled' });
        }
    }

    function startSelection(event) {
        event.preventDefault();
        event.stopPropagation();
        isSelecting = true;
        startX = event.clientX;
        startY = event.clientY;
        currentX = startX;
        currentY = startY;

        overlay.style.display = 'block';
        selectionBox.style.display = 'block';
        selectionBox.style.left = `${startX}px`;
        selectionBox.style.top = `${startY}px`;
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
        document.addEventListener('keydown', handleKeyDown);
    }

    function showOverlay() {
        if (!document.documentElement) {
            return;
        }

        document.documentElement.appendChild(overlay);
        overlay.style.display = 'block';
        overlay.addEventListener('mousedown', startSelection);
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startScreenshotSelection') {
            showOverlay();
            sendResponse({ ok: true });
            return true;
        }

        return false;
    });
})();
