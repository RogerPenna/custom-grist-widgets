import * as Auditoria from './apaud_auditoria.js';

export const estadoUI = {
    secoesExpandidas: new Set() // Usaremos um Set para armazenar IDs únicos de seções expandidas
};


// --- Funções de Controle da UI ---
export function atualizarHeaderTitulo() {
    const tituloEl = document.getElementById('header-titulo');
    if (!tituloEl) return;

    const infoAuditoria = Auditoria.getInfoAuditoriaPrincipal();
    const nomeDepartamento = Auditoria.getDepartamentoAtivoNome();

    tituloEl.textContent = `Auditoria: ${infoAuditoria.Nome_Auditoria}, ${nomeDepartamento}`;
}

export function atualizarHeaderProgresso() {
    const progressoEl = document.getElementById('header-progresso');
    if (!progressoEl) return;

    const progresso = Auditoria.calcularProgresso();
    progressoEl.textContent = `${progresso.respondidas} / ${progresso.total} (${progresso.percentual}%)`;
}

export function mostrarTela(idDaTela) {
    document.querySelectorAll('.tela').forEach(tela => tela.classList.remove('ativa'));
    const telaAtiva = document.getElementById(idDaTela);
    if (telaAtiva) telaAtiva.classList.add('ativa');
}

export function mostrarStatusCarregamento(mensagem, tipo = 'info') {
    const statusDiv = document.getElementById('status-carregamento');
    if (!statusDiv) return;
    statusDiv.textContent = mensagem;
    statusDiv.style.color = (tipo === 'sucesso') ? 'green' : (tipo === 'erro') ? 'red' : 'black';
}

export function renderizarListaDePlanejamentos(planejamentos) {
    const container = document.getElementById('lista-planejamentos');
    container.innerHTML = '';
    const auditoriaAtiva = Auditoria.getAuditoriaAtiva();

    if (!planejamentos || planejamentos.length === 0) { /*...*/ }

    planejamentos.forEach(item => {
        const div = document.createElement('div');
        div.className = 'planejamento-item';
        
        // LÓGICA DE STATUS APRIMORADA
        if (auditoriaAtiva && auditoriaAtiva.planejamentoId == item.id) {
            if (auditoriaAtiva.status === 'em_progresso') {
                div.classList.add('em-progresso');
            } else if (auditoriaAtiva.status === 'finalizada') {
                div.classList.add('finalizada');
            }
        }
        // ... (resto da função é igual)
        div.dataset.id = item.id;
        div.dataset.areaId = item.Departamento;
        const totalPerguntas = Auditoria.contarPerguntasParaArea(item.Departamento);
        const dataFormatada = item.Data ? new Date(item.Data * 1000).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/D';
        div.innerHTML = `<h4>${item.Departamento_Departamento || 'Área não definida'}</h4><p>Data Planejada: ${dataFormatada}</p><p class="info-perguntas"><strong>${totalPerguntas}</strong> perguntas.</p><div class="card-detalhes"></div>`;
        container.appendChild(div);
    });
}


export function expandirCard(cardElement, detalhes) {
    const detalheAtual = cardElement.querySelector('.card-detalhes');
    const isExpandido = detalheAtual.classList.contains('expandido');

    // Retrai todos os outros cards
    document.querySelectorAll('.card-detalhes.expandido').forEach(d => {
        d.innerHTML = '';
        d.classList.remove('expandido');
        d.closest('.planejamento-item').classList.remove('selecionado');
    });

    if (isExpandido) return; // Se já estava expandido, apenas fecha

    cardElement.classList.add('selecionado');
    detalheAtual.classList.add('expandido');
    
    let htmlInterno = '';

    // Se o card está marcado como EM PROGRESSO
    if (cardElement.classList.contains('em-progresso')) {
        const progresso = Auditoria.calcularProgresso();
        const ncs = Auditoria.contarNaoConformidades();
        htmlInterno = `
            <div class="resumo-progresso">
                <p><strong>Progresso:</strong> ${progresso.respondidas} / ${progresso.total} (${progresso.percentual}%)</p>
                <p><span class="nc-normal">${ncs.nc}</span> Não Conformidades</p>
                <p><span class="nc-maior">${ncs.ncMaior}</span> NC Maiores</p>
            </div>
            <div class="botoes-acao-card">
                <button class="btn-primario btn-continuar">Continuar Auditoria</button>
            </div>
        `;
    // Se o card está marcado como FINALIZADA
    } else if (cardElement.classList.contains('finalizada')) {
        htmlInterno = `
            <p>Auditoria finalizada. Você pode reabri-la para edição ou exportar os resultados.</p>
            <div class="botoes-acao-card">
                <button class="btn-secundario btn-reabrir">Reabrir</button>
                <button class="btn-pdf btn-exportar-pdf">Exportar PDF</button>
            </div>
        `;
    // Se for uma auditoria nova
    } else {
        htmlInterno = `
            <p><strong>Responsável:</strong> ${detalhes.responsavel}</p>
            <p><strong>Líder Planejado:</strong> ${detalhes.auditorLider}</p>
            <p><strong>Acompanhante Planejado:</strong> ${detalhes.auditorAcompanhante}</p>
            <button class="iniciar-auditoria-btn">Iniciar Nova Auditoria</button>
        `;
    }

    detalheAtual.innerHTML = htmlInterno;
}


// --- Novo Motor de Renderização Hierárquico ---

export function renderizarChecklistCompleto() {
    const container = document.getElementById('checklist-container');
    container.innerHTML = '';
    // ... (código existente da função) ...
    const checklist = Auditoria.getChecklistParaAreaAtiva();
    if (!checklist || checklist.length === 0) {
        container.innerHTML = '<h3>Nenhuma pergunta para esta auditoria.</h3>';
        return;
    }
    const itensRaiz = checklist.filter(item => !item.ID_Pai || item.ID_Pai === 0).sort((a, b) => a.Ordem - b.Ordem);
    itensRaiz.forEach(item => renderizarItem(item, container, checklist));

    // NOVO: Adiciona o botão de finalizar no final
    const finalizarDiv = document.createElement('div');
    finalizarDiv.className = 'finalizar-container';
    finalizarDiv.innerHTML = `<button id="btn-finalizar-auditoria">Finalizar e Salvar Auditoria</button>`;
    container.appendChild(finalizarDiv);
}

export function mostrarModalFinalizar(resultadoJSON) {
    const modal = document.getElementById('modal-finalizar');
    const textarea = document.getElementById('resultado-json-output');
    textarea.value = JSON.stringify(resultadoJSON, null, 2); // Formata o JSON para leitura
    modal.style.display = 'flex';
}

function renderizarItem(item, containerPai, checklistCompleto, instanciaInfo = null) {
    if (!Auditoria.avaliarCondicao(item)) return;

    const dadosCompletos = Auditoria.getDadosCompletosPergunta(item.id);
    const { modelo } = dadosCompletos;

    if (modelo.Tipo_Item === 'Secao' || modelo.Tipo_Item === 'secao') {
        // Seção Repetível
        if (modelo.Repetivel === 'SIM') {
            const contagemInstancias = Auditoria.getContagemInstancias(modelo.id);
            for (let i = 1; i <= contagemInstancias; i++) {
                renderizarInstanciaSecao(modelo, containerPai, checklistCompleto, i);
            }
            renderizarBotaoAdicionar(modelo, containerPai);
        } else {
            // NOVO: Seção Não Repetível
            renderizarSecaoNaoRepetivel(modelo, containerPai, checklistCompleto);
        }
    } else if (modelo.Tipo_Item === 'Pergunta') {
        renderizarPergunta(dadosCompletos, containerPai, instanciaInfo);
    }
}

function renderizarPergunta(dadosCompletos, containerPai, instanciaInfo) {
    const { modelo, opcoes } = dadosCompletos;
    const perguntaCard = document.createElement('div');
    perguntaCard.className = 'pergunta-card';
    const idUnico = instanciaInfo ? `${modelo.id}-${instanciaInfo.numero}` : String(modelo.id);
    perguntaCard.dataset.itemId = idUnico;

    // --- LÓGICA DOS INDICADORES ---
    const anotacaoSalva = Auditoria.getAnotacao(idUnico);
    const temAnotacao = anotacaoSalva && anotacaoSalva.trim() !== '';
    const classeAnotacao = temAnotacao ? 'com-conteudo' : '';
    const linhasAnotacao = temAnotacao ? anotacaoSalva.split('\n').length : 0;
    const contadorAnotacaoHTML = temAnotacao ? `<span class="contador-conteudo">(${linhasAnotacao} ${linhasAnotacao > 1 ? 'linhas' : 'linha'})</span>` : '';

    const midiasAnexadas = Auditoria.getMidias(idUnico);
    const temMidia = midiasAnexadas.length > 0;
    const classeMidia = temMidia ? 'com-conteudo' : '';
    const contadorMidiaHTML = temMidia ? `<span class="contador-conteudo">(${midiasAnexadas.length})</span>` : '';

    const iconeAnotacao = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z"/><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z"/></svg> Anotações ${contadorAnotacaoHTML}`;
    const iconeMidia = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-3.69l-2.76-2.76a.75.75 0 00-1.06 0l-2.22 2.22a.75.75 0 000 1.06l-2.22-2.22a.75.75 0 00-1.06 0l-2.22 2.22a.75.75 0 000 1.06l-1.47-1.47a.75.75 0 00-1.06 0L2.5 11.06zM6.25 7a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd"/></svg> Mídia ${contadorMidiaHTML}`;

    let respostasHTML = '';
    if (opcoes.length > 0) {
        respostasHTML = opcoes.map(opt => {
            const isSelecionado = Auditoria.getResposta(idUnico) === opt.Texto_Opcao;
            const estilo = isSelecionado ? `style="background-color:${opt.Fundo}; color:${opt.Fonte}; border-color:${opt.Fundo};"` : '';
            return `<button class="botao-resposta ${isSelecionado ? 'selecionado' : ''}" data-pergunta-id="${idUnico}" data-valor="${opt.Texto_Opcao}" ${estilo}>${opt.Texto_Opcao}</button>`;
        }).join('');
    } else if (modelo.Tipo_Resposta_Utilizado) {
        const valorSalvo = Auditoria.getResposta(idUnico) || '';
        respostasHTML = `<textarea class="resposta-texto" data-pergunta-id="${idUnico}" placeholder="Digite sua observação...">${valorSalvo}</textarea>`;
    }

    perguntaCard.innerHTML = `
        <p class="texto-pergunta">${modelo.Texto_Pergunta}</p>
        <div class="respostas-container">${respostasHTML}</div>
        <div class="acoes-container">
            <button class="botao-acao botao-anotacao ${classeAnotacao}">${iconeAnotacao}</button>
            <button class="botao-acao botao-midia ${classeMidia}">${iconeMidia}</button>
        </div>`;
    containerPai.appendChild(perguntaCard);
}

function renderizarBotaoAdicionar(modeloSecao, containerPai) {
    const cardAdicionar = document.createElement('div');
    cardAdicionar.className = 'secao-adicionar-card';
    cardAdicionar.dataset.secaoId = modeloSecao.id;
    cardAdicionar.innerHTML = `
        <div class="icone-add">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
        <h4>${modeloSecao.Texto_Pergunta}</h4>
    `;
    containerPai.appendChild(cardAdicionar);
}

function renderizarSecaoNaoRepetivel(modeloSecao, containerPai, checklistCompleto) {
    const secaoCard = document.createElement('div');
    secaoCard.className = 'secao-nao-repetivel';
    const idUnicoSecao = `secao-${modeloSecao.id}`;

    const iconeToggle = `<svg class="icone-toggle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>`;
    
    // Seções não repetíveis começam expandidas por padrão para simplicidade
    const deveExpandir = true; 

    secaoCard.innerHTML = `
        <div class="secao-header" data-id-unico="${idUnicoSecao}">
            <div class="titulo-container">${iconeToggle} <h4>${modeloSecao.Texto_Pergunta}</h4></div>
        </div>
        <div class="secao-body ${deveExpandir ? 'expandido' : ''}"></div>`;
    containerPai.appendChild(secaoCard);

    if (deveExpandir) {
        secaoCard.querySelector('.icone-toggle').classList.add('expandido');
    }

    const corpo = secaoCard.querySelector('.secao-body');
    const filhos = checklistCompleto.filter(filho => filho.ID_Pai == modeloSecao.id).sort((a,b) => a.Ordem - b.Ordem);
    filhos.forEach(filho => renderizarItem(filho, corpo, checklistCompleto));
}

function renderizarInstanciaSecao(modeloSecao, containerPai, checklistCompleto, numeroInstancia) {
    // --- PASSO 1: Preparar os dados e o estado ---
    const instanciaCard = document.createElement('div');
    instanciaCard.className = 'secao-instancia-card';
    instanciaCard.dataset.secaoModeloId = modeloSecao.id;

    const idUnicoSecao = `${modeloSecao.id}-${numeroInstancia}`; // ID único para esta instância específica

    const iconeToggle = `<svg class="icone-toggle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>`;
    const iconeLixeira = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.576l.84-10.518.149.022a.75.75 0 10.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25-.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>`;

    // --- PASSO 2: Usar o NOVO sistema de estado para decidir a expansão ---
    // Verifica se a instância foi recém-adicionada
    const recemAdicionada = Auditoria.verificarUltimaInstanciaAdicionada(modeloSecao.id, numeroInstancia);
    if (recemAdicionada) {
        // Se for nova, garante que ela seja adicionada ao nosso registro de seções expandidas
        estadoUI.secoesExpandidas.add(idUnicoSecao);
    }
    // A decisão final de expandir vem do nosso registro de estado
    const deveExpandir = estadoUI.secoesExpandidas.has(idUnicoSecao);


    // --- PASSO 3: Gerar o HTML UMA ÚNICA VEZ com todos os dados corretos ---
    instanciaCard.innerHTML = `
    <div class="secao-header secao-instancia-header" data-id-unico="${idUnicoSecao}">
        <div class="titulo-container">
            <span class="icone-toggle-container">${iconeToggle}</span> 
            <h4>${modeloSecao.Texto_Pergunta} ${numeroInstancia}</h4>
        </div>
        <button class="botao-remover-secao" data-secao-id="${modeloSecao.id}" data-instancia-numero="${numeroInstancia}">${iconeLixeira}</button>
    </div>
    <div class="secao-instancia-body ${deveExpandir ? 'expandido' : ''}"></div>`;


    // --- PASSO 4: Manipular o DOM após a criação ---
    // Adiciona a classe no ícone se a seção estiver expandida
    if (deveExpandir) {
        instanciaCard.querySelector('.icone-toggle').classList.add('expandido');
    }

    // Adiciona o card ao container principal
    containerPai.appendChild(instanciaCard);
    
    // Pega o corpo da seção que acabamos de criar
    const corpo = instanciaCard.querySelector('.secao-instancia-body');

    // Renderiza os filhos DENTRO do corpo da seção
    const filhos = checklistCompleto.filter(filho => filho.ID_Pai == modeloSecao.id).sort((a,b) => a.Ordem - b.Ordem);
    filhos.forEach(filho => renderizarItem(filho, corpo, checklistCompleto, { numero: numeroInstancia }));
}


export function expandirAnotacaoParaFullscreen(textoAtual, callbackSalvar) {
    // Previne a criação de múltiplos modais
    if (document.querySelector('.modal-anotacao-fullscreen')) return;

    const modal = document.createElement('div');
    modal.className = 'modal-anotacao-fullscreen';
    // Adicionamos botões de Salvar e Cancelar mais claros
    modal.innerHTML = `
        <div class="modal-header">
            <h3>Anotações</h3>
            <button id="modal-anotacao-cancelar" class="botao-modal-cancelar">&times;</button>
        </div>
        <textarea placeholder="Digite suas anotações...">${textoAtual}</textarea>
        <div class="anotacao-botoes-modal">
             <button id="modal-anotacao-salvar" class="botao-modal-salvar">Salvar e Fechar</button>
        </div>
    `;
    document.body.appendChild(modal);

    const textarea = modal.querySelector('textarea');
    textarea.focus(); // Foca no campo de texto ao abrir

    const fecharESalvar = () => {
        callbackSalvar(textarea.value);
        if (modal.parentElement) {
            document.body.removeChild(modal);
        }
    };

    const fecharSemSalvar = () => {
         if (modal.parentElement) {
            document.body.removeChild(modal);
        }
    };

    document.getElementById('modal-anotacao-salvar').addEventListener('click', fecharESalvar);
    document.getElementById('modal-anotacao-cancelar').addEventListener('click', fecharSemSalvar);
}
export function renderizarTelaConfirmacao(planejamento, todosAuditores) {
    // Popula o nome do departamento
    document.getElementById('confirmacao-departamento').textContent = planejamento.Departamento_Departamento;

    // Popula e seleciona a data
    const dataInput = document.getElementById('data-auditoria');
    // Converte o timestamp (em segundos) para o formato YYYY-MM-DD
    const dataPlanejada = planejamento.Data ? new Date(planejamento.Data * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    dataInput.value = dataPlanejada;

    // Popula os selects de auditores
    const liderSelect = document.getElementById('auditor-lider-select');
    const acompSelect = document.getElementById('auditor-acomp-select');

    liderSelect.innerHTML = '<option value="0">Nenhum</option>'; // Opção padrão
    acompSelect.innerHTML = '<option value="0">Nenhum</option>'; // Opção padrão

    todosAuditores.forEach(auditor => {
        const optionHTML = `<option value="${auditor.id}">${auditor.NomeAuditorRef}</option>`;
        liderSelect.innerHTML += optionHTML;
        acompSelect.innerHTML += optionHTML;
    });

    // Pré-seleciona os auditores planejados
    liderSelect.value = planejamento.Auditor_Lider || "0";
    acompSelect.value = planejamento.Auditor_Acompanhante || "0";
}