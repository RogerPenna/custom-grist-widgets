// js/reportGenerator.js (v2.0 - Layout de Checklist Vertical)

import * as Auditoria from './apaud_auditoria.js';

const { jsPDF } = window.jspdf;

// --- CONSTANTES DE LAYOUT ---
const MARGEM_ESQUERDA = 15;
const MARGEM_DIREITA = 210 - 15;
const LARGURA_MAX_TEXTO = MARGEM_DIREITA - MARGEM_ESQUERDA;
let cursorY = 0; // Posição vertical atual no documento
let doc; // Instância do documento PDF

// --- FUNÇÕES AUXILIARES DE DESENHO ---

// Adiciona texto com quebra de linha automática e avança o cursor
function adicionarTexto(texto, x, options = {}) {
    const { size = 10, style = 'normal', color = 0, espacoAntes = 0, espacoDepois = 2 } = options;
    cursorY += espacoAntes;
    
    // Verifica se precisa de uma nova página
    const alturaTexto = doc.getTextDimensions(texto, { fontSize: size, maxWidth: LARGURA_MAX_TEXTO - (x - MARGEM_ESQUERDA) }).h;
    if (cursorY + alturaTexto > 280) { // 280mm ~ margem inferior
        doc.addPage();
        cursorY = 20;
    }

    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(color);
    const linhas = doc.splitTextToSize(texto, LARGURA_MAX_TEXTO - (x - MARGEM_ESQUERDA));
    doc.text(linhas, x, cursorY);
    cursorY += (linhas.length * (size * 0.4)) + espacoDepois;
}

/**
 * Converte uma string de cor hexadecimal (#RRGGBB) para um array de números RGB ([R, G, B]).
 * @param {string} hex - A cor em formato hexadecimal.
 * @returns {Array<number>|null} - Um array com os valores [R, G, B] ou null se o formato for inválido.
 */
function hexToRgb(hex) {
    if (!hex || hex.length !== 7) return null; // Validação básica
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16), // R
        parseInt(result[2], 16), // G
        parseInt(result[3], 16)  // B
    ] : null;
}

// Adiciona uma linha horizontal
function adicionarLinhaSeparadora(espacoAntes = 3, espacoDepois = 5) {
    cursorY += espacoAntes;
    doc.setDrawColor(220); // Cinza claro
    doc.setLineWidth(0.2);
    doc.line(MARGEM_ESQUERDA, cursorY, MARGEM_DIREITA, cursorY);
    cursorY += espacoDepois;
}

// --- FUNÇÕES DE CONTEÚDO DO RELATÓRIO ---

function adicionarCabecalho(state, planejamento) {
    doc.setFont('helvetica', 'bold');
    adicionarTexto('Relatório de Auditoria Interna', MARGEM_ESQUERDA, { size: 18, espacoDepois: 8 });

    const nomeAuditoria = Auditoria.getInfoAuditoriaPrincipal().Nome_Auditoria;
    const depto = planejamento.Departamento_Departamento;
    const data = state.dataRealizada ? new Date(state.dataRealizada).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    adicionarTexto(`Auditoria: ${nomeAuditoria}`, MARGEM_ESQUERDA, { size: 11, color: 80, espacoAntes: 0, espacoDepois: 1 });
    adicionarTexto(`Departamento: ${depto}`, MARGEM_ESQUERDA, { size: 11, color: 80, espacoAntes: 0, espacoDepois: 1 });
    adicionarTexto(`Data de Realização: ${data}`, MARGEM_ESQUERDA, { size: 11, color: 80, espacoAntes: 0, espacoDepois: 4 });
    
    adicionarLinhaSeparadora(4, 8);
}

function adicionarResumo(ncData) {
    if (cursorY > 220) { // Precisa de mais espaço para o resumo
        doc.addPage();
        cursorY = 20;
    }
    
    adicionarLinhaSeparadora(10, 8);
    adicionarTexto('Resumo da Auditoria', MARGEM_ESQUERDA, { size: 14, style: 'bold', espacoDepois: 5 });

    // Função auxiliar interna para desenhar uma seção do resumo
    const desenharSecaoResumo = (titulo, perguntas, cor) => {
        if (perguntas.length === 0) return; // Pula se não houver itens

        adicionarTexto(`${titulo}: ${perguntas.length}`, MARGEM_ESQUERDA, { size: 11, style: 'bold', espacoAntes: 5, espacoDepois: 2 });
        
        doc.setDrawColor(cor[0], cor[1], cor[2]); // Define a cor da linha
        doc.setLineWidth(0.5);
        doc.line(MARGEM_ESQUERDA, cursorY, MARGEM_ESQUERDA + 40, cursorY); // Linha colorida
        cursorY += 3;

        perguntas.forEach(pergunta => {
            adicionarTexto(`- ${pergunta}`, MARGEM_ESQUERDA + 2, { size: 9, color: 80, espacoAntes: 1, espacoDepois: 1 });
        });
    };

    // Desenha cada seção do resumo
    desenharSecaoResumo('Não Conforme', ncData.nc, [253, 125, 20]); // Laranja
    desenharSecaoResumo('NC Maior', ncData.ncMaior, [220, 53, 69]); // Vermelho
    desenharSecaoResumo('Oportunidades de Melhoria', ncData.om, [139, 195, 74]); // Verde claro
}

// --- LÓGICA PRINCIPAL DE GERAÇÃO ---

export function gerarPDF(planejamentoId) {
    const state = Auditoria.getAuditoriaState(planejamentoId);
    const planejamento = Auditoria.getPlanejamentoPorId(planejamentoId);
    if (!state || !planejamento) return null;

    doc = new jsPDF('p', 'mm', 'a4');
    cursorY = 20;

    adicionarCabecalho(state, planejamento);

    const todosOsModelos = Auditoria.getTodosOsModelosDePerguntas();
    const mapaModelos = new Map(todosOsModelos.map(p => [p.id, p]));
    const ncData = { 
    nc: [], 
    ncMaior: [], 
    om: [] 
};

    function processarItem(itemId, nivelIndentacao = 0) {
        const modelo = mapaModelos.get(itemId);
        if (!modelo || !Auditoria.avaliarCondicao(modelo)) return;
        
        const x = MARGEM_ESQUERDA + (nivelIndentacao * 7);

        if (modelo.Tipo_Item === 'Secao') {
            adicionarLinhaSeparadora(5, 5);
            adicionarTexto(modelo.Texto_Pergunta, x, { size: 11, style: 'bold', color: 50 });
        } else if (modelo.Tipo_Item === 'Pergunta') {
            adicionarTexto(modelo.Texto_Pergunta, x, { size: 10, style: 'bold' });

            // Resposta com cor
            const respostaId = Auditoria.getResposta(itemId);
            if (respostaId) {
                const respostaObj = Auditoria.getDadosCompletosPergunta(itemId);
                const opcaoSalva = respostaObj.opcoes.find(o => o.id == respostaId);
                const respostaTexto = opcaoSalva ? opcaoSalva.Texto_Opcao : String(respostaId);
                
                // Contabiliza para o resumo
                const lowerCaseRes = respostaTexto.toLowerCase();
if (lowerCaseRes === 'não conforme') ncData.nc.push(modelo.Texto_Pergunta);
if (lowerCaseRes === 'nc maior') ncData.ncMaior.push(modelo.Texto_Pergunta);
if (lowerCaseRes === 'oportunidade de melhoria') ncData.om.push(modelo.Texto_Pergunta);
                
                // Converte cor Hex (#RRGGBB) para array [R, G, B]
                const corFundoRgb = hexToRgb(opcaoSalva?.Fundo);
const corFonteRgb = hexToRgb(opcaoSalva?.Fonte);

// Define as cores, apenas se a conversão foi bem-sucedida
if (corFundoRgb) {
    doc.setFillColor(corFundoRgb[0], corFundoRgb[1], corFundoRgb[2]);
} else {
    doc.setFillColor(255, 255, 255); // Fundo branco padrão
}

if (corFonteRgb) {
    doc.setTextColor(corFonteRgb[0], corFonteRgb[1], corFonteRgb[2]);
} else {
    doc.setTextColor(0, 0, 0); // Texto preto padrão
}

doc.setFont('helvetica', 'bold');
doc.setFontSize(9);

const dim = doc.getTextDimensions(respostaTexto);
// Desenha o retângulo de fundo com um pequeno padding
doc.rect(x, cursorY + 1, dim.w + 4, dim.h + 2, 'F');
// Desenha o texto por cima
doc.text(respostaTexto, x + 2, cursorY + 5);

cursorY += dim.h + 4; // Avança o cursor

// Reseta as cores para o padrão para o resto do documento
doc.setTextColor(0, 0, 0);
            }

            // Anotação
            const anotacao = Auditoria.getAnotacao(itemId);
            if (anotacao) {
                adicionarTexto(anotacao, x + 2, { size: 9, style: 'italic', color: 80, espacoAntes: 2 });
            }
			adicionarLinhaSeparadora(5, 5); 
        }

        const filhos = todosOsModelos.filter(p => p.ID_Pai === itemId).sort((a,b) => a.Ordem - b.Ordem);
        filhos.forEach(filho => processarItem(filho.id, nivelIndentacao + 1));
    }

    const checklistDaArea = Auditoria.getChecklistParaAreaAtiva();
    const itensRaiz = checklistDaArea.filter(p => !p.ID_Pai || p.ID_Pai === 0).sort((a,b) => a.Ordem - b.Ordem);
    
    itensRaiz.forEach(item => processarItem(item.id, 0));
    
    adicionarResumo(ncData);

    return doc.output('blob');
}