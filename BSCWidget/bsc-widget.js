/*
 * bsc-widget.js
 *
 * Widget para visualização de Mapa Estratégico (BSC) no Grist.
 * Este script renderiza objetivos e suas conexões com base em dados das tabelas 'Objetivos' e 'Perspectivas'.
 */

// Array para manter a referência de todas as linhas (LeaderLine) ativas.
let activeLines = [];
// Mapa global para armazenar nomes de perspectivas (ID -> Nome)
let perspectiveMap = {};
// Mapa para armazenar os IDs dos elementos HTML das perspectivas (Nome -> ID)
let perspectiveElementIds = {};

/**
 * Helper function to convert Grist's column-based format to row-based.
 * @param {Object} colData - Data in Grist's column-oriented format.
 * @returns {Array<Object>} Data in a row-oriented format.
 */
function colDataToRows(colData) {
    if (!colData || !colData.id || !Array.isArray(colData.id)) {
        return [];
    }
    const rows = [];
    const keys = Object.keys(colData);
    const numRows = colData.id.length;
    for (let i = 0; i < numRows; i++) {
        const row = { id: colData.id[i] };
        for (const key of keys) {
            if (key !== 'id') {
                row[key] = colData[key][i];
            }
        }
        rows.push(row);
    }
    return rows;
}

/**
 * Limpa o mapa, removendo todos os cards de objetivos e as linhas de conexão.
 */
function limparConteudoDinamico() {
    // Remove todas as linhas existentes
    activeLines.forEach(line => line.remove());
    activeLines = [];

    // Limpa o conteúdo de cada perspectiva (os cards de objetivo)
    document.querySelectorAll('.perspectiva-content').forEach(el => {
        el.innerHTML = '';
    });
}

/**
 * Renderiza a estrutura base das perspectivas no container principal.
 * @param {Array<Object>} perspectivasRecords - Array de registros da tabela Perspectivas.
 */
function renderPerspectives(perspectivasRecords) {
    console.log("Renderizando perspectivas...");
    const container = document.getElementById('mapa-container');
    container.innerHTML = ''; // Limpa tudo antes de renderizar
    perspectiveMap = {};
    perspectiveElementIds = {};

    perspectivasRecords.forEach(p => {
        const pId = p.id;
        const pName = p.Name;
        const elementId = `perspectiva-${pId}`;

        perspectiveMap[pId] = pName;
        perspectiveElementIds[pName] = elementId;

        const perspectivaDiv = document.createElement('div');
        perspectivaDiv.id = elementId;
        perspectivaDiv.className = 'perspectiva';
        perspectivaDiv.innerHTML = `<h3>${pName}</h3><div class="perspectiva-content"></div>`;
        container.appendChild(perspectivaDiv);
    });
    console.log("Mapa de Perspectivas construído:", perspectiveMap);
}

/**
 * Renderiza os cards de objetivos e suas conexões.
 * @param {Array<Object>} records - Um array de objetos da tabela 'Objetivos'.
 */
function renderizarMapa(records) {
    console.log("Renderizando objetivos e conexões:", records);
    limparConteudoDinamico();

    const mappedRecords = records.map(r => ({
        ID_Objetivo: r.id,
        Objetivo: r.Nome,
        Perspectiva: perspectiveMap[r.ref_persp],
        ConectaCom: r.ref_obj
    }));

    // 1. Renderiza todos os cards de objetivos
    mappedRecords.forEach(record => {
        const { ID_Objetivo, Objetivo, Perspectiva } = record;
        if (!ID_Objetivo || !Objetivo || !Perspectiva) {
            console.warn('Registro de objetivo ignorado por falta de dados (ID, Nome ou Perspectiva):', record);
            return;
        }
        const containerId = perspectiveElementIds[Perspectiva];
        if (!containerId) {
            console.warn(`Perspectiva "${Perspectiva}" inválida para o objetivo:`, Objetivo);
            return;
        }
        const container = document.getElementById(containerId)?.querySelector('.perspectiva-content');
        if (container) {
            const cardElement = document.createElement('div');
            cardElement.id = `card-${ID_Objetivo}`;
            cardElement.className = 'card-objetivo';
            cardElement.textContent = Objetivo;
            container.appendChild(cardElement);
        }
    });

    // 2. Cria as linhas de conexão
    mappedRecords.forEach(record => {
        const { ID_Objetivo, ConectaCom } = record;
        if (ConectaCom) {
            const startElement = document.getElementById(`card-${ConectaCom}`);
            const endElement = document.getElementById(`card-${ID_Objetivo}`);
            if (startElement && endElement) {
                try {
                    const line = new LeaderLine(startElement, endElement, { color: 'gray', endPlug: 'arrow1', path: 'grid' });
                    activeLines.push(line);
                } catch (e) {
                    console.error("Erro ao criar LeaderLine:", e);
                }
            }
        }
    });
}

// Inicializa o widget quando o Grist estiver pronto
grist.ready({
    requiredAccess: 'full',
    minSize: { height: 600 }
});

// A lógica principal é executada quando o Grist está totalmente pronto
grist.on('ready', async () => {
    console.log("Widget BSC pronto. Modo de fetch direto.");
    const container = document.getElementById('mapa-container');

    try {
        // Busca os dados de ambas as tabelas em paralelo
        const [perspectivasData, objetivosData] = await Promise.all([
            grist.docApi.fetchTable('Perspectivas'),
            grist.docApi.fetchTable('Objetivos')
        ]);

        // Converte os dados para o formato de linha
        const perspectivasRecords = colDataToRows(perspectivasData);
        const objetivosRecords = colDataToRows(objetivosData);

        if (perspectivasRecords.length === 0) {
            container.innerHTML = `<div style="color: orange; padding: 20px;">A tabela 'Perspectivas' está vazia. Adicione perspectivas para visualizar o mapa.</div>`;
            return;
        }

        // Renderiza a estrutura base com as perspectivas
        renderPerspectives(perspectivasRecords);

        // Renderiza os objetivos e as linhas de conexão
        renderizarMapa(objetivosRecords);

    } catch (e) {
        console.error("Erro ao inicializar o widget:", e);
        let errorMessage = "Ocorreu um erro inesperado ao carregar o widget.";
        if (e.message && e.message.includes("TABLE_NOT_FOUND")) {
            errorMessage = `Erro: Uma das tabelas necessárias ('Perspectivas' ou 'Objetivos') não foi encontrada. Verifique se as tabelas existem no documento.`;
        }
        container.innerHTML = `<div style="color: red; padding: 20px;">${errorMessage}</div>`;
    }
});
