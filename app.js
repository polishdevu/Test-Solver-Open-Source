const models = {
    openrouter: [
        { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' }
    ],
    google: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Polecany)' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ]
};

const pages = ['mainMenu', 'settingsPage', 'aboutPage'];
const showPage = (id) => {
    pages.forEach(p => document.getElementById(p).classList.toggle('hidden', p !== id));
};

const providerSelect = document.getElementById('providerSelect');
const modelSelect = document.getElementById('modelSelect');
const apiKeyInput = document.getElementById('apiKey');
const solverToggle = document.getElementById('solverToggle');
const statusText = document.getElementById('statusText');

function updateModelList() {
    const selectedProvider = providerSelect.value;
    modelSelect.innerHTML = '';
    models[selectedProvider].forEach(model => {
        const opt = document.createElement('option');
        opt.value = model.id;
        opt.textContent = model.name;
        modelSelect.appendChild(opt);
    });
}

providerSelect.addEventListener('change', updateModelList);

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    let result = await chrome.storage.local.get('solverConfig');
    let saved = result.solverConfig || {};
    saved.provider = providerSelect.value;
    saved.apiKey = apiKeyInput.value;
    saved.model = modelSelect.value;
    
    await chrome.storage.local.set({ solverConfig: saved });
    showStatus('Zapisano pomyślnie!', 'success');
});

document.getElementById('testApiBtn').addEventListener('click', async () => {
    const key = apiKeyInput.value;
    const provider = providerSelect.value;
    const msg = document.getElementById('statusMsg');
    if (!key) {
        showStatus('Wprowadź klucz API', 'danger');
        return;
    }
    
    if (!provider || !modelSelect.value) {
        showStatus('Wybierz dostawcę i model', 'danger');
        return;
    }
    
    msg.textContent = 'Łączenie...';
    
    let url = provider === 'openrouter' 
        ? 'https://openrouter.ai/api/v1/models' 
        : `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    try {
        const headers = provider === 'openrouter' ? { 'Authorization': `Bearer ${key}` } : {};
        const response = await fetch(url, { headers });
        
        if (response.ok) {
            showStatus('Połączenie poprawne!', 'success');
        } else {
            showStatus('Błąd klucza API', 'danger');
        }
    } catch (e) {
        showStatus('Błąd sieci', 'danger');
    }
});
function showStatus(txt, type) {
    const msg = document.getElementById('statusMsg');
    msg.textContent = txt;
    msg.style.color = type === 'success' ? '#22c55e' : '#ef4444';
}

document.addEventListener('DOMContentLoaded', async () => {
    updateModelList();
    let result = await chrome.storage.local.get('solverConfig');
    const saved = result.solverConfig;
    if (saved) {
        if (saved.provider) providerSelect.value = saved.provider;
        updateModelList();
        if (saved.model) modelSelect.value = saved.model;
        if (saved.apiKey) apiKeyInput.value = saved.apiKey;
        if (saved.solverActive !== undefined) {
            solverToggle.checked = saved.solverActive;
            statusText.textContent = saved.solverActive ? 'Aktywny' : 'Nieaktywny';
            statusText.className = saved.solverActive ? 'status-on' : 'status-off';
        }
    }
});

document.getElementById('settingsBtn').onclick = () => showPage('settingsPage');
document.getElementById('aboutBtn').onclick = () => showPage('aboutPage');
document.getElementById('backFromSettings').onclick = () => showPage('mainMenu');
document.getElementById('backFromAbout').onclick = () => showPage('mainMenu');

solverToggle.onchange = async (e) => {
    const isActive = e.target.checked;
    statusText.textContent = isActive ? 'Aktywny' : 'Nieaktywny';
    statusText.className = isActive ? 'status-on' : 'status-off';
    
    let result = await chrome.storage.local.get('solverConfig');
    let saved = result.solverConfig || {};
    saved.solverActive = isActive;
    await chrome.storage.local.set({ solverConfig: saved });
};