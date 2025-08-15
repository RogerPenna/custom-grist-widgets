// js/apaud_auditoria.js (v4.0 - Com tela de confirmação)

import { mostrarStatusCarregamento } from './apaud_ui.js';

let pacoteDeAuditoria = null;
let auditoriaAtiva = {
    // Dados do Planejamento
    areaId: null,
    planejamentoId: null,
    // Dados da Execução (preenchidos na tela de confirmação)
    dataRealizada: null,
    auditorLiderId: null,
    auditorAcompanhanteId: null,
    // Dados Coletados
    respostas: new Map(),
    anotacoes: new Map(),
    midias: new Map(),
    instanciasRepetidas: new Map()
};
let ultimaInstanciaAdicionada = null;

// --- Funções de Carregamento e Acesso a Dados ---
export function carregarPacoteJSON() {
    const textarea = document.getElementById('json-input');
    const textoJSON = textarea.value;
    if (!textoJSON.trim()) {
        mostrarStatusCarregamento("Erro: O campo está vazio.", 'erro');
        return false;
    }
    try {
        pacoteDeAuditoria = JSON.parse(textoJSON);
        if (!pacoteDeAuditoria.versao_pacote || !pacoteDeAuditoria.dados_suporte) {
            throw new Error("O JSON parece ser inválido ou não é um Pacote de Auditoria.");
        }
        mostrarStatusCarregamento("Pacote carregado com sucesso!", 'sucesso');
        return true;
    } catch (error) {
        mostrarStatusCarregamento(`Erro ao processar o JSON: ${error.message}`, 'erro');
        return false;
    }
}

export function getPlanejamentos() {
    if (!pacoteDeAuditoria) return [];
    return pacoteDeAuditoria.dados_suporte.planejamento_pai;
}

// NOVO: Busca a lista completa de auditores
export function getAuditores() {
    if (!pacoteDeAuditoria) return [];
    return pacoteDeAuditoria.dados_suporte.auditores;
}

// NOVO: Busca os detalhes de um planejamento específico pelo ID do PAI (que é o ID do card)
export function getPlanejamentoPorId(planejamentoId) {
    if (!pacoteDeAuditoria) return null;
    return getPlanejamentos().find(p => p.id == planejamentoId);
}


// --- Funções de Gerenciamento da Auditoria Ativa ---
// MODIFICADO: Agora esta função apenas armazena os IDs e reseta o estado.
export function iniciarAuditoriaParaArea(areaId, planejamentoId) {
    auditoriaAtiva = {
        areaId: areaId,
        planejamentoId: planejamentoId,
        dataRealizada: null,
        auditorLiderId: null,
        auditorAcompanhanteId: null,
        respostas: new Map(),
        anotacoes: new Map(),
        midias: new Map(),
        instanciasRepetidas: new Map()
    };
    console.log(`Pré-inicialização da auditoria para Área ID: ${areaId}. Aguardando confirmação.`);
    return true;
}

// NOVO: Salva os detalhes finais da execução da auditoria.
export function salvarDetalhesExecucao(detalhes) {
    auditoriaAtiva.dataRealizada = detalhes.data;
    auditoriaAtiva.auditorLiderId = detalhes.liderId;
    auditoriaAtiva.auditorAcompanhanteId = detalhes.acompId;
    console.log("Detalhes da execução da auditoria confirmados:", auditoriaAtiva);
}

// ... (O resto das funções como salvarAnotacao, getAnotacao, salvarResposta, etc., permanecem as mesmas) ...
export function salvarAnotacao(perguntaId, texto) {
    auditoriaAtiva.anotacoes.set(String(perguntaId), texto);
}
export function getAnotacao(perguntaId) {
    return auditoriaAtiva.anotacoes.get(String(perguntaId)) || '';
}
export function getChecklistParaAreaAtiva() {
    if (!auditoriaAtiva.areaId || !pacoteDeAuditoria) return [];
    return pacoteDeAuditoria.dados_suporte.perguntas.filter(p => p.Referencia_Area == auditoriaAtiva.areaId);
}
export function salvarResposta(perguntaId, valor) {
    auditoriaAtiva.respostas.set(String(perguntaId), valor);
}
export function getResposta(perguntaId) {
    return auditoriaAtiva.respostas.get(String(perguntaId));
}
export function avaliarCondicao(pergunta) {
    const idPerguntaMae = pergunta.Visibilidade_DependeDe;
    if (!idPerguntaMae || idPerguntaMae === 0) return true;
    const valorEsperado = pergunta.Visibilidade_Valor;
    const valorAtual = getResposta(idPerguntaMae);
    return valorAtual === valorEsperado;
}
export function adicionarInstanciaSecao(secaoId) {
    const contagemAtual = auditoriaAtiva.instanciasRepetidas.get(String(secaoId)) || 0;
    const novaContagem = contagemAtual + 1;
    auditoriaAtiva.instanciasRepetidas.set(String(secaoId), novaContagem);
	ultimaInstanciaAdicionada = { secaoId: String(secaoId), numero: novaContagem };
}
export function verificarUltimaInstanciaAdicionada(secaoId, numero) {
    if (ultimaInstanciaAdicionada && ultimaInstanciaAdicionada.secaoId === String(secaoId) && ultimaInstanciaAdicionada.numero === numero) {
        ultimaInstanciaAdicionada = null;
        return true;
    }
    return false;
}
export function getContagemInstancias(secaoId) {
    return auditoriaAtiva.instanciasRepetidas.get(String(secaoId)) || 0;
}
export function removerInstanciaSecao(secaoId, numeroInstancia) {
    const idStr = String(secaoId);
    const numInst = parseInt(numeroInstancia, 10);
    let contagemAtual = auditoriaAtiva.instanciasRepetidas.get(idStr) || 0;

    if (contagemAtual === 0 || numInst > contagemAtual) return;

    const perguntasDaSecao = pacoteDeAuditoria.dados_suporte.perguntas.filter(p => p.ID_Pai == idStr);
    for (let i = numInst; i < contagemAtual; i++) {
        perguntasDaSecao.forEach(p => {
            const idOrigem = `${p.id}-${i + 1}`;
            const idDestino = `${p.id}-${i}`;
            if (auditoriaAtiva.respostas.has(idOrigem)) {
                auditoriaAtiva.respostas.set(idDestino, auditoriaAtiva.respostas.get(idOrigem));
            } else {
                auditoriaAtiva.respostas.delete(idDestino);
            }
            if (auditoriaAtiva.anotacoes.has(idOrigem)) {
                auditoriaAtiva.anotacoes.set(idDestino, auditoriaAtiva.anotacoes.get(idOrigem));
            } else {
                auditoriaAtiva.anotacoes.delete(idDestino);
            }
        });
    }
    perguntasDaSecao.forEach(p => {
        const idUltima = `${p.id}-${contagemAtual}`;
        auditoriaAtiva.respostas.delete(idUltima);
        auditoriaAtiva.anotacoes.delete(idUltima);
    });
    auditoriaAtiva.instanciasRepetidas.set(idStr, contagemAtual - 1);
}
export function getDadosCompletosPergunta(perguntaId) {
    if (!pacoteDeAuditoria) return null;
    const { perguntas, grupos_respostas, opcoes_respostas } = pacoteDeAuditoria.dados_suporte;
    const modelo = perguntas.find(p => p.id == perguntaId);
    if (!modelo) return { modelo: { Texto_Pergunta: `ERRO` }, opcoes: [] };
    const grupo = grupos_respostas.find(g => g.id == modelo.Tipo_Resposta_Utilizado);
    let opcoes = [];
    if (grupo) {
        opcoes = opcoes_respostas.filter(o => o.RefTiposRespostasGrupos == grupo.id).sort((a, b) => a.Ordem - b.Ordem);
    }
    return { modelo, opcoes };
}
export function contarPerguntasParaArea(idDaArea) {
    if (!pacoteDeAuditoria) return 0;
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
export function getInfoAuditoriaPrincipal() {
    if (!pacoteDeAuditoria || !pacoteDeAuditoria.auditoria_geral) return { Nome_Auditoria: 'N/A' };
    const infoAuditoria = pacoteDeAuditoria.auditoria_geral;
    return { Nome_Auditoria: infoAuditoria.IdAud || 'N/A' };
}
export function getDepartamentoAtivoNome() {
    if (!pacoteDeAuditoria || !auditoriaAtiva.areaId) return 'N/A';
    const depto = pacoteDeAuditoria.dados_suporte.departamentos.find(d => d.id == auditoriaAtiva.areaId);
    return depto ? depto.Departamento : 'N/A';
}
export function calcularProgresso() {
    if (!pacoteDeAuditoria || !auditoriaAtiva.areaId) return { respondidas: 0, total: 0, percentual: 0 };
    const perguntasDaAuditoria = pacoteDeAuditoria.dados_suporte.perguntas.filter(item => item.Referencia_Area == auditoriaAtiva.areaId);
    let totalPerguntasVisiveis = 0;
    let perguntasRespondidas = 0;
    const itensRaiz = perguntasDaAuditoria.filter(item => !item.ID_Pai || item.ID_Pai === 0);
    function percorrerItens(itens, instanciaPai = null) {
        itens.forEach(item => {
            const idCompleto = instanciaPai ? `${item.id}-${instanciaPai.numero}` : String(item.id);
            if (!avaliarCondicao(item)) return;
            if (item.Tipo_Item === 'Pergunta') {
                totalPerguntasVisiveis++;
                if (auditoriaAtiva.respostas.has(idCompleto)) {
                    perguntasRespondidas++;
                }
            }
            if (item.Tipo_Item === 'Secao' || item.Tipo_Item === 'secao') {
                const filhosDaSecao = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id);
                if (!item.Repetivel || item.Repetivel === 'NÃO') {
                    percorrerItens(filhosDaSecao);
                } else {
                    const contagemInstancias = getContagemInstancias(item.id) || 0;
                    for (let i = 1; i <= contagemInstancias; i++) {
                        percorrerItens(filhosDaSecao, { numero: i });
                    }
                }
            }
            const filhosDaPergunta = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id);
            if (filhosDaPergunta.length > 0) {
                 percorrerItens(filhosDaPergunta, instanciaPai);
            }
        });
    }
    percorrerItens(itensRaiz);
    const percentual = totalPerguntasVisiveis > 0 ? (perguntasRespondidas / totalPerguntasVisiveis) * 100 : 0;
    return { respondidas: perguntasRespondidas, total: totalPerguntasVisiveis, percentual: percentual.toFixed(0) };
}
export function anexarMidia(perguntaId, fileList) {
    const arquivosAtuais = auditoriaAtiva.midias.get(String(perguntaId)) || [];
    const novosArquivos = Array.from(fileList).map(file => ({ name: file.name, size: file.size, type: file.type }));
    auditoriaAtiva.midias.set(String(perguntaId), [...arquivosAtuais, ...novosArquivos]);
}
export function getMidias(perguntaId) {
    return auditoriaAtiva.midias.get(String(perguntaId)) || [];
}