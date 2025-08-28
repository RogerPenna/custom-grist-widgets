// js/apaud_auditoria.js (v6.0 - Multi-Pacote)

import * as StorageManager from './storageManager.js';
import { mostrarStatusCarregamento } from './apaud_ui.js';

// --- GERENCIADOR DE ESTADO GLOBAL ---
const STORAGE_KEY = 'APAUD_DATA';
let gerenciadorDePacotes = {}; // Objeto "guarda-chuva" com todos os pacotes.

// --- VARIÁVEIS DE ESTADO ATIVO (A "FACHADA") ---
// Apontam para os dados do pacote ATUALMENTE em uso.
let pacoteDeAuditoria = null; 
let auditoriasEmProgresso = new Map();
let idPacoteAtivo = null;

// Variáveis de estado da SESSÃO de auditoria ATIVA.
let currentAuditoriaId = null; 
let ultimaInstanciaAdicionada = null;


// --- NOVAS FUNÇÕES DE GERENCIAMENTO DE PACOTES ---
function _salvarGerenciador() {
  StorageManager.salvar(STORAGE_KEY, gerenciadorDePacotes);
}

export function inicializarGerenciador() {
  gerenciadorDePacotes = StorageManager.carregar(STORAGE_KEY) || {};
  console.log("Gerenciador de pacotes inicializado.", gerenciadorDePacotes);
}

export function getListaDePacotes() {
  return Object.keys(gerenciadorDePacotes).map(id => ({
    id: id,
    nome: gerenciadorDePacotes[id].pacote.auditoria_geral.IdAud || id
  }));
}

export function definirPacoteAtivo(id) {
  if (gerenciadorDePacotes[id]) {
    idPacoteAtivo = id;
    pacoteDeAuditoria = gerenciadorDePacotes[id].pacote;
    auditoriasEmProgresso = gerenciadorDePacotes[id].progresso;
    
    // Reseta o estado da sessão para evitar "vazamento" entre pacotes
    currentAuditoriaId = null;
    ultimaInstanciaAdicionada = null;

    console.log(`Pacote "${id}" definido como ativo.`);
    return true;
  }
  console.error(`Pacote com ID "${id}" não encontrado.`);
  return false;
}

// --- Funções de Gerenciamento de Múltiplos Estados ---
export function getAuditoriaState(planejamentoId) { return auditoriasEmProgresso.get(Number(planejamentoId)); }
export function setCurrentAuditoriaId(planejamentoId) { currentAuditoriaId = Number(planejamentoId); }
function _getCurrentState() { return getAuditoriaState(currentAuditoriaId); }
export function getCurrentAuditoriaId() {
    return currentAuditoriaId;
}
// --- Funções de Carregamento ---
export function adicionarNovoPacote(textoJSON) {
    try {
        const pacoteJsonNovo = JSON.parse(textoJSON);
        const idPacote = pacoteJsonNovo?.auditoria_geral?.IdAud;
        if (!idPacote) {
            throw new Error("Pacote inválido: 'auditoria_geral.IdAud' não encontrado.");
        }

        const pacoteExistente = gerenciadorDePacotes[idPacote];

        if (pacoteExistente) {
            // --- INÍCIO DA LÓGICA DE MERGE ---
            const confirmacao = confirm(`O pacote "${idPacote}" já existe. Deseja ATUALIZÁ-LO com os novos dados? O progresso existente será mantido.`);
            if (!confirmacao) {
                mostrarStatusCarregamento("Atualização cancelada pelo usuário.", 'info');
                return null;
            }

            console.log("Iniciando a atualização do pacote. Progresso antigo será mantido.");

            // Mantém o progresso antigo
            const progressoAntigo = pacoteExistente.progresso;
            
            // Atualiza a estrutura do pacote com a nova versão
            gerenciadorDePacotes[idPacote] = {
                pacote: pacoteJsonNovo,
                progresso: progressoAntigo // REUTILIZA O PROGRESSO!
            };
            
            // Opcional: Lógica de limpeza. Se um planejamento foi removido do novo JSON,
            // podemos remover seu progresso do Map para manter os dados limpos.
            const idsPlanejamentosNovos = new Set(pacoteJsonNovo.dados_suporte.planejamento_pai.map(p => p.id));
            for (const idPlanejamentoAntigo of progressoAntigo.keys()) {
                if (!idsPlanejamentosNovos.has(idPlanejamentoAntigo)) {
                    console.log(`Removendo progresso do planejamento obsoleto: ${idPlanejamentoAntigo}`);
                    progressoAntigo.delete(idPlanejamentoAntigo);
                }
            }

        } else {
            // --- LÓGICA DE NOVO PACOTE (como era antes) ---
            console.log("Adicionando um novo pacote.");
            gerenciadorDePacotes[idPacote] = {
                pacote: pacoteJsonNovo,
                progresso: new Map() // Começa com um progresso vazio
            };
        }

        _salvarGerenciador();
        mostrarStatusCarregamento(`Pacote "${idPacote}" ${pacoteExistente ? 'atualizado' : 'carregado'} com sucesso!`, 'sucesso');
        return idPacote;

    } catch (error) {
        mostrarStatusCarregamento(`Erro ao processar o JSON: ${error.message}`, 'erro');
        return null;
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
        pontosEmAberto: {},
        jsonExportado: false, pdfExportado: false,
    });
    _saveStateToLocalStorage();
}

function _saveStateToLocalStorage() {
    if (!idPacoteAtivo || !gerenciadorDePacotes[idPacoteAtivo]) return;

    // Atualiza o progresso do pacote ativo dentro da estrutura principal
    gerenciadorDePacotes[idPacoteAtivo].progresso = auditoriasEmProgresso;
    
    // Salva o objeto "guarda-chuva" inteiro
    _salvarGerenciador();
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
    if(!state.pontosEmAberto) state.pontosEmAberto = {}; 
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

// --- Funções que modificam o estado ---
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
export async function anexarMidia(perguntaId, fileList) {
    const state = _getCurrentState();
    if (!state) return;
    const idStr = String(perguntaId);

    const processarArquivo = (file) => {
        return new Promise((resolve) => {
            // Se for uma imagem, leia o conteúdo para gerar uma miniatura
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({ 
                        name: file.name, 
                        size: file.size, 
                        type: file.type, 
                        dataUrl: e.target.result // Salva a imagem como Base64
                    });
                };
                reader.readAsDataURL(file);
            } else {
                // Se não for imagem, apenas salve os metadados
                resolve({ 
                    name: file.name, 
                    size: file.size, 
                    type: file.type, 
                    dataUrl: null 
                });
            }
        });
    };

    const novosArquivosProcessados = await Promise.all(Array.from(fileList).map(processarArquivo));
    
    state.midias[idStr] = [...(state.midias[idStr] || []), ...novosArquivosProcessados];
    _saveStateToLocalStorage();
}

// --- Funções que APENAS LEEM dados ---
export function getAnotacao(perguntaId) { const s = _getCurrentState(); return s ? s.anotacoes[perguntaId] || '' : ''; }
export function getMidias(perguntaId) { const s = _getCurrentState(); return s ? s.midias[perguntaId] || [] : []; }
export function getResposta(perguntaId) { const s = _getCurrentState(); return s ? s.respostas[perguntaId] : undefined; }
export function getPlanejamentos() { if (!pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.planejamento_pai; }
export function getAuditores() { if (!pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.auditores; }
export function getPlanejamentoPorId(planejamentoId) { if (!pacoteDeAuditoria) return null; return getPlanejamentos().find(p => p.id == planejamentoId); }
export function getChecklistParaAreaAtiva() { const s = _getCurrentState(); if (!s || !pacoteDeAuditoria) return []; return pacoteDeAuditoria.dados_suporte.perguntas.filter(p => p.Referencia_Area == s.areaId); }

// <-- MODIFICADO --- Lógica de Visibilidade Condicional
export function avaliarCondicao(pergunta, instanciaInfo = null) {
    const idPerguntaMaeOriginal = pergunta.Visibilidade_DependeDe;
    if (!idPerguntaMaeOriginal || idPerguntaMaeOriginal === 0) {
        return true; // Sempre visível se não depende de ninguém.
    }

    // Constrói o ID da pergunta mãe considerando o contexto da instância.
    // Ex: Se a pergunta mãe é a 10 e estamos na instância 2, o ID a ser buscado é "10-2".
    const idPerguntaMae = instanciaInfo 
        ? `${idPerguntaMaeOriginal}-${instanciaInfo.numero}` 
        : String(idPerguntaMaeOriginal);

    const valoresEsperados = pergunta.Visibilidade_Valor;
    const valorAtual = getResposta(idPerguntaMae);

    if (valorAtual === undefined || valorAtual === null || valorAtual === '') {
        return false; // Invisível se a pergunta mãe não foi respondida.
    }
    
    // Lógica para respostas do tipo "Reference List" (ex: ["L", 1, 5, 9])
    if (Array.isArray(valoresEsperados) && valoresEsperados[0] === 'L') {
        const idsEsperados = valoresEsperados.slice(1);
        return idsEsperados.includes(Number(valorAtual));
    }
    
    // Comparação padrão para outros tipos de valor
    return String(valorAtual) === String(valoresEsperados);
}

export function verificarUltimaInstanciaAdicionada(secaoId, numero) { if (ultimaInstanciaAdicionada && ultimaInstanciaAdicionada.secaoId === String(secaoId) && ultimaInstanciaAdicionada.numero === numero) { ultimaInstanciaAdicionada = null; return true; } return false; }
export function getContagemInstancias(secaoId) { const s = _getCurrentState(); return s ? s.instanciasRepetidas[String(secaoId)] || 0 : 0; }

// <-- MODIFICADO --- Retorna o objeto 'grupo' inteiro
export function getDadosCompletosPergunta(perguntaId) {
    if (!pacoteDeAuditoria) return null;
    const { perguntas, grupos_respostas, opcoes_respostas } = pacoteDeAuditoria.dados_suporte;
    const modelo = perguntas.find(p => p.id == perguntaId);
    if (!modelo) return { modelo: { Texto_Pergunta: `ERRO` }, grupo: null, opcoes: [] };
    
    // O tipo de resposta pode vir do modelo ou do grupo.
    const grupo = grupos_respostas.find(g => g.id == modelo.Tipo_Resposta_Utilizado);
    
    let opcoes = [];
    if (grupo) {
        opcoes = opcoes_respostas.filter(o => o.RefTiposRespostasGrupos == grupo.id).sort((a, b) => a.Ordem - b.Ordem);
    }
    return { modelo, grupo, opcoes };
}

export function contarPerguntasParaArea(idDaArea) { if (!pacoteDeAuditoria) return 0; return pacoteDeAuditoria.dados_suporte.perguntas.filter(item => item.Referencia_Area == idDaArea && item.Tipo_Item === 'Pergunta').length; }
export function getDetalhesDoPlanejamento(idDoPai) { if (!pacoteDeAuditoria) return null; const { planejamento_pai, departamentos, auditores } = pacoteDeAuditoria.dados_suporte; const planejamento = planejamento_pai.find(p => p.id == idDoPai); if (!planejamento) return null; const idDaArea = planejamento.Departamento; const departamentoInfo = departamentos.find(d => d.id == idDaArea); const auditorLiderInfo = auditores.find(a => a.id == planejamento.Auditor_Lider); const auditorAcompInfo = auditores.find(a => a.id == planejamento.Auditor_Acompanhante); const perguntasNestaArea = contarPerguntasParaArea(idDaArea); return { responsavel: departamentoInfo ? (departamentoInfo.gristHelper_Display2 || 'N/A') : 'N/A', auditorLider: auditorLiderInfo ? auditorLiderInfo.NomeAuditorRef : 'Não definido', auditorAcompanhante: auditorAcompInfo ? auditorAcompInfo.NomeAuditorRef : 'Não definido', totalPerguntas: perguntasNestaArea }; }
export function getInfoAuditoriaPrincipal() { if (!pacoteDeAuditoria || !pacoteDeAuditoria.auditoria_geral) return { Nome_Auditoria: 'N/A' }; return { Nome_Auditoria: pacoteDeAuditoria.auditoria_geral.IdAud || 'N/A' }; }
export function getDepartamentoAtivoNome() { const s = _getCurrentState(); if (!s || !pacoteDeAuditoria) return 'N/A'; const depto = pacoteDeAuditoria.dados_suporte.departamentos.find(d => d.id == s.areaId); return depto ? depto.Departamento : 'N/A'; }

// <-- MODIFICADO --- Lógica de cálculo de progresso adaptada
export function calcularProgresso(planejamentoId) {
    const state = getAuditoriaState(planejamentoId);
    if (!pacoteDeAuditoria || !state) return { respondidas: 0, total: 0, percentual: 0 };

    const perguntasDaAuditoria = pacoteDeAuditoria.dados_suporte.perguntas;
    const perguntasDaArea = perguntasDaAuditoria.filter(item => item.Referencia_Area == state.areaId);
    
    let totalPerguntasVisiveis = 0;
    let perguntasRespondidas = 0;

    const getRespostaDestaAuditoria = (id) => state.respostas[id];

    // Função de visibilidade aprimorada que entende o contexto da instância
    const avaliarCondicaoDestaAuditoria = (pergunta, instanciaInfo) => {
        const idPerguntaMaeOriginal = pergunta.Visibilidade_DependeDe;
        if (!idPerguntaMaeOriginal || idPerguntaMaeOriginal === 0) return true;
        
        // Constrói o ID da pergunta mãe considerando se está dentro de uma instância
        const idPerguntaMae = instanciaInfo 
            ? `${idPerguntaMaeOriginal}-${instanciaInfo.numero}` 
            : String(idPerguntaMaeOriginal);

        const valoresEsperados = pergunta.Visibilidade_Valor;
        const valorAtual = getRespostaDestaAuditoria(idPerguntaMae);

        if (valorAtual === undefined || valorAtual === null) return false;

        if (Array.isArray(valoresEsperados) && valoresEsperados[0] === 'L') {
            const idsEsperados = valoresEsperados.slice(1);
            return idsEsperados.includes(Number(valorAtual));
        }
        return String(valorAtual) === String(valoresEsperados);
    };

    function percorrerItens(itens, instanciaInfo = null) {
        itens.forEach(item => {
            // Se o item não for visível, seus filhos também não serão, então pulamos.
            if (!avaliarCondicaoDestaAuditoria(item, instanciaInfo)) return;

            const idBase = instanciaInfo ? `${item.id}-${instanciaInfo.numero}` : String(item.id);

            if (item.Tipo_Item === 'Pergunta') {
                totalPerguntasVisiveis++;
                const resposta = getRespostaDestaAuditoria(idBase);
                if (resposta && resposta !== '') {
                    perguntasRespondidas++;
                }
            }

            const filhos = perguntasDaAuditoria.filter(filho => filho.ID_Pai === item.id);

            if (item.Tipo_Item === 'Secao' || item.Tipo_Item === 'secao') {
                if (item.Repetivel === 'SIM') {
                    const contagemInstancias = state.instanciasRepetidas[item.id] || 0;
                    for (let i = 1; i <= contagemInstancias; i++) {
                        percorrerItens(filhos, { numero: i });
                    }
                } else {
                    // Para seções não repetíveis, continue passando o mesmo contexto de instância (se houver)
                    percorrerItens(filhos, instanciaInfo);
                }
            } else {
                // Para perguntas, também precisamos verificar seus filhos (perguntas condicionais)
                percorrerItens(filhos, instanciaInfo);
            }
        });
    }

    const itensRaiz = perguntasDaArea.filter(item => !item.ID_Pai || item.ID_Pai === 0);
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
    // Precisa buscar as opções de resposta para saber o texto
    const { opcoes_respostas } = pacoteDeAuditoria.dados_suporte;

    for (const respostaId of Object.values(state.respostas)) {
        const opcao = opcoes_respostas.find(o => o.id == respostaId);
        if (opcao) {
            const lowerCaseRes = String(opcao.Texto_Opcao).toLowerCase();
            if (lowerCaseRes === 'não conforme') nc++;
            else if (lowerCaseRes === 'nc maior') ncMaior++;
        }
    }
    return { nc, ncMaior };
}

export function resetarAuditoria(planejamentoId) {
    const idNum = Number(planejamentoId);
    if (auditoriasEmProgresso.has(idNum)) {
        auditoriasEmProgresso.delete(idNum);
        _saveStateToLocalStorage();
        return true; // Sucesso
    }
    return false; // Não encontrou
}

export function removerMidia(perguntaId, nomeDoArquivo) {
    const state = _getCurrentState();
    if (!state || !state.midias[perguntaId]) return;

    state.midias[perguntaId] = state.midias[perguntaId].filter(
        arquivo => arquivo.name !== nomeDoArquivo
    );

    // Se não houver mais mídias, remove a chave para limpar o estado
    if (state.midias[perguntaId].length === 0) {
        delete state.midias[perguntaId];
    }
    
    _saveStateToLocalStorage();
}

export function executarCalculo(formulaTexto, instanciaInfo) {
    if (!formulaTexto) return null;
    console.log(`--- Iniciando Cálculo --- (Instância: ${instanciaInfo ? instanciaInfo.numero : 'N/A'})`);
    console.log(`Fórmula: ${formulaTexto}`);

    const state = _getCurrentState();
    if (!state) {
        console.error("Estado da auditoria não encontrado!");
        return null;
    }

    const { perguntas, opcoes_respostas } = pacoteDeAuditoria.dados_suporte;
    const placeholderRegex = /\[([A-Z0-9_]+)\]/g; 

    let expressaoFinal = formulaTexto;
    let todosValoresEncontrados = true;
    const placeholders = formulaTexto.match(placeholderRegex) || [];

    for (const placeholder of placeholders) {
        const idCalculo = placeholder.replace(/[\[\]]/g, '');
        console.log(`Procurando valor para o placeholder: ${idCalculo}`);
        
        const perguntaFator = perguntas.find(p => p.IDCalculo === idCalculo);
        if (!perguntaFator) {
            console.warn(`IDCalculo "${idCalculo}" não encontrado nos modelos de pergunta.`);
            todosValoresEncontrados = false;
            continue;
        }

        // AQUI ESTÁ A CORREÇÃO CRÍTICA:
        // Constrói o ID completo do fator usando a informação da instância
        const idCompletoFator = instanciaInfo 
            ? `${perguntaFator.id}-${instanciaInfo.numero}`
            : String(perguntaFator.id);
        
        const respostaId = state.respostas[idCompletoFator];
        console.log(`   ID da pergunta-fator: ${idCompletoFator}, Resposta salva (ID da opção): ${respostaId}`);

        if (respostaId && respostaId !== '') {
            const opcao = opcoes_respostas.find(o => o.id == respostaId);
            if (opcao && typeof opcao.Valor_Calculo === 'number') {
                console.log(`   Valor numérico encontrado: ${opcao.Valor_Calculo}`);
                expressaoFinal = expressaoFinal.replace(placeholder, String(opcao.Valor_Calculo));
            } else {
                console.warn(`   Opção de resposta não encontrada ou sem Valor_Calculo para o ID ${respostaId}`);
                todosValoresEncontrados = false;
            }
        } else {
            console.warn(`   Nenhuma resposta encontrada para ${idCompletoFator}`);
            todosValoresEncontrados = false;
        }
    }

    if (!todosValoresEncontrados) {
        console.log(`Cálculo abortado: um ou mais fatores não foram preenchidos.`);
        return null; 
    }

    console.log(`Expressão final para cálculo: ${expressaoFinal}`);
    try {
        const expressaoSegura = expressaoFinal.replace(/[^-()\d/*+.]/g, '');
        const resultado = new Function('return ' + expressaoSegura)();
        console.log(`Resultado do cálculo: ${resultado}`);
        console.log(`--- Fim do Cálculo ---`);
        return resultado;
    } catch (error) {
        console.error("Erro ao executar a fórmula segura:", error);
        return null;
    }
}

export function getDescricaoDaFaixa(idDaFaixaRef, valor) {
    console.log(`--- Iniciando Busca de Faixa ---`);
    console.log(`Procurando Faixa com ID de Referência:`, idDaFaixaRef, `(tipo: ${typeof idDaFaixaRef})`);
    console.log(`... para o Valor numérico:`, valor, `(tipo: ${typeof valor})`);

    if (!pacoteDeAuditoria.dados_suporte.faixas_resultado || pacoteDeAuditoria.dados_suporte.faixas_resultado.length === 0) {
        console.error("ERRO: O array 'faixas_resultado' no JSON está vazio ou não existe!");
        return null;
    }

    // Para fins de depuração, vamos imprimir todo o array de faixas
    console.log("Conteúdo completo do array 'faixas_resultado':", pacoteDeAuditoria.dados_suporte.faixas_resultado);

    const faixaEncontrada = pacoteDeAuditoria.dados_suporte.faixas_resultado.find(f => {
        // Log para cada comparação individual
        console.log(`Comparando: RefFaixa (${f.RefFaixa}, tipo ${typeof f.RefFaixa}) == idDaFaixaRef (${idDaFaixaRef}, tipo ${typeof idDaFaixaRef}) -> ${f.RefFaixa == idDaFaixaRef}`);
        console.log(`           FaixaResult (${f.FaixaResult}, tipo ${typeof f.FaixaResult}) == valor (${valor}, tipo ${typeof valor}) -> ${f.FaixaResult == valor}`);
        return f.RefFaixa == idDaFaixaRef && f.FaixaResult == valor;
    });

    if (faixaEncontrada) {
        console.log("SUCESSO! Faixa encontrada:", faixaEncontrada, "CHAVES DISPONÍVEIS:", Object.keys(faixaEncontrada));
        console.log(`--- Fim da Busca de Faixa ---`);
        return {
            Descricao_Saida: faixaEncontrada.Result,
            Cor_Fundo: faixaEncontrada.Fundo || '#28a745',
            Cor_Texto: faixaEncontrada.Fonte || '#FFFFFF'
        };
    }

    console.warn("AVISO: Nenhuma faixa correspondente foi encontrada.");
    console.log(`--- Fim da Busca de Faixa ---`);
    return null;
}

export function getTodosOsModelosDePerguntas() {
    if (!pacoteDeAuditoria) return [];
    return pacoteDeAuditoria.dados_suporte.perguntas;
}