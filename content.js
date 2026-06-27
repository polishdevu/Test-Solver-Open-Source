// Obejście systemu detekcji utraty ostrości i popupa -> Uruchamiane jako 'document_start' w świecie 'MAIN' (kontekst strony)

console.log("[Test Solver] Inicjalizacja skryptu anty-cheat (document_start)...");

// 1. Blokowanie nasłuchiwania na blur i visibilitychange przez addEventListener
const originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'blur' || type === 'visibilitychange' || type === 'mouseleave' || type === 'focusout') {
        console.log(`[Test Solver] Zablokowano event listener dla: ${type}`);
        return; // Ignorujemy dodanie eventu
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

// 3. Zablokowanie przypisywania metod do window.onblur i innego śledzącego stuffu
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

// 4. Atrapa na obiekty okien dialogowych Testportalu (MDC Dialog) -> Przy wywołaniu .open(), błąd się nie pojawi, a okno się nie otworzy.
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

// Atrapa dla samego obiektu BlurSpy jeżeli event listener przepuści cokolwiek
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

// Usuwanie popupa ostrzegawczego, gdy tylko pojawi się w DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // ELEMENT_NODE
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
        console.log("[Test Solver] MutationObserver aktywny.");
    } else {
        setTimeout(startObserver, 10);
    }
};
startObserver();

// ==========================================
// Solving methods
// ==========================================

let isProcessing = false;
let currentQuestionText = "";

async function solveQuestion() {
    if (isProcessing) return;
    
    // Sprawdzenie czy solver jest aktywny
    const data = await chrome.storage.local.get('solverConfig');
    const config = data.solverConfig;
    if (!config || config.solverActive !== true) {
        return; // Solver wyłączony
    }

    const questionEl = document.querySelector(".question_essence p") || document.querySelector(".question_essence");
    if (!questionEl) return;
    
    const newQuestionText = questionEl.innerText.trim();
    if (!newQuestionText || newQuestionText === currentQuestionText) return;
    
    isProcessing = true;
    currentQuestionText = newQuestionText;
    
    try {
        console.log("[Test Solver] Znaleziono nowe pytanie, analizuję...");
        
        let prompt = "";
        let isClosed = false;
        const answerContainers = document.querySelectorAll(".question_answers .answer_container");
        const openInput = document.querySelector(".question_answers input[id^='shortAnswerBody']");
        
        if (answerContainers.length > 0) {
            isClosed = true;
            prompt = `Odpowiedz podając TYLKO JEDNĄ LITERĘ poprawnej odpowiedzi (A, B, C, D itp.). Zero dodatkowego tekstu.\nPytanie:\n${currentQuestionText}\nOdpowiedzi:\n`;
            
            answerContainers.forEach((container, index) => {
                const label = String.fromCharCode(65 + index); // A, B, C, D...
                const answerTextEl = container.querySelector(".answer_body p") || container.querySelector(".answer_body") || container;
                prompt += `${label}: ${answerTextEl.innerText.trim()}\n`;
            });
            prompt += `\nOdpowiedz wyłącznie jedną literą, np: B`;
        } else if (openInput) {
            isClosed = false;
            prompt = `Jesteś quizowym AI które rozwiązuje pytania otwarte. Odpowiedz krótko i zwięźle na pytanie:\n\n${currentQuestionText}`;
        } else {
            isProcessing = false;
            return;
        }

        console.log("[Test Solver] Wysyłam zapytanie do AI...");
        const response = await chrome.runtime.sendMessage({ action: "solveQuestion", prompt: prompt });
        
        if (response && response.error) {
            console.error("[Test Solver] Błąd API:", response.error);
            alert(`[Test Solver AI] Błąd: ${response.error}`);
            isProcessing = false;
            return;
        }

        console.log("[Test Solver] Pełna odpowiedź z background.js:", JSON.stringify(response));
        alert(`[DEBUG] Pełna odpowiedź:\n${JSON.stringify(response, null, 2)}`);

        if (response && response.answer) {
            const aiAnswer = response.answer.trim().toUpperCase();
            console.log("[Test Solver] Odpowiedź AI:", aiAnswer);
            
            if (isClosed) {
                // Pobieramy tylko literę (np. jeśli model zwróci "B." to bierzemy "B")
                const letterMatch = aiAnswer.match(/[A-Z]/);
                if (letterMatch) {
                    const index = letterMatch[0].charCodeAt(0) - 65; // A -> 0, B -> 1
                    if (index >= 0 && index < answerContainers.length) {
                        const targetContainer = answerContainers[index].querySelector("label") || answerContainers[index];
                        targetContainer.style.backgroundColor = "#4CAF50";
                        targetContainer.style.color = "white";
                        targetContainer.style.borderRadius = "6px";
                        targetContainer.style.transition = "background-color 0.3s";
                        targetContainer.style.padding = "5px";
                    }
                }
            } else if (openInput) {
                openInput.placeholder = `💡 AI: ${response.answer}`;
                openInput.style.borderColor = "#4CAF50";
                openInput.style.borderWidth = "2px";
                openInput.title = response.answer; // tooltip
            }
        }
        
    } catch (err) {
        console.error("[Test Solver] Wystąpił błąd podczas rozwiązywania:", err);
    } finally {
        setTimeout(() => { isProcessing = false; }, 1000); // Mały debounce
    }
}
const questionObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
            if (document.querySelector(".question_essence")) {
                solveQuestion();
                break;
            }
        }
    }
});


const startQuestionObserver = () => {
    if (document.body) {
        questionObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        setTimeout(solveQuestion, 1000); 
    } else {
        setTimeout(startQuestionObserver, 50);
    }
};
startQuestionObserver();

