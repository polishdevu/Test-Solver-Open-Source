// AI SOLVER - LOGIKA ROZWIĄZYWANIA TESTÓW
// Uruchamiane w świecie 'ISOLATED' - ma pełny dostęp do chrome.storage i chrome.runtime

console.log("[Test Solver] Inicjalizacja AI Solvera (ISOLATED world)...");

let isProcessing = false;
let currentQuestionText = "";
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 5000; // Minimum 5s między zapytaniami - ochrona przed 429

async function solveQuestion() {
    if (isProcessing) return;

    // Rate limiting - nie wysyłaj zapytań zbyt często
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL_MS) {
        console.log("[Test Solver] Rate limit - zbyt szybko, pomijam.");
        return;
    }

    // Sprawdzenie czy solver jest aktywny
    const data = await chrome.storage.local.get('solverConfig');
    const config = data.solverConfig;
    if (!config || config.solverActive !== true) {
        return;
    }

    // Pobierz CAŁĄ treść pytania (wszystkie paragrafy, tagi em itp.)
    const questionBlock = document.querySelector(".question_essence");
    if (!questionBlock) return;

    const newQuestionText = questionBlock.innerText.trim();
    if (!newQuestionText || newQuestionText === currentQuestionText) return;

    isProcessing = true;
    currentQuestionText = newQuestionText;
    lastRequestTime = Date.now();

    try {
        console.log("[Test Solver] Nowe pytanie:\n", newQuestionText);

        let prompt = "";
        let isClosed = false;
        let isMultiAnswer = false;

        const answerContainers = document.querySelectorAll(".question_answers .answer_container");
        // WAŻNE: najpierw sprawdź czy to pytanie otwarte (input tekstowy)
        // Input otwarty ma priorytet - jak istnieje, to nie ma ABCD
        const openInput = document.querySelector(".question_answers input[id^='shortAnswerBody']");

        if (openInput) {
            // === PYTANIE OTWARTE ===
            isClosed = false;
            prompt = `Jesteś asystentem odpowiadającym na pytania otwarte.
WAŻNE ZASADY:
- Odpowiedz TYLKO merytoryczną treścią (słowem, liczbą lub krótkim zdaniem)
- ABSOLUTNIE NIE używaj liter A, B, C, D, E, F jako odpowiedzi
- NIE pisz "Odpowiedź:" ani żadnych innych wstępów
- Odpowiedz jak najkrócej

Pytanie: ${newQuestionText}`;

        } else if (answerContainers.length > 0) {
            // === PYTANIE ZAMKNIĘTE (ABCD) ===
            isClosed = true;

            // Sprawdź czy pytanie wymaga zaznaczenia WIELU odpowiedzi
            const multiKeywords = /wskaż\s+\w*(dwie?|trzy|cztery|kilka|dwa|wszystkie)\b|zaznacz\s+\w*(dwie?|trzy|cztery|kilka|dwa|wszystkie)\b|wybierz\s+\w*(dwie?|trzy|cztery|kilka|dwa|wszystkie)\b|(dwie?|trzy|cztery|kilka)\s+\w*odpowiedzi/i;
            isMultiAnswer = multiKeywords.test(newQuestionText);

            const answersText = Array.from(answerContainers).map((container, index) => {
                const label = String.fromCharCode(65 + index);
                const answerTextEl = container.querySelector(".answer_body p") || container.querySelector(".answer_body") || container;
                return `${label}: ${answerTextEl.innerText.trim()}`;
            }).join("\n");

            if (isMultiAnswer) {
                prompt = `Odpowiedz podając TYLKO LITERY poprawnych odpowiedzi oddzielone spacją (np: "B C" lub "A D"). Zero dodatkowego tekstu.\nPytanie:\n${newQuestionText}\nOdpowiedzi:\n${answersText}`;
            } else {
                prompt = `Odpowiedz podając TYLKO JEDNĄ LITERĘ poprawnej odpowiedzi (A, B, C lub D). Zero dodatkowego tekstu.\nPytanie:\n${newQuestionText}\nOdpowiedzi:\n${answersText}`;
            }

        } else {
            isProcessing = false;
            return;
        }

        console.log("[Test Solver] Wysyłam prompt:\n", prompt);
        const response = await chrome.runtime.sendMessage({ action: "solveQuestion", prompt: prompt });

        console.log("[Test Solver] Odpowiedź z background.js:", JSON.stringify(response));

        if (response && response.error) {
            console.error("[Test Solver] Błąd API:", response.error);
            alert(`[Test Solver] Błąd API: ${response.error}`);
            return;
        }

        if (response && response.answer) {
            const aiAnswer = response.answer.trim().toUpperCase();
            console.log("[Test Solver] Odpowiedź AI:", aiAnswer);

            if (isClosed) {
                // Wyciągamy wszystkie litery z odpowiedzi (obsługa "BC", "B C", "B, C")
                const letters = aiAnswer.match(/[A-Z]/g);
                if (letters && letters.length > 0) {
                    letters.forEach(letter => {
                        const index = letter.charCodeAt(0) - 65;
                        if (index >= 0 && index < answerContainers.length) {
                            const targetContainer = answerContainers[index].querySelector("label") || answerContainers[index];
                            targetContainer.style.backgroundColor = "#4CAF50";
                            targetContainer.style.color = "white";
                            targetContainer.style.borderRadius = "6px";
                            targetContainer.style.transition = "background-color 0.3s";
                            targetContainer.style.padding = "5px";
                            console.log("[Test Solver] Zaznaczono odpowiedź:", letter);
                        }
                    });
                }
            } else if (openInput) {
                openInput.placeholder = `💡 AI: ${response.answer}`;
                openInput.style.borderColor = "#4CAF50";
                openInput.style.borderWidth = "2px";
                openInput.title = response.answer;
            }
        }

    } catch (err) {
        console.error("[Test Solver] Błąd krytyczny:", err);
        alert(`[Test Solver] Błąd krytyczny: ${err.message}`);
    } finally {
        setTimeout(() => { isProcessing = false; }, 3000);
    }
}

// Obserwator do wykrywania nowych pytań
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
        console.log("[Test Solver] Solver MutationObserver aktywny.");
        setTimeout(solveQuestion, 1500);
    } else {
        setTimeout(startQuestionObserver, 50);
    }
};
startQuestionObserver();
