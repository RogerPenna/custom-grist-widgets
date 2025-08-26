// js/modaud_ui.js

export function renderizarPerguntas(container, records, options = {}) {
    container.innerHTML = '';

    if (!records || records.length === 0) {
        container.innerHTML = '<p>Nenhuma pergunta encontrada para este contexto.</p>';
        return;
    }
    
    // Pega o mapa passado pelas opções
    const mapaTiposResposta = options.mapaTiposResposta || new Map();

    const recordsMap = new Map(records.map(r => [r.id, {...r, children: []}]));
    const rootRecords = [];

    for (const record of recordsMap.values()) {
        const parentId = record.ID_Pai;
        if (parentId && recordsMap.has(parentId)) {
            recordsMap.get(parentId).children.push(record);
        } else {
            rootRecords.push(record);
        }
    }
    
    const sortFn = (a, b) => (a.Ordem || 0) - (b.Ordem || 0);
    rootRecords.sort(sortFn);
    for (const record of recordsMap.values()) {
        if (record.children.length > 1) {
            record.children.sort(sortFn);
        }
    }
    
    function criarHierarquiaDOM(items, parentDomElement) {
        for (const item of items) {
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'card-wrapper';
            
            const card = document.createElement('div');
            card.className = 'pergunta-card';
            const tipoItem = item.Tipo_Item || 'pergunta';
            const classeTipo = `tipo-${tipoItem.toLowerCase().replace(/ /g, '_')}`;
            card.classList.add(classeTipo);
            card.dataset.id = item.id;

            // --- LÓGICA DE GERAÇÃO DAS CÁPSULAS (CORREÇÃO FINAL) ---
            let infoCapsulesHTML = '';
            if (tipoItem === 'Pergunta') {
                // USA O MAPA PARA ENCONTRAR O NOME A PARTIR DO ID
                const tipoRespostaId = item.Tipo_Resposta_Utilizado;
                if (tipoRespostaId && mapaTiposResposta.has(tipoRespostaId)) {
                    infoCapsulesHTML += `<span class="info-capsule">${mapaTiposResposta.get(tipoRespostaId)}</span>`;
                }
                if (item.IDCalculo) {
                    infoCapsulesHTML += `<span class="info-capsule var-capsule">[${item.IDCalculo}]</span>`;
                }
            } else if (tipoItem === 'Secao') {
                if (item.Repetivel) {
                    const iconColor = String(item.Repetivel).trim().toLowerCase() === 'sim' ? 'currentColor' : '#a0a0a-';
                    infoCapsulesHTML += `<span class="info-capsule icon-capsule" title="Repetível: ${item.Repetivel}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="${iconColor}">
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                        </svg>
                    </span>`;
                }
                if (item.Visibilidade_DependeDe) {
                    infoCapsulesHTML += `<span class="info-capsule visibility-capsule" title="Este item tem regras de visibilidade">Visibilidade</span>`;
                }
            } else if (tipoItem === 'resultado_calculado') {
                if (item.Formula) {
                    infoCapsulesHTML += `<span class="info-capsule formula-capsule">${item.Formula}</span>`;
                }
            }

            card.innerHTML = `
                <span class="drag-handle">::</span>
                <span class="pergunta-texto">${item.Texto_Pergunta || '(Pergunta sem texto)'}</span>
                <div class="capsules-container">${infoCapsulesHTML}</div>
                <button class="add-child-btn" title="Adicionar sub-item">+</button>
                <button class="edit-btn" title="Editar detalhes">⚙️</button>
            `;
            
            cardWrapper.appendChild(card);
            
            const subContainer = document.createElement('div');
            subContainer.className = 'sub-perguntas-container sortable-list';
            if (item.children.length === 0) {
                subContainer.classList.add('empty');
            }
            subContainer.dataset.parentId = item.id;
            cardWrapper.appendChild(subContainer);
    
            parentDomElement.appendChild(cardWrapper);
            
            if (item.children.length > 0) {
                criarHierarquiaDOM(item.children, subContainer);
            }
        }
        
        parentDomElement.insertAdjacentHTML('beforeend', '<button class="add-sibling-btn" title="Adicionar item neste nível">+</button>');
    }
    
    criarHierarquiaDOM(rootRecords, container);
}