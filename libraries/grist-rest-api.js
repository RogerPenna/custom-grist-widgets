export const GristRestApi = (() => {
    let _apiKey = null;
    let _baseUrl = null;

    /**
     * Initializes the API module by figuring out the baseUrl and prompting for the API key if missing.
     */
    async function init(grist) {
        if (!_baseUrl) {
            try {
                const tokenInfo = await grist.docApi.getAccessToken({ readOnly: false });
                _baseUrl = tokenInfo.baseUrl; // e.g. https://docs.getgrist.com/api/docs/docId
            } catch (e) {
                console.error("GristRestApi: Failed to get baseUrl from grist.docApi", e);
                throw new Error("Não foi possível obter a URL do documento. Verifique se o widget tem permissão de acesso completo.");
            }
        }
    }

    /**
     * Ensures we have the API key in memory.
     */
    async function requireApiKey() {
        if (_apiKey) return _apiKey;
        
        return new Promise((resolve, reject) => {
            const key = prompt(
                "🔑 AUTORIZAÇÃO NECESSÁRIA\\n\\n" +
                "Para criar colunas automaticamente, o widget precisa da sua API Key do Grist.\\n" +
                "Vá em Profile Settings no Grist, crie/copie sua chave e cole abaixo:\\n" +
                "(Ela não será salva, ficará apenas na memória desta sessão)"
            );

            if (key !== null && key.trim() !== "") {
                _apiKey = key.trim();
                resolve(_apiKey);
            } else {
                reject(new Error("Ação cancelada: API Key é obrigatória para criar colunas."));
            }
        });
    }

    async function request(path, options = {}) {
        await requireApiKey();
        
        const url = `${_baseUrl}${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${_apiKey}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API (${response.status}): ${errorText}`);
        }

        if (response.status === 204) return null;
        return response.json();
    }

    /**
     * Creates a column in a specific table.
     * @param {string} tableId The table ID
     * @param {string} colId The ID for the new column (e.g. 'DiasAtraso')
     * @param {object} colProps Grist column properties (type, isFormula, etc.)
     */
    async function createColumn(tableId, colId, colProps) {
        console.log(`[GristRestApi] Criando coluna ${colId} na tabela ${tableId}...`, colProps);
        
        // Construct the column definition
        const columnData = {
            id: colId,
            fields: colProps
        };

        const result = await request(`/tables/${tableId}/columns`, {
            method: 'POST',
            body: JSON.stringify({
                columns: [columnData]
            })
        });

        console.log("[GristRestApi] Coluna criada com sucesso!", result);
        return result;
    }
    
    /**
     * Helper to clear the stored API key (e.g. if the user wants to logout)
     */
    function clearApiKey() {
        _apiKey = null;
    }

    return {
        init,
        requireApiKey,
        request,
        createColumn,
        clearApiKey
    };
})();
