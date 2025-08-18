// js/apaud_auditoria.js (v5.0 - Com persistência de estado)

import { mostrarStatusCarregamento } from './apaud_ui.js';

const STATE_STORAGE_KEY = 'auditoriasEmProgressoState';
let pacoteDeAuditoria = null;
let auditoriasEmProgresso = new Map();
let currentAuditoriaId = null; // ID do planejamento que está sendo editado no momento
let ultimaInstanciaAdicionada = null;

// --- Funções de Persistência ---
function _saveStateToLocalStorage() {
    const serializableState = Array.from(auditoriasEmProgresso.entries());
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(serializableState));
}
export function loadStateFromLocalStorage() {
    const savedStateJSON = localStorage.getItem(STATE_STORAGE_KEY);
    if (savedStateJSON) {
        try {
            auditoriasEmProgresso = new Map(JSON.parse(savedStateJSON));
        } catch(e) {
            console.error("Erro ao carregar estado do localStorage:", e);
            auditoriasEmProgresso = new Map();
        }
    }
}

// --- Funções de Gerenciamento de Múltiplos Estados ---
export function getAuditoriaState(planejamentoId) { return auditoriasEmProgresso.get(Number(planejamentoId)); }
export function setCurrentAuditoriaId(planejamentoId) { currentAuditoriaId = Number(planejamentoId); }
function _getCurrentState() { return getAuditoriaState(currentAuditoriaId); }

// --- Funções de Carregamento ---
export function carregarPacoteJSON(textoJSON) {
    if (!textoJSON || !textoJSON.trim()) {
        mostrarStatusCarregamento("Erro: O arquivo está vazio ou é inválido.", 'erro');
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

// --- Funções de Gerenciamento da Auditoria ---
export function iniciarAuditoriaParaArea(areaId, planejamentoId) {
    const id = Number(planejamentoId);
    if (auditoriasEmProgresso.has(id)) return;
    auditoriasEmProgresso.set(id, {
        status: 'em_progresso', areaId: Number(areaId), planejamentoId: id,
        dataRealizada: null, auditorLiderId: null, auditorAcompanhanteId: null,
        respostas: {}, anotacoes: {}, midias: {}, instanciasRepetidas: {},
        pontosEmAberto: {}, // <-- NOVA PROPRIEDADE ADICIONADA AQUI
        jsonExportado: false, pdfExportado: false,
    });
    _saveStateToLocalStorage();
}
export function salvarDetalhesExecucao(detalhes) {
    const state = _getCurrentState();
    if (!state) return;
    state.dataRealizada = detalhes.data;
    state.auditorLiderId = detalhes.liderId;
    state.auditorAcompanhanteId = detalhes.acompId;
    _saveStateToLocalStorage();
}
export function finalizarAuditoria() {
    const state = _getCurrentState();
    if (state) {
        state.status = 'finalizada';
        _saveStateToLocalStorage();
    }
}
export function reabrirAuditoria(planejamentoId) {
    const state = getAuditoriaState(planejamentoId);
    if (state) {
        state.status = 'em_progresso';
        _saveStateToLocalStorage();
    }
}
export function marcarComoExportado(planejamentoId, tipo) {
    const state = getAuditoriaState(planejamentoId);
    if (!state) return;
    if (tipo === 'json') state.jsonExportado = true;
    if (tipo === 'pdf') state.pdfExportado = true;
    _saveStateToLocalStorage();
}
export function gerarJsonDeResultado(planejamentoId) {
    const state = getAuditoriaState(planejamentoId);
    return state ? { ...state } : null;
}
export function salvarPontoEmAberto(perguntaId, textoPendencia) {
    const state = _getCurrentState();
    if (!state) return;
    if(!state.pontosEmAberto) state.pontosEmAberto = {}; // Garante que o objeto exista
    state.pontosEmAberto[perguntaId] = { pendencia: textoPendencia };
    _saveStateToLocalStorage();
}

export function resolverPontoEmAberto(perguntaId) {
    const state = _getCurrentState();
    if (state && state.pontosEmAberto && state.pontosEmAberto[perguntaId]) {
        delete state.pontosEmAberto[perguntaId];
        _saveStateToLocalStorage();
    }
}

export function getPontoEmAberto(perguntaId) {
    const state = _getCurrentState();
    return (state && state.pontosEmAberto) ? state.pontosEmAberto[perguntaId] : null;
}

export function getPontosEmAbertoCount(planejamentoId) {
    const state = getAuditoriaState(planejamentoId);
    return (state && state.pontosEmAberto) ? Object.keys(state.pontosEmAberto).length : 0;
}

// --- Funções que modificam o estado agora devem SALVAR ---
export function salvarAnotacao(perguntaId, texto) { const s = _getCurrentState(); if (s) { s.anotacoes[perguntaId] = texto; _saveStateToLocalStorage(); } }
export function salvarResposta(perguntaId, valor) { const s = _getCurrentState(); if (s) { s.respostas[perguntaId] = valor; _saveStateToLocalStorage(); } }
export function adicionarInstanciaSecao(secaoId) { const s = _getCurrentState(); if (!s) return; const idStr = String(secaoId); s.instanciasRepetidas[idStr] = (s.instanciasRepetidas[idStr] || 0) + 1; ultimaInstanciaAdicionada = { secaoId: idStr, numero: s.instanciasRepetidas[idStr] }; _saveStateToLocalStorage(); }
export function removerInstanciaSecao(secaoId, numeroInstancia) {
    const state = _getCurrentState();
    if (!state) return;
    const idStr = String(secaoId);
    const numInst = parseInt(numeroInstancia, 10);
    let contagemAtual = state.instanciasRepetidas[idStr] || 0;
    if (contagemAtual === 0 || numInst > contagemAtual) return;

    const perguntasDaSecao = pacoteDeAuditoria.dados_suporte.perguntas.filter(p => p.ID_Pai == idStr);
    for (let i = numInst; i < contagemAtual; i++) {
        perguntasDaSecao.forEach(p => {
            const idOrigem = `${p.id}-${i + 1}`;
            const idDestino = `${p.id}-${i}`;
            if (state.respostas[idOrigem] !== undefined) state.respostas[idDestino] = state.respostas[idOrigem]; else delete state.respostas[idDestino];
            if (state.anotacoes[idOrigem] !== undefined) state.anotacoes[idDestino] = state.anotacoes[idOrigem]; else delete state.anotacoes[idDestino];
            if (state.midias[idOrigem] !== undefined) state.midias[idDestino] = state.midias[idOrigem]; else delete state.midias[idDestino];
        });
    }
    perguntasDaSecao.forEach(p => {
        const idUltima = `${p.id}-${contagemAtual}`;
        delete state.respostas[idUltima];
        delete state.anotacoes[idUltima];
        delete state.midias[idUltima];
    });
    state.instanciasRepetidas[idStr]--;
    _saveStateToLocalStorage();
}
export function anexarMidia(perguntaId, fileList) { const s = _getCurrentState(); if (!s) return; const idStr = String(perguntaId); const novosArquivos = Array.from(fileList).map(file => ({ name: file.name, size: file.size, type: file.type })); s.midias[idStr] = [...(s.midias[idStr] || []), ...novosArquivos]; _saveStateToLocalStorage(); }
// ... (O resto das funções que APENAS LEEM dados não precisam mudar)
export function getAnotacao(perguntaId) { const s = _getCurrentState(); return s ? s.anotacoes[perguntaId] || '' : ''; }
export function getMidias(perguntaId) { const s = _getCurrentState(); return s ? s.midias[perguntaId] || [] : []; }
export function getResposta(perguntaId) { const s = _getCurrentState(); return s ? s.respostas[perguntaId] : undefined; }
export function getPlanejamentos() { if (!pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.planejamento_pai; }
export function getAuditores() { if (!pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.auditores; }
export function getPlanejamentoPorId(planejamentoId) { if (!pacoteDeAuditoria) return null; return getPlanejamentos().find(p => p.id == planejamentoId); }
export function getChecklistParaAreaAtiva() { const s = _getCurrentState(); if (!s || !pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.perguntas.filter(p => p.Referencia_Area == s.areaId); }
export function avaliarCondicao(pergunta) { const idPerguntaMae = pergunta.Visibilidade_DependeDe; if (!idPerguntaMae || idPerguntaMae === 0) return true; const valorEsperado = pergunta.Visibilidade_Valor; const valorAtual = getResposta(idPerguntaMae); return valorAtual === valorEsperado; }
export function verificarUltimaInstanciaAdicionada(secaoId, numero) { if (ultimaInstanciaAdicionada && ultimaInstanciaAdicionada.secaoId === String(secaoId) && ultimaInstanciaAdicionada.numero === numero) { ultimaInstanciaAdicionada = null; return true; } return false; }
export function getContagemInstancias(secaoId) { const s = _getCurrentState(); return s ? s.instanciasRepetidas[String(secaoId)] || 0 : 0; }
export function getDadosCompletosPergunta(perguntaId) { if (!pacoteDeAuditoria) return null; const { perguntas, grupos_respostas, opcoes_respostas } = pacoteDeAuditoria.dados_suporte; const modelo = perguntas.find(p => p.id == perguntaId); if (!modelo) return { modelo: { Texto_Pergunta: `ERRO` }, opcoes: [] }; const grupo = grupos_respostas.find(g => g.id == modelo.Tipo_Resposta_Utilizado); let opcoes = []; if (grupo) { opcoes = opcoes_respostas.filter(o => o.RefTiposRespostasGrupos == grupo.id).sort((a, b) => a.Ordem - b.Ordem); } return { modelo, opcoes }; }
export function contarPerguntasParaArea(idDaArea) { if (!pacoteDeAuditoria) return 0; return pacoteDeAuditoria.dados_suporte.perguntas.filter(item => item.Referencia_Area == idDaArea && item.Tipo_Item === 'Pergunta').length; }
export function getDetalhesDoPlanejamento(idDoPai) { if (!pacoteDeAuditoria) return null; const { planejamento_pai, departamentos, auditores } = pacoteDeAuditoria.dados_suporte; const planejamento = planejamento_pai.find(p => p.id == idDoPai); if (!planejamento) return null; const idDaArea = planejamento.Departamento; const departamentoInfo = departamentos.find(d => d.id == idDaArea); const auditorLiderInfo = auditores.find(a => a.id == planejamento.Auditor_Lider); const auditorAcompInfo = auditores.find(a => a.id == planejamento.Auditor_Acompanhante); const perguntasNestaArea = contarPerguntasParaArea(idDaArea); return { responsavel: departamentoInfo ? (departamentoInfo.gristHelper_Display2 || 'N/A') : 'N/A', auditorLider: auditorLiderInfo ? auditorLiderInfo.NomeAuditorRef : 'Não definido', auditorAcompanhante: auditorAcompInfo ? auditorAcompInfo.NomeAuditorRef : 'Não definido', totalPerguntas: perguntasNestaArea }; }
export function getInfoAuditoriaPrincipal() { if (!pacoteDeAuditoria || !pacoteDeAuditoria.auditoria_geral) return { Nome_Auditoria: 'N/A' }; return { Nome_Auditoria: pacoteDeAuditoria.auditoria_geral.IdAud || 'N/A' }; }
export function getDepartamentoAtivoNome() { const s = _getCurrentState(); if (!s || !pacoteDeAuditoria) return 'N/A'; const depto = pacoteDeAuditoria.dados_suporte.departamentos.find(d => d.id == s.areaId); return depto ? depto.Departamento : 'N/A'; }
export function calcularProgresso(planejamentoId) {
    // Usa o estado da auditoria específica, não a "ativa"
    const state = getAuditoriaState(planejamentoId);
    if (!pacoteDeAuditoria || !state) return { respondidas: 0, total: 0, percentual: 0 };

    const perguntasDaAuditoria = pacoteDeAuditoria.dados_suporte.perguntas.filter(
        item => item.Referencia_Area == state.areaId
    );
    
    let totalPerguntasVisiveis = 0;
    let perguntasRespondidas = 0;

    // Função interna de leitura adaptada
    const getRespostaDestaAuditoria = (id) => state.respostas[id];

    const avaliarCondicaoDestaAuditoria = (pergunta) => {
        const idPerguntaMae = pergunta.Visibilidade_DependeDe;
        if (!idPerguntaMae || idPerguntaMae === 0) return true;
        const valorEsperado = pergunta.Visibilidade_Valor;
        const valorAtual = getRespostaDestaAuditoria(idPerguntaMae);
        return valorAtual === valorEsperado;
    };

    function percorrerItens(itens) {
        itens.forEach(item => {
            if (!avaliarCondicaoDestaAuditoria(item)) return;

            if (item.Tipo_Item === 'Pergunta') {
                totalPerguntasVisiveis++;
                if (state.respostas[item.id] !== undefined) {
                    perguntasRespondidas++;
                }
            }

            if (item.Tipo_Item === 'Secao' || item.Tipo_Item === 'secao') {
                const filhosDaSecao = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id);
                percorrerItens(filhosDaSecao);

                const contagemInstancias = state.instanciasRepetidas[item.id] || 0;
                for (let i = 1; i <= contagemInstancias; i++) {
                    filhosDaSecao.forEach(filho => {
                        if (filho.Tipo_Item === 'Pergunta') {
                             totalPerguntasVisiveis++;
                             const idInstancia = `${filho.id}-${i}`;
                             if (state.respostas[idInstancia] !== undefined) {
                                 perguntasRespondidas++;
                             }
                        }
                    });
                }
            }

            const filhosDaPergunta = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id);
            if (filhosDaPergunta.length > 0) {
                 percorrerItens(filhosDaPergunta);
            }
        });
    }

    const itensRaiz = perguntasDaAuditoria.filter(item => !item.ID_Pai || item.ID_Pai === 0);
    percorrerItens(itensRaiz);

    const percentual = totalPerguntasVisiveis > 0 ? (perguntasRespondidas / totalPerguntasVisiveis) * 100 : 0;
    
    return {
        respondidas: perguntasRespondidas,
        total: totalPerguntasVisiveis,
        percentual: percentual.toFixed(0)
    };
}
export function contarNaoConformidades(planejamentoId) {
    const state = getAuditoriaState(planejamentoId);
    if (!state) return { nc: 0, ncMaior: 0 };
    let nc = 0, ncMaior = 0;
    for (const resposta of Object.values(state.respostas)) {
        const lowerCaseRes = String(resposta).toLowerCase();
        if (lowerCaseRes === 'não conforme') nc++;
        else if (lowerCaseRes === 'nc maior') ncMaior++;
    }
    return { nc, ncMaior };
}