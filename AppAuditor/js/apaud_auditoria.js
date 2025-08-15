// js/apaud_auditoria.js (v5.0 - Com persistência de estado)

import { mostrarStatusCarregamento } from './apaud_ui.js';

const AUDITORIA_STORAGE_KEY = 'auditoriaAtivaState';
let pacoteDeAuditoria = null;
let auditoriaAtiva = null; // Agora começa como nulo
let ultimaInstanciaAdicionada = null;

// --- Funções de Persistência ---
function _saveStateToLocalStorage() {
    if (auditoriaAtiva) {
        // Converte Maps para Arrays de [chave, valor] para serem serializáveis
        const serializableState = {
            ...auditoriaAtiva,
            respostas: Array.from(auditoriaAtiva.respostas.entries()),
            anotacoes: Array.from(auditoriaAtiva.anotacoes.entries()),
            midias: Array.from(auditoriaAtiva.midias.entries()),
            instanciasRepetidas: Array.from(auditoriaAtiva.instanciasRepetidas.entries()),
        };
        localStorage.setItem(AUDITORIA_STORAGE_KEY, JSON.stringify(serializableState));
    } else {
        localStorage.removeItem(AUDITORIA_STORAGE_KEY);
    }
}

export function loadStateFromLocalStorage() {
    const savedStateJSON = localStorage.getItem(AUDITORIA_STORAGE_KEY);
    if (savedStateJSON) {
        const savedState = JSON.parse(savedStateJSON);
        // Reconverte os arrays para Maps
        auditoriaAtiva = {
            ...savedState,
            respostas: new Map(savedState.respostas),
            anotacoes: new Map(savedState.anotacoes),
            midias: new Map(savedState.midias),
            instanciasRepetidas: new Map(savedState.instanciasRepetidas),
        };
        console.log("Estado da auditoria carregado do localStorage.", auditoriaAtiva);
        return true;
    }
    return false;
}

function _clearStateFromLocalStorage() {
    localStorage.removeItem(AUDITORIA_STORAGE_KEY);
    auditoriaAtiva = null;
}

// NOVO: Retorna a auditoria ativa para a UI
export function getAuditoriaAtiva() {
    return auditoriaAtiva;
}

// --- Funções de Carregamento ---
export function carregarPacoteJSON() {
    // ... (código existente, sem alterações) ...
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

// --- Funções de Gerenciamento da Auditoria ---
export function iniciarAuditoriaParaArea(areaId, planejamentoId) {
    // Só cria uma nova se não houver nenhuma ativa
    if (auditoriaAtiva && auditoriaAtiva.planejamentoId) {
        console.warn("Já existe uma auditoria ativa. Não foi criada uma nova.");
        return false;
    }
    auditoriaAtiva = {
        status: 'em_progresso',
        areaId: areaId,
        planejamentoId: planejamentoId,
        dataRealizada: null, auditorLiderId: null, auditorAcompanhanteId: null,
        respostas: new Map(), anotacoes: new Map(), midias: new Map(), instanciasRepetidas: new Map()
    };
    _saveStateToLocalStorage();
    return true;
}

export function salvarDetalhesExecucao(detalhes) {
    if (!auditoriaAtiva) return;
    auditoriaAtiva.dataRealizada = detalhes.data;
    auditoriaAtiva.auditorLiderId = detalhes.liderId;
    auditoriaAtiva.auditorAcompanhanteId = detalhes.acompId;
    _saveStateToLocalStorage();
}

// NOVO: Finaliza a auditoria, gera o resultado e limpa o estado
export function finalizarAuditoria() {
    if (!auditoriaAtiva) return null;
    auditoriaAtiva.status = 'finalizada';
    _saveStateToLocalStorage(); // Salva o novo estado
    
    // Converte Maps para Objetos para o JSON de saída
    const resultado = {
        ...auditoriaAtiva,
        respostas: Object.fromEntries(auditoriaAtiva.respostas),
        anotacoes: Object.fromEntries(auditoriaAtiva.anotacoes),
        midias: Object.fromEntries(auditoriaAtiva.midias),
        instanciasRepetidas: Object.fromEntries(auditoriaAtiva.instanciasRepetidas)
    };
    return resultado;
}

export function contarNaoConformidades() {
    if (!auditoriaAtiva) return { nc: 0, ncMaior: 0 };

    let nc = 0;
    let ncMaior = 0;

    for (const resposta of auditoriaAtiva.respostas.values()) {
        const respostaLowerCase = String(resposta).toLowerCase();
        if (respostaLowerCase === 'não conforme') {
            nc++;
        } else if (respostaLowerCase === 'nc maior') {
            ncMaior++;
        }
    }
    return { nc, ncMaior };
}

export function reabrirAuditoria() {
    if (!auditoriaAtiva || auditoriaAtiva.status !== 'finalizada') return;
    auditoriaAtiva.status = 'em_progresso';
    _saveStateToLocalStorage();
    console.log("Auditoria reaberta.");
}

// --- Funções que modificam o estado agora devem SALVAR ---
export function salvarAnotacao(perguntaId, texto) {
    if (!auditoriaAtiva) return;
    auditoriaAtiva.anotacoes.set(String(perguntaId), texto);
    _saveStateToLocalStorage();
}
export function salvarResposta(perguntaId, valor) {
    if (!auditoriaAtiva) return;
    auditoriaAtiva.respostas.set(String(perguntaId), valor);
    _saveStateToLocalStorage();
}
export function adicionarInstanciaSecao(secaoId) {
    if (!auditoriaAtiva) return;
    const contagemAtual = getContagemInstancias(secaoId);
    const novaContagem = contagemAtual + 1;
    auditoriaAtiva.instanciasRepetidas.set(String(secaoId), novaContagem);
	ultimaInstanciaAdicionada = { secaoId: String(secaoId), numero: novaContagem };
    _saveStateToLocalStorage();
}
export function removerInstanciaSecao(secaoId, numeroInstancia) {
    if (!auditoriaAtiva) return;
    // ... (código interno da função é o mesmo) ...
    const idStr = String(secaoId);
    const numInst = parseInt(numeroInstancia, 10);
    let contagemAtual = auditoriaAtiva.instanciasRepetidas.get(idStr) || 0;
    if (contagemAtual === 0 || numInst > contagemAtual) return;
    const perguntasDaSecao = pacoteDeAuditoria.dados_suporte.perguntas.filter(p => p.ID_Pai == idStr);
    for (let i = numInst; i < contagemAtual; i++) {
        perguntasDaSecao.forEach(p => {
            const idOrigem = `${p.id}-${i + 1}`;
            const idDestino = `${p.id}-${i}`;
            if (auditoriaAtiva.respostas.has(idOrigem)) { auditoriaAtiva.respostas.set(idDestino, auditoriaAtiva.respostas.get(idOrigem)); } else { auditoriaAtiva.respostas.delete(idDestino); }
            if (auditoriaAtiva.anotacoes.has(idOrigem)) { auditoriaAtiva.anotacoes.set(idDestino, auditoriaAtiva.anotacoes.get(idOrigem)); } else { auditoriaAtiva.anotacoes.delete(idDestino); }
        });
    }
    perguntasDaSecao.forEach(p => {
        const idUltima = `${p.id}-${contagemAtual}`;
        auditoriaAtiva.respostas.delete(idUltima);
        auditoriaAtiva.anotacoes.delete(idUltima);
    });
    auditoriaAtiva.instanciasRepetidas.set(idStr, contagemAtual - 1);
    _saveStateToLocalStorage();
}
export function anexarMidia(perguntaId, fileList) {
    if (!auditoriaAtiva) return;
    const arquivosAtuais = getMidias(perguntaId);
    const novosArquivos = Array.from(fileList).map(file => ({ name: file.name, size: file.size, type: file.type }));
    auditoriaAtiva.midias.set(String(perguntaId), [...arquivosAtuais, ...novosArquivos]);
    _saveStateToLocalStorage();
}
// ... (O resto das funções que APENAS LEEM dados não precisam mudar)
export function getAnotacao(perguntaId) { if (!auditoriaAtiva) return ''; return auditoriaAtiva.anotacoes.get(String(perguntaId)) || ''; }
export function getMidias(perguntaId) { if (!auditoriaAtiva) return []; return auditoriaAtiva.midias.get(String(perguntaId)) || []; }
export function getResposta(perguntaId) { if (!auditoriaAtiva) return undefined; return auditoriaAtiva.respostas.get(String(perguntaId)); }
// ... (e assim por diante para getPlanejamentos, getAuditores, etc.)
// O código abaixo pode ser copiado e colado para substituir as funções existentes.
export function getPlanejamentos() { if (!pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.planejamento_pai; }
export function getAuditores() { if (!pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.auditores; }
export function getPlanejamentoPorId(planejamentoId) { if (!pacoteDeAuditoria) return null; return getPlanejamentos().find(p => p.id == planejamentoId); }
export function getChecklistParaAreaAtiva() { if (!auditoriaAtiva || !auditoriaAtiva.areaId || !pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.perguntas.filter(p => p.Referencia_Area == auditoriaAtiva.areaId); }
export function avaliarCondicao(pergunta) { const idPerguntaMae = pergunta.Visibilidade_DependeDe; if (!idPerguntaMae || idPerguntaMae === 0) return true; const valorEsperado = pergunta.Visibilidade_Valor; const valorAtual = getResposta(idPerguntaMae); return valorAtual === valorEsperado; }
export function verificarUltimaInstanciaAdicionada(secaoId, numero) { if (ultimaInstanciaAdicionada && ultimaInstanciaAdicionada.secaoId === String(secaoId) && ultimaInstanciaAdicionada.numero === numero) { ultimaInstanciaAdicionada = null; return true; } return false; }
export function getContagemInstancias(secaoId) { if (!auditoriaAtiva) return 0; return auditoriaAtiva.instanciasRepetidas.get(String(secaoId)) || 0; }
export function getDadosCompletosPergunta(perguntaId) { if (!pacoteDeAuditoria) return null; const { perguntas, grupos_respostas, opcoes_respostas } = pacoteDeAuditoria.dados_suporte; const modelo = perguntas.find(p => p.id == perguntaId); if (!modelo) return { modelo: { Texto_Pergunta: `ERRO` }, opcoes: [] }; const grupo = grupos_respostas.find(g => g.id == modelo.Tipo_Resposta_Utilizado); let opcoes = []; if (grupo) { opcoes = opcoes_respostas.filter(o => o.RefTiposRespostasGrupos == grupo.id).sort((a, b) => a.Ordem - b.Ordem); } return { modelo, opcoes }; }
export function contarPerguntasParaArea(idDaArea) { if (!pacoteDeAuditoria) return 0; return pacoteDeAuditoria.dados_suporte.perguntas.filter(item => item.Referencia_Area == idDaArea && item.Tipo_Item === 'Pergunta').length; }
export function getDetalhesDoPlanejamento(idDoPai) { if (!pacoteDeAuditoria) return null; const { planejamento_pai, departamentos, auditores } = pacoteDeAuditoria.dados_suporte; const planejamento = planejamento_pai.find(p => p.id == idDoPai); if (!planejamento) return null; const idDaArea = planejamento.Departamento; const departamentoInfo = departamentos.find(d => d.id == idDaArea); const auditorLiderInfo = auditores.find(a => a.id == planejamento.Auditor_Lider); const auditorAcompInfo = auditores.find(a => a.id == planejamento.Auditor_Acompanhante); const perguntasNestaArea = contarPerguntasParaArea(idDaArea); return { responsavel: departamentoInfo ? (departamentoInfo.gristHelper_Display2 || 'N/A') : 'N/A', auditorLider: auditorLiderInfo ? auditorLiderInfo.NomeAuditorRef : 'Não definido', auditorAcompanhante: auditorAcompInfo ? auditorAcompInfo.NomeAuditorRef : 'Não definido', totalPerguntas: perguntasNestaArea }; }
export function getInfoAuditoriaPrincipal() { if (!pacoteDeAuditoria || !pacoteDeAuditoria.auditoria_geral) return { Nome_Auditoria: 'N/A' }; return { Nome_Auditoria: pacoteDeAuditoria.auditoria_geral.IdAud || 'N/A' }; }
export function getDepartamentoAtivoNome() { if (!pacoteDeAuditoria || !auditoriaAtiva || !auditoriaAtiva.areaId) return 'N/A'; const depto = pacoteDeAuditoria.dados_suporte.departamentos.find(d => d.id == auditoriaAtiva.areaId); return depto ? depto.Departamento : 'N/A'; }
export function calcularProgresso() { if (!pacoteDeAuditoria || !auditoriaAtiva || !auditoriaAtiva.areaId) return { respondidas: 0, total: 0, percentual: 0 }; const perguntasDaAuditoria = pacoteDeAuditoria.dados_suporte.perguntas.filter(item => item.Referencia_Area == auditoriaAtiva.areaId); let totalPerguntasVisiveis = 0; let perguntasRespondidas = 0; const itensRaiz = perguntasDaAuditoria.filter(item => !item.ID_Pai || item.ID_Pai === 0); function percorrerItens(itens, instanciaPai = null) { itens.forEach(item => { const idCompleto = instanciaPai ? `${item.id}-${instanciaPai.numero}` : String(item.id); if (!avaliarCondicao(item)) return; if (item.Tipo_Item === 'Pergunta') { totalPerguntasVisiveis++; if (auditoriaAtiva.respostas.has(idCompleto)) { perguntasRespondidas++; } } if (item.Tipo_Item === 'Secao' || item.Tipo_Item === 'secao') { const filhosDaSecao = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id); if (!item.Repetivel || item.Repetivel === 'NÃO') { percorrerItens(filhosDaSecao); } else { const contagemInstancias = getContagemInstancias(item.id) || 0; for (let i = 1; i <= contagemInstancias; i++) { percorrerItens(filhosDaSecao, { numero: i }); } } } const filhosDaPergunta = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id); if (filhosDaPergunta.length > 0) { percorrerItens(filhosDaPergunta, instanciaPai); } }); } percorrerItens(itensRaiz); const percentual = totalPerguntasVisiveis > 0 ? (perguntasRespondidas / totalPerguntasVisiveis) * 100 : 0; return { respondidas: perguntasRespondidas, total: totalPerguntasVisiveis, percentual: percentual.toFixed(0) }; }