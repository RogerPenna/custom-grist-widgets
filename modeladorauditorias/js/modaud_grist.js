// js/modaud_grist.js

export async function conectar() {
    return new Promise(resolve => {
        grist.ready();
        resolve();
    });
}

export async function getRecords(tabela) {
    try {
        return await grist.docApi.fetchTable(tabela);
    } catch (error) {
        console.error(`Erro ao buscar dados da tabela ${tabela}:`, error);
        return [];
    }
}

export async function updateRecords(tabela, updates) {
    // 'updates' é um array de objetos: [{id: 1, fields: {Ordem: 10, ID_Pai: 0}}, ...]
    if (!updates || updates.length === 0) {
        console.log("Nenhuma alteração para salvar.");
        return;
    }
    try {
        await grist.docApi.updateRows(tabela, updates);
        console.log("Alterações salvas no Grist com sucesso!");
    } catch (error) {
        console.error(`Erro ao salvar alterações na tabela ${tabela}:`, error);
    }
}