chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "solveQuestion") {
        handleSolveQuestion(request.prompt).then(sendResponse);
        return true;
    }

    if (request.action === "startScreenshot") {
        handleStartScreenshot(request.tabId).then(sendResponse);
        return true;
    }

    if (request.action === "screenshotSelectionDone") {
        handleScreenshotSelection(request.rect, sender.tab?.id).then(sendResponse);
        return true;
    }

    if (request.action === "screenshotSelectionCancelled") {
        sendResponse({ ok: true });
        return true;
    }
});

async function handleStartScreenshot(tabId) {
    try {
        if (!tabId) {
            return { error: 'Brak aktywnej karty.' };
        }

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['screenshot-selection.js']
        });

        await chrome.tabs.sendMessage(tabId, { action: 'startScreenshotSelection' });
        return { ok: true };
    } catch (error) {
        console.error('[Test Solver BG] Błąd uruchamiania zrzutu:', error);
        return { error: error.message || 'Nie udało się uruchomić zaznaczania obszaru.' };
    }
}

async function handleScreenshotSelection(rect, tabId) {
    try {
        if (!tabId) {
            return { error: 'Nie znaleziono aktywnej karty.' };
        }

        const selectionRect = {
            x: Math.max(0, Math.round(rect?.x || 0)),
            y: Math.max(0, Math.round(rect?.y || 0)),
            width: Math.max(1, Math.round(rect?.width || 0)),
            height: Math.max(1, Math.round(rect?.height || 0))
        };

        const dataUrl = await chrome.tabs.captureVisibleTab(tabId, {
            format: 'png',
            quality: 100,
            rect: selectionRect
        });

        await chrome.tabs.create({ url: dataUrl, active: true });
        return { ok: true };
    } catch (error) {
        console.error('[Test Solver BG] Błąd tworzenia zrzutu:', error);
        return { error: error.message || 'Nie udało się wykonać zrzutu ekranu.' };
    }
}

async function handleSolveQuestion(prompt) {
    try {
        const data = await chrome.storage.local.get('solverConfig');
        const config = data.solverConfig;

        if (!config || !config.apiKey || !config.model) {
            return { error: 'Brak konfiguracji. Uzupełnij klucz API w ustawieniach wtyczki.' };
        }

        console.log("[Test Solver BG] Wysyłam prompt:", prompt);

        const provider = config.provider || 'openrouter';
        
        if (provider === 'openrouter') {
            return await fetchOpenRouter(prompt, config.apiKey, config.model);
        } else if (provider === 'agentrouter') {
            return await fetchAgentRouter(prompt, config.apiKey, config.model);
        } else if (provider === 'google') {
            return await fetchGoogleAI(prompt, config.apiKey, config.model);
        } else {
            return { error: 'Nieznany dostawca AI' };
        }

    } catch (e) {
        console.error("[Test Solver Background] Błąd:", e);
        return { error: 'Błąd sieci lub API: ' + e.message };
    }
}

async function fetchOpenRouter(prompt, apiKey, model) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 20,
            temperature: 0.1
        })
    });

    if (!response.ok) {
        throw new Error(`OpenRouter HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return { answer: json.choices[0].message.content.trim() };
}

async function fetchAgentRouter(prompt, apiKey, model) {
    const response = await fetch('https://agentrouter.org/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 20,
            temperature: 0.1
        })
    });

    if (!response.ok) {
        throw new Error(`AgentRouter HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return { answer: json.choices[0].message.content.trim() };
}

async function fetchGoogleAI(prompt, apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 300,
                temperature: 1,
                thinkingConfig: {
                    thinkingBudget: 0
                }
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google AI HTTP error! status: ${response.status}, body: ${errText}`);
    }

    const json = await response.json();
    const rawDebug = JSON.stringify(json, null, 2);
    console.log("[Test Solver BG] Surowa odpowiedź Google AI:", rawDebug);
    
    if (json.candidates && json.candidates.length > 0) {
        const candidate = json.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            const text = candidate.content.parts[0].text.trim();
            console.log("[Test Solver BG] Odpowiedź wyodrębniona:", text);
             return { answer: text, debug: rawDebug };
        }
        return { error: `Odpowiedź zablokowana. finishReason: ${candidate.finishReason}`, debug: rawDebug };
    }
    
    return { error: `Nieoczekiwany format: ${rawDebug}`, debug: rawDebug };
}
