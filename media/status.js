(function() {
    const vscode = acquireVsCodeApi();

    const refreshBtn = document.getElementById('refresh-btn');
    const selectModelBtn = document.getElementById('select-model-btn');
    const settingsBtn = document.getElementById('settings-btn');
    
    refreshBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });
    
    selectModelBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'selectModel' });
    });
    
    settingsBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openSettings' });
    });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'statusUpdate') {
            updateStatus(message.data);
        }
    });

    function updateStatus(data) {
        const serviceStatus = document.getElementById('service-status');
        const providerUrl = document.getElementById('provider-url');
        const currentModel = document.getElementById('current-model');
        const modelsList = document.getElementById('models-list');

        if (data.health) {
            serviceStatus.textContent = '✅ Running';
            serviceStatus.className = 'value status-online';
        } else {
            serviceStatus.textContent = '❌ Offline';
            serviceStatus.className = 'value status-offline';
        }

        providerUrl.textContent = data.providerUrl;
        currentModel.textContent = data.currentModel;

        if (data.models && data.models.length > 0) {
            modelsList.innerHTML = data.models
                .map(model => `<div class="model-item">${model}</div>`)
                .join('');
        } else {
            modelsList.innerHTML = '<div class="model-item">No models found</div>';
        }
    }
})();