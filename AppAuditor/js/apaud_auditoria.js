// js/apaud_auditoria.js (v3.0 - Lógica Hierárquica)

import { mostrarStatusCarregamento } from './apaud_ui.js';

let pacoteDeAuditoria = null;
let auditoriaAtiva = {
    areaId: null,
    respostas: new Map(), // Armazena as respostas: {perguntaId: valor}
    instanciasRepetidas: new Map() // Armazena contagem de seções repetidas: {secaoId: count}
};

// --- Funções de Carregamento e Acesso a Dados ---
export function carregarPacoteJSON() {
    const textarea = document.getElementById('json-input');
    const textoJSON = textarea.value;

    if (!textoJSON.trim()) {
        mostrarStatusCarregamento("Erro: O campo está vazio.", 'erro');
        return false;
    }
    try {
        const dadosCarregados = JSON.parse(textoJSON);
        if (!dadosCarregados.versao_pacote || !dadosCarregados.dados_suporte) {
            throw new Error("O JSON parece ser inválido ou não é um Pacote de Auditoria.");
        }
        pacoteDeAuditoria = dadosCarregados;
        mostrarStatusCarregamento("Pacote carregado com sucesso!", 'sucesso');
        console.log("Pacote de Auditoria carregado:", pacoteDeAuditoria);
        return true;
    } catch (error) {
        mostrarStatusCarregamento(`Erro ao processar o JSON: ${error.message}`, 'erro');
        console.error("Erro no JSON.parse:", error);
        return false;
    }
}

export function getPlanejamentos() {
    if (!pacoteDeAuditoria) return [];
    return pacoteDeAuditoria.dados_suporte.planejamento_pai;
}

// --- Funções de Gerenciamento da Auditoria Ativa ---
export function iniciarAuditoriaParaArea(idDaArea) {
    if (!pacoteDeAuditoria) return false;
    // Reseta o estado para uma nova auditoria
    auditoriaAtiva = {
        areaId: idDaArea,
        respostas: new Map(),
        instanciasRepetidas: new Map()
    };
    console.log(`Auditoria iniciada para Área ID: ${idDaArea}.`);
    return true;
}

export function getChecklistParaAreaAtiva() {
    if (!auditoriaAtiva.areaId || !pacoteDeAuditoria) return [];
    // A fonte da verdade é o modelo mestre de perguntas
    return pacoteDeAuditoria.dados_suporte.perguntas.filter(p => p.Referencia_Area == auditoriaAtiva.areaId);
}

export function salvarResposta(perguntaId, valor) {
    auditoriaAtiva.respostas.set(String(perguntaId), valor);
    console.log(`Resposta salva: Pergunta ${perguntaId} = ${valor}`);
}

export function getResposta(perguntaId) {
    return auditoriaAtiva.respostas.get(String(perguntaId));
}

export function avaliarCondicao(pergunta) {
    // Se a pergunta não tem dependência, ela é sempre visível
    const idPerguntaMae = pergunta.Visibilidade_DependeDe;
    if (!idPerguntaMae || idPerguntaMae === 0) {
        return true;
    }
    
    const valorEsperado = pergunta.Visibilidade_Valor;
    const valorAtual = getResposta(idPerguntaMae);
    
    // Compara o valor atual (que pode ser undefined se não respondido) com o valor esperado
    return valorAtual === valorEsperado;
}

export function adicionarInstanciaSecao(secaoId) {
    const contagemAtual = auditoriaAtiva.instanciasRepetidas.get(secaoId) || 0;
    auditoriaAtiva.instanciasRepetidas.set(secaoId, contagemAtual + 1);
    return contagemAtual + 1;
}

export function getContagemInstancias(secaoId) {
    return auditoriaAtiva.instanciasRepetidas.get(secaoId) || 0;
}

// --- Funções de Acesso a Dados de Suporte ---
export function getDadosCompletosPergunta(perguntaId) {
    if (!pacoteDeAuditoria) return null;
    const { perguntas, grupos_respostas, opcoes_respostas } = pacoteDeAuditoria.dados_suporte;
    const modelo = perguntas.find(p => p.id == perguntaId);
    if (!modelo) return { modelo: { Texto_Pergunta: `ERRO: Pergunta ID ${perguntaId} não encontrada.` }, opcoes: [] };

    const grupo = grupos_respostas.find(g => g.id == modelo.Tipo_Resposta_Utilizado);
    let opcoes = [];
    if (grupo) {
        opcoes = opcoes_respostas.filter(o => o.RefTiposRespostasGrupos == grupo.id).sort((a, b) => a.Ordem - b.Ordem);
    }
    return { modelo, opcoes };
}

export function contarPerguntasParaArea(idDaArea) {
    if (!pacoteDeAuditoria) return 0;
    // A fonte da verdade é o modelo mestre de perguntas
    // Conta apenas itens que são do tipo 'Pergunta' para não contar seções
    return pacoteDeAuditoria.dados_suporte.perguntas.filter(
        item => item.Referencia_Area == idDaArea && item.Tipo_Item === 'Pergunta'
    ).length;
}

export function getDetalhesDoPlanejamento(idDoPai) {
    if (!pacoteDeAuditoria) return null;

    const { planejamento_pai, departamentos, auditores } = pacoteDeAuditoria.dados_suporte;
    const planejamento = planejamento_pai.find(p => p.id == idDoPai);
    if (!planejamento) return null;

    const idDaArea = planejamento.Departamento;
    
    const departamentoInfo = departamentos.find(d => d.id == idDaArea);
    const auditorLiderInfo = auditores.find(a => a.id == planejamento.Auditor_Lider);
    const auditorAcompInfo = auditores.find(a => a.id == planejamento.Auditor_Acompanhante);
    const perguntasNestaArea = contarPerguntasParaArea(idDaArea);

    return {
        responsavel: departamentoInfo ? (departamentoInfo.gristHelper_Display2 || 'N/A') : 'N/A',
        auditorLider: auditorLiderInfo ? auditorLiderInfo.NomeAuditorRef : 'Não definido',
        auditorAcompanhante: auditorAcompInfo ? auditorAcompInfo.NomeAuditorRef : 'Não definido',
        totalPerguntas: perguntasNestaArea
    };
}
export function calcularProgresso() {
    if (!pacoteDeAuditoria || !auditoriaAtiva.areaId) return { respondidas: 0, total: 0, percentual: 0 };

    // Pega todas as perguntas (não seções) para a área ativa
    const perguntasDaAuditoria = pacoteDeAuditoria.dados_suporte.perguntas.filter(
        item => item.Referencia_Area == auditoriaAtiva.areaId && item.Tipo_Item === 'Pergunta'
    );
    
    let totalPerguntasVisiveis = 0;
    let perguntasRespondidas = 0;

    // Precisamos percorrer a árvore para saber o que está visível
    const itensRaiz = perguntasDaAuditoria.filter(item => !item.ID_Pai || item.ID_Pai === 0);

    function percorrerItens(itens) {
        itens.forEach(item => {
            // Se o item não estiver visível, pula ele e seus filhos
            if (!avaliarCondicao(item)) return;

            // Se for uma pergunta, conta
            if (item.Tipo_Item === 'Pergunta') {
                totalPerguntasVisiveis++;
                // Verifica se tem resposta para a pergunta principal
                if (auditoriaAtiva.respostas.has(String(item.id))) {
                    perguntasRespondidas++;
                }
            }

            // Se for uma seção, verifica as instâncias repetidas
            if (item.Tipo_Item === 'Secao' || item.Tipo_Item === 'secao') {
                const filhosDaSecao = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id);
                // Percorre os filhos diretos da seção
                percorrerItens(filhosDaSecao);

                // Percorre os filhos de cada instância repetida
                const contagemInstancias = getContagemInstancias(item.id) || 0;
                for (let i = 1; i <= contagemInstancias; i++) {
                    filhosDaSecao.forEach(filho => {
                        if (filho.Tipo_Item === 'Pergunta') {
                             totalPerguntasVisiveis++;
                             // O ID da pergunta na instância é "ID-NUMERO"
                             const idInstancia = `${filho.id}-${i}`;
                             if (auditoriaAtiva.respostas.has(idInstancia)) {
                                 perguntasRespondidas++;
                             }
                        }
                    });
                }
            }

            // Continua a recursão para filhos de perguntas (lógica condicional aninhada)
            const filhosDaPergunta = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id);
            if (filhosDaPergunta.length > 0) {
                 percorrerItens(filhosDaPergunta);
            }
        });
    }

    percorrerItens(itensRaiz);

    const percentual = totalPerguntasVisiveis > 0 ? (perguntasRespondidas / totalPerguntasVisiveis) * 100 : 0;
    
    return {
        respondidas: perguntasRespondidas,
        total: totalPerguntasVisiveis,
        percentual: percentual.toFixed(0) // Arredonda para inteiro
    };
}