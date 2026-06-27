// Obejście systemu detekcji utraty ostrości i popupa
// Uruchamiane jako 'document_start' w świecie 'MAIN' (kontekst strony)
// UWAGA: Ten plik NIE może używać chrome.* API - działa w świecie strony!

console.log("[Test Solver] Inicjalizacja skryptu anty-cheat (document_start, MAIN world)...");

// 1. Blokowanie nasłuchiwania na blur i visibilitychange przez addEventListener
const originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'blur' || type === 'visibilitychange' || type === 'mouseleave' || type === 'focusout') {
        console.log(`[Test Solver] Zablokowano event listener dla: ${type}`);
        return;
    }
    return originalAddEventListener.call(this, type, listener, options);
};

// 2. Nadpisanie właściwości hidden i visibilityState, aby strona zawsze była "widoczna"
Object.defineProperty(document, 'hidden', {
    get: function() { return false; },
    configurable: true
});
Object.defineProperty(document, 'visibilityState', {
    get: function() { return 'visible'; },
    configurable: true
});

// 3. Zablokowanie przypisywania metod do window.onblur itp.
Object.defineProperty(window, 'onblur', {
    set: function() { console.log('[Test Solver] Zablokowano przypisanie do window.onblur'); },
    get: function() { return null; },
    configurable: true
});
Object.defineProperty(document, 'onvisibilitychange', {
    set: function() { console.log('[Test Solver] Zablokowano przypisanie do document.onvisibilitychange'); },
    get: function() { return null; },
    configurable: true
});
Object.defineProperty(window, 'onmouseleave', {
    set: function() { console.log('[Test Solver] Zablokowano przypisanie do window.onmouseleave'); },
    get: function() { return null; },
    configurable: true
});

// 4. Atrapa na obiekty okien dialogowych Testportalu (MDC Dialog)
const fakeDialog = {
    open: function() { console.log('[Test Solver] Zablokowano wywołanie open() na popupie!'); },
    close: function() {},
    scrimClickAction: ""
};

Object.defineProperty(window, 'honestRespondentBlockade_popup', {
    get: function() { return fakeDialog; },
    set: function(val) { console.log('[Test Solver] Zablokowano próbę przypisania honestRespondentBlockade_popup'); },
    configurable: true
});

Object.defineProperty(window, 'honestRespondentWarning_popup', {
    get: function() { return fakeDialog; },
    set: function(val) { console.log('[Test Solver] Zablokowano próbę przypisania honestRespondentWarning_popup'); },
    configurable: true
});

// Atrapa dla samego obiektu BlurSpy
let originalBlurSpy;
Object.defineProperty(window, 'BlurSpy', {
    get: function() {
        return function() {
            this.start = function() { console.log('[Test Solver] Atrapa BlurSpy: start() zablokowane'); };
            this.getBlursCount = function() { return 0; };
        };
    },
    set: function(val) { originalBlurSpy = val; },
    configurable: true
});

// 5. Usuwanie popupa ostrzegawczego, gdy tylko pojawi się w DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
                const blockPopup = node.id === 'honestRespondentBlockade_popup' ? node : node.querySelector('#honestRespondentBlockade_popup');
                const warnPopup = node.id === 'honestRespondentWarning_popup' ? node : node.querySelector('#honestRespondentWarning_popup');
                
                if (blockPopup) {
                    blockPopup.style.display = 'none';
                    blockPopup.remove();
                    console.log('[Test Solver] Usunięto popup honestRespondentBlockade_popup z DOM!');
                }
                
                if (warnPopup) {
                    warnPopup.style.display = 'none';
                    warnPopup.remove();
                    console.log('[Test Solver] Usunięto popup honestRespondentWarning_popup z DOM!');
                }
            }
        });
    });
});

const startObserver = () => {
    if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
        console.log("[Test Solver] AntiCheat MutationObserver aktywny.");
    } else {
        setTimeout(startObserver, 10);
    }
};
startObserver();
