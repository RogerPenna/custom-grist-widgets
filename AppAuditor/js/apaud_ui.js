import * as Auditoria from './apaud_auditoria.js';

// --- Funções de Controle da UI ---

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

    if (!planejamentos || planejamentos.length === 0) {
        container.innerHTML = '<p>Nenhum planejamento de auditoria encontrado.</p>';
        return;
    }

    planejamentos.forEach(item => {
        const div = document.createElement('div');
        div.className = 'planejamento-item';
        div.dataset.id = item.id;
        div.dataset.areaId = item.Departamento;

        const totalPerguntas = Auditoria.contarPerguntasParaArea(item.Departamento);
        const dataFormatada = item.Data ? new Date(item.Data * 1000).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data não definida';

        div.innerHTML = `
            <h4>${item.Departamento_Departamento || 'Área não definida'}</h4>
            <p>Data Planejada: ${dataFormatada}</p>
            <p class="info-perguntas"><strong>${totalPerguntas}</strong> perguntas nesta auditoria.</p>
            <div class="card-detalhes"></div>`;
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

    if (!isExpandido && detalhes) {
        cardElement.classList.add('selecionado');
        detalheAtual.classList.add('expandido');
        detalheAtual.innerHTML = `
            <p><strong>Responsável:</strong> ${detalhes.responsavel}</p>
            <p><strong>Líder:</strong> ${detalhes.auditorLider}</p>
            <p><strong>Acompanhante:</strong> ${detalhes.auditorAcompanhante}</p>
            <button class="iniciar-auditoria-btn">Iniciar Auditoria</button>`;
    }
}


// --- Novo Motor de Renderização Hierárquico ---

export function renderizarChecklistCompleto() {
    const container = document.getElementById('checklist-container');
    container.innerHTML = '';
    
    const checklist = Auditoria.getChecklistParaAreaAtiva();
    if (!checklist || checklist.length === 0) {
        container.innerHTML = '<h3>Nenhuma pergunta para esta auditoria.</h3>';
        return;
    }

    // A lógica agora começa pelos itens que são filhos diretos da "área", ou seja, não têm Pai DENTRO do checklist.
    const itensRaiz = checklist.filter(item => !item.ID_Pai || item.ID_Pai === 0)
                               .sort((a, b) => a.Ordem - b.Ordem);

    itensRaiz.forEach(item => renderizarItem(item, container, checklist));
}

function renderizarItem(item, containerPai, checklistCompleto, instanciaInfo = null) {
    const isVisivel = Auditoria.avaliarCondicao(item);
    if (!isVisivel) return;

    const dadosCompletos = Auditoria.getDadosCompletosPergunta(item.id);
    const { modelo, opcoes } = dadosCompletos;

    if (modelo.Tipo_Item === 'Secao' || modelo.Tipo_Item === 'secao') {
        // ... (código da seção, sem mudanças) ...
        const secaoCard = document.createElement('div');
        secaoCard.className = 'secao-card';
        const botaoRepetirHTML = modelo.Repetivel === 'SIM' ? `<button class="botao-repetir-secao" data-secao-id="${modelo.id}" title="Adicionar ${modelo.Texto_Pergunta}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>` : '';
        secaoCard.innerHTML = `<div class="secao-header"><h3>${modelo.Texto_Pergunta}</h3>${botaoRepetirHTML}</div><div class="secao-body"></div><div class="secao-instancias-container"></div>`;
        containerPai.appendChild(secaoCard);
        const secaoBody = secaoCard.querySelector('.secao-body');
        const filhos = checklistCompleto.filter(filho => filho.ID_Pai == item.id).sort((a,b) => a.Ordem - b.Ordem);
        filhos.forEach(filho => renderizarItem(filho, secaoBody, checklistCompleto));
        const contagemInstancias = Auditoria.getContagemInstancias(modelo.id);
        const containerInstancias = secaoCard.querySelector('.secao-instancias-container');
        for (let i = 1; i <= contagemInstancias; i++) {
            renderizarInstanciaSecao(modelo, containerInstancias, checklistCompleto, i);
        }
    } else if (modelo.Tipo_Item === 'Pergunta') {
        const perguntaCard = document.createElement('div');
        perguntaCard.className = 'pergunta-card';
        const perguntaIdUnico = instanciaInfo ? `${modelo.id}-${instanciaInfo.numero}` : String(modelo.id);
        
        // NOVO: Lógica para o ícone de detalhes
        let detalheIconeHTML = '';
        if (modelo.Detalhe_Pergunta) {
            detalheIconeHTML = `<button class="botao-detalhe" title="${modelo.Detalhe_Pergunta}">ⓘ</button>`;
        }

        let respostasHTML = '';
        // Lógica para renderizar botões de múltipla escolha
        if (opcoes.length > 0) {
            respostasHTML = opcoes.map(opt => {
                const isSelecionado = Auditoria.getResposta(perguntaIdUnico) === opt.Texto_Opcao;
                const estilo = isSelecionado ? `style="background-color:${opt.Fundo}; color:${opt.Fonte}; border-color:${opt.Fundo};"` : '';
                return `<button class="botao-resposta ${isSelecionado ? 'selecionado' : ''}" data-pergunta-id="${perguntaIdUnico}" data-valor="${opt.Texto_Opcao}" ${estilo}>${opt.Texto_Opcao}</button>`;
            }).join('');
        } 
        // LÓGICA CORRIGIDA para TextoLivre e outros tipos
        else if (modelo.Tipo_Resposta_Utilizado) { 
            // Usa o valor salvo na memória, ou uma string vazia
            const valorSalvo = Auditoria.getResposta(perguntaIdUnico) || '';
            respostasHTML = `<textarea class="resposta-texto" data-pergunta-id="${perguntaIdUnico}" placeholder="Digite sua observação...">${valorSalvo}</textarea>`;
        }

        perguntaCard.innerHTML = `
            <div class="pergunta-header">
                <p class="texto-pergunta">${modelo.Texto_Pergunta}</p>
                ${detalheIconeHTML}
            </div>
            <div class="respostas-container">${respostasHTML}</div>
            <div class="acoes-container">
                <button class="botao-acao botao-anotacao" data-pergunta-id="${perguntaIdUnico}">📝 Anotações</button>
                <button class="botao-acao botao-midia" data-pergunta-id="${perguntaIdUnico}">🖼️ Mídia</button>
            </div>
            <div class="anotacao-area"></div>
        `;
        containerPai.appendChild(perguntaCard);
    }
}

// NOVA FUNÇÃO: Desenha uma instância de uma seção repetida
function renderizarInstanciaSecao(modeloSecao, container, checklistCompleto, numeroInstancia) {
    const instanciaContainer = document.createElement('div');
    instanciaContainer.className = 'secao-repetida-container';
    instanciaContainer.dataset.instanciaId = `${modeloSecao.id}-${numeroInstancia}`;

    instanciaContainer.innerHTML = `
        <div class="secao-repetida-header">
            <h4>${modeloSecao.Texto_Pergunta} ${numeroInstancia}</h4>
            <button class="botao-remover-secao" title="Remover esta instância">🗑️</button>
        </div>
    `;
    
    // Encontra as perguntas que são filhas desta seção e as renderiza
    const filhos = checklistCompleto.filter(filho => filho.ID_Pai == modeloSecao.id).sort((a,b) => a.Ordem - b.Ordem);
    filhos.forEach(filho => {
        // Passa a informação da instância para os filhos, para que eles tenham IDs únicos
        renderizarItem(filho, instanciaContainer, checklistCompleto, { secaoPaiId: modeloSecao.id, numero: numeroInstancia });
    });

    container.appendChild(instanciaContainer);
}
export function atualizarHeaderProgresso() {
    const progresso = Auditoria.calcularProgresso();
    const progressoEl = document.getElementById('header-progresso');
    if (progressoEl) {
        progressoEl.textContent = `${progresso.respondidas} / ${progresso.total} (${progresso.percentual}%)`;
    }
}
export function alternarAreaAnotacao(cardElement) {
    // Procura por uma área de anotação já existente
    let area = cardElement.querySelector('.anotacao-area');
    
    // Se a área já existe, remove (fecha)
    if (area) {
        area.remove();
        return;
    }
    
    // Se não existe, cria e adiciona
    area = document.createElement('div');
    area.className = 'anotacao-area visivel'; // 'visivel' já estará ativo
    area.innerHTML = `
        <textarea placeholder="Digite suas anotações..."></textarea>
        <div class="anotacao-botoes">
            <button class="botao-cancelar-anotacao">Cancelar</button>
            <button class="botao-salvar-anotacao">Salvar</button>
        </div>
    `;
    // Adiciona a nova área logo após o container de ações
    cardElement.querySelector('.acoes-container').insertAdjacentElement('afterend', area);
}