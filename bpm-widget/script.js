/**
 * Grist BPM Studio - Core Script
 * Comprehensive Business Process Management Widget for Grist
 */

const STATE = {
  activeTab: 'inbox',
  processes: [],
  instances: [],
  tasks: [],
  history: [],
  currentSelectedTask: null,
  currentDesignerFlow: {
    id: 'PROC_COMPRAS',
    name: 'Aprovação de Compras e Suprimentos',
    nodes: [
      { id: 'node_1', type: 'start', title: 'Solicitação Criada', x: 40, y: 120 },
      { id: 'node_2', type: 'user-task', title: 'Aprovação Gestor', assignee: 'Gestor Direto', sla: 24, x: 220, y: 120 },
      { id: 'node_3', type: 'gateway', title: 'Valor > R$ 5.000?', x: 440, y: 120 },
      { id: 'node_4', type: 'user-task', title: 'Aprovação Diretoria', assignee: 'Diretoria', sla: 48, x: 640, y: 50 },
      { id: 'node_5', type: 'service-task', title: 'Gerar Ordem de Compra', assignee: 'Automação ERP', sla: 2, x: 640, y: 200 },
      { id: 'node_6', type: 'end', title: 'Processo Concluído', x: 860, y: 120 }
    ],
    connections: [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3' },
      { from: 'node_3', to: 'node_4', label: 'Sim' },
      { from: 'node_3', to: 'node_5', label: 'Não' },
      { from: 'node_4', to: 'node_5' },
      { from: 'node_5', to: 'node_6' }
    ]
  },
  selectedNodeId: null,
  gristConnected: false,
  selectedGristRecord: null
};

// Preset Process Templates
const TEMPLATES = {
  compra: {
    id: 'PROC_COMPRAS',
    name: 'Aprovação de Compras e Suprimentos',
    nodes: [
      { id: 'node_1', type: 'start', title: 'Solicitação Criada', x: 40, y: 120 },
      { id: 'node_2', type: 'user-task', title: 'Aprovação Gestor', assignee: 'Gestor Direto', sla: 24, x: 220, y: 120 },
      { id: 'node_3', type: 'gateway', title: 'Valor > R$ 5.000?', x: 440, y: 120 },
      { id: 'node_4', type: 'user-task', title: 'Aprovação Diretoria', assignee: 'Diretoria', sla: 48, x: 640, y: 50 },
      { id: 'node_5', type: 'service-task', title: 'Gerar Ordem de Compra', assignee: 'Automação ERP', sla: 2, x: 640, y: 200 },
      { id: 'node_6', type: 'end', title: 'Processo Concluído', x: 860, y: 120 }
    ],
    connections: [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3' },
      { from: 'node_3', to: 'node_4', label: 'Sim' },
      { from: 'node_3', to: 'node_5', label: 'Não' },
      { from: 'node_4', to: 'node_5' },
      { from: 'node_5', to: 'node_6' }
    ]
  },
  ferias: {
    id: 'PROC_FERIAS',
    name: 'Solicitação e Concessão de Férias',
    nodes: [
      { id: 'node_1', type: 'start', title: 'Pedido de Férias', x: 40, y: 100 },
      { id: 'node_2', type: 'user-task', title: 'Validação de Saldo RH', assignee: 'RH Ops', sla: 12, x: 220, y: 100 },
      { id: 'node_3', type: 'user-task', title: 'Aprovação Liderança', assignee: 'Líder Direto', sla: 24, x: 440, y: 100 },
      { id: 'node_4', type: 'service-task', title: 'Agendar Folha Pagamento', assignee: 'Sistema RH', sla: 4, x: 660, y: 100 },
      { id: 'node_5', type: 'end', title: 'Férias Agendadas', x: 860, y: 100 }
    ],
    connections: [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3' },
      { from: 'node_3', to: 'node_4' },
      { from: 'node_4', to: 'node_5' }
    ]
  },
  chamado: {
    id: 'PROC_TI',
    name: 'Atendimento de Chamado Técnico TI',
    nodes: [
      { id: 'node_1', type: 'start', title: 'Ticket Aberto', x: 40, y: 120 },
      { id: 'node_2', type: 'user-task', title: 'Triagem Nível 1', assignee: 'Suporte N1', sla: 4, x: 220, y: 120 },
      { id: 'node_3', type: 'gateway', title: 'Requer N2?', x: 420, y: 120 },
      { id: 'node_4', type: 'user-task', title: 'Atendimento Especializado', assignee: 'Engenharia N2', sla: 24, x: 620, y: 50 },
      { id: 'node_5', type: 'user-task', title: 'Validação com Usuário', assignee: 'Solicitante', sla: 12, x: 620, y: 200 },
      { id: 'node_6', type: 'end', title: 'Ticket Fechado', x: 840, y: 120 }
    ],
    connections: [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3' },
      { from: 'node_3', to: 'node_4', label: 'Sim' },
      { from: 'node_3', to: 'node_5', label: 'Não' },
      { from: 'node_4', to: 'node_5' },
      { from: 'node_5', to: 'node_6' }
    ]
  }
};

// Initial Mock Seed Data
const SEED_TASKS = [
  {
    id: 'TSK-101',
    instanceId: 'INST-2026-001',
    processName: 'Aprovação de Compras',
    stepTitle: 'Aprovação Gestor',
    assignee: 'Carlos Silva (Gestor)',
    createdHoursAgo: 18,
    slaHours: 24,
    slaStatus: 'warning', // warning, critical, ok
    gristRef: '#42 - Computadores Dell XPS',
    description: 'Solicitação de compra de 3 notebooks Dell XPS para a equipe de Engenharia.',
    value: 'R$ 24.500,00'
  },
  {
    id: 'TSK-102',
    instanceId: 'INST-2026-002',
    processName: 'Aprovação de Compras',
    stepTitle: 'Aprovação Diretoria',
    assignee: 'Diretoria Executiva',
    createdHoursAgo: 52,
    slaHours: 48,
    slaStatus: 'critical',
    gristRef: '#38 - Licenças Software Cloud',
    description: 'Renovação anual de licenças de software de infraestrutura.',
    value: 'R$ 89.000,00'
  },
  {
    id: 'TSK-103',
    instanceId: 'INST-2026-003',
    processName: 'Solicitação de Férias',
    stepTitle: 'Aprovação Liderança',
    assignee: 'Mariana Costa',
    createdHoursAgo: 4,
    slaHours: 24,
    slaStatus: 'ok',
    gristRef: '#15 - Férias Ana Paula',
    description: 'Solicitação de 15 dias de férias a partir de 15/09/2026.',
    value: '15 dias'
  }
];

const SEED_INSTANCES = [
  { id: 'INST-2026-001', process: 'Aprovação de Compras', gristId: 42, step: 'Aprovação Gestor', status: 'Em_Andamento', startedAt: '25/08/2026 09:30', sla: 'warning' },
  { id: 'INST-2026-002', process: 'Aprovação de Compras', gristId: 38, step: 'Aprovação Diretoria', status: 'Em_Andamento', startedAt: '23/08/2026 14:00', sla: 'critical' },
  { id: 'INST-2026-003', process: 'Solicitação de Férias', gristId: 15, step: 'Aprovação Liderança', status: 'Em_Andamento', startedAt: '25/08/2026 11:15', sla: 'ok' },
  { id: 'INST-2026-000', process: 'Atendimento TI', gristId: 102, step: 'Ticket Fechado', status: 'Concluido', startedAt: '24/08/2026 08:00', sla: 'ok' }
];

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  STATE.tasks = [...SEED_TASKS];
  STATE.instances = [...SEED_INSTANCES];

  initTabs();
  initGristIntegration();
  renderTaskInbox();
  renderCanvas();
  renderInstancesTable();
  renderAnalytics();
  initDesignerControls();
  initModalControls();

  document.getElementById('btn-setup-tables')?.addEventListener('click', setupGristTables);
  document.getElementById('btn-refresh')?.addEventListener('click', refreshData);
  document.getElementById('btn-new-instance')?.addEventListener('click', startNewInstance);
});

// ==========================================================================
// Tab Switching System
// ==========================================================================

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      STATE.activeTab = targetTab;

      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');

      if (targetTab === 'designer') renderCanvas();
      if (targetTab === 'instances') renderInstancesTable();
      if (targetTab === 'analytics') renderAnalytics();
    });
  });
}

// ==========================================================================
// Grist Integration
// ==========================================================================

function initGristIntegration() {
  if (window.grist) {
    STATE.gristConnected = true;
    grist.ready({ requiredAccess: 'full' });

    grist.onRecord((record) => {
      STATE.selectedGristRecord = record;
      const titleEl = document.getElementById('active-process-title');
      if (record && record.id) {
        titleEl.innerHTML = `Grist Record Conectado: <strong>#${record.id}</strong>`;
      } else {
        titleEl.textContent = 'Nenhum registro ativo selecionado no Grist';
      }
    });
  }
}

async function setupGristTables() {
  if (!STATE.gristConnected || !window.grist?.docApi) {
    alert('⚡ Modo Standalone: As tabelas seriam criadas no Grist nativo.\n\nTabelas gerenciadas:\n- BPM_Processos\n- BPM_Etapas\n- BPM_Transicoes\n- BPM_Instancias\n- BPM_Tarefas\n- BPM_Historico');
    return;
  }

  try {
    const existingTables = await grist.docApi.listTables();
    console.log('[BPM Studio] Existing tables:', existingTables);
    
    let createdCount = 0;
    if (!existingTables.includes('BPM_Processos')) {
      await grist.docApi.applyUserActions([['AddTable', 'BPM_Processos', [{ id: 'Nome', type: 'Text' }, { id: 'Estrutura_JSON', type: 'Text' }]]]);
      createdCount++;
    }
    if (!existingTables.includes('BPM_Instancias')) {
      await grist.docApi.applyUserActions([['AddTable', 'BPM_Instancias', [{ id: 'Processo', type: 'Text' }, { id: 'Etapa_Atual', type: 'Text' }, { id: 'Status', type: 'Text' }]]]);
      createdCount++;
    }

    alert(`✅ Verificação de tabelas concluída! ${createdCount > 0 ? createdCount + ' tabelas criadas.' : 'Todas as tabelas já existem.'}`);
  } catch (err) {
    console.error('Erro ao verificar/criar tabelas no Grist:', err);
    alert('Aviso ao acessar a API de estrutura do Grist: ' + err.message);
  }
}

// ==========================================================================
// Tab 1: Task Inbox (Minha Fila)
// ==========================================================================

function renderTaskInbox() {
  const container = document.getElementById('tasks-container');
  const countBadge = document.getElementById('inbox-count');
  const searchInput = document.getElementById('task-search')?.value.toLowerCase() || '';
  const slaFilter = document.getElementById('sla-filter')?.value || 'all';

  const filteredTasks = STATE.tasks.filter(task => {
    const matchesSearch = task.processName.toLowerCase().includes(searchInput) ||
                          task.stepTitle.toLowerCase().includes(searchInput) ||
                          task.gristRef.toLowerCase().includes(searchInput);
    const matchesSLA = slaFilter === 'all' || task.slaStatus === slaFilter;
    return matchesSearch && matchesSLA;
  });

  countBadge.textContent = filteredTasks.length;

  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📥</div>
        <h3>Nenhuma tarefa pendente na sua fila</h3>
        <p>Você está em dia com todas as solicitações e aprovações de processos!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredTasks.map(task => {
    const slaText = task.slaStatus === 'critical' ? `⚠️ VENCIDO (há ${task.createdHoursAgo - task.slaHours}h)`
                  : task.slaStatus === 'warning' ? `⏳ Restam ${task.slaHours - task.createdHoursAgo}h`
                  : `🟢 Prazo normal (${task.slaHours - task.createdHoursAgo}h restantes)`;

    return `
      <div class="task-card sla-${task.slaStatus}">
        <div class="task-card-header">
          <span class="task-process-tag">${task.processName}</span>
          <span class="sla-badge ${task.slaStatus}">${slaText}</span>
        </div>
        <div class="task-title">${task.stepTitle}</div>
        <div class="task-meta">
          <span><strong>Registro:</strong> ${task.gristRef}</span>
          <span><strong>Valor/Detalhe:</strong> ${task.value}</span>
          <span><strong>Responsável:</strong> ${task.assignee}</span>
        </div>
        <div class="task-card-footer">
          <span style="font-size:11px; color:var(--text-muted);">Instância: ${task.instanceId}</span>
          <button class="btn btn-primary btn-sm" onclick="openTaskModal('${task.id}')">Tratar Tarefa</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('task-search')?.addEventListener('input', renderTaskInbox);
  document.getElementById('sla-filter')?.addEventListener('change', renderTaskInbox);
}

// ==========================================================================
// Task Modal / Drawer
// ==========================================================================

function openTaskModal(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  STATE.currentSelectedTask = task;

  document.getElementById('modal-task-title').textContent = `${task.stepTitle} - ${task.processName}`;
  document.getElementById('modal-task-sub').textContent = `Instância ${task.instanceId} • Grist ${task.gristRef}`;
  document.getElementById('modal-assignee').textContent = task.assignee;
  document.getElementById('modal-sla').textContent = `${task.slaHours - task.createdHoursAgo} horas restantes`;
  document.getElementById('modal-grist-ref').textContent = task.gristRef;

  document.getElementById('task-modal').classList.add('active');
}

function initModalControls() {
  document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('btn-task-approve')?.addEventListener('click', () => completeTask('APROVADO'));
  document.getElementById('btn-task-reject')?.addEventListener('click', () => completeTask('REJEITADO'));
}

function closeModal() {
  document.getElementById('task-modal').classList.remove('active');
  STATE.currentSelectedTask = null;
}

function completeTask(decision) {
  if (!STATE.currentSelectedTask) return;

  const comment = document.getElementById('form-comment')?.value || '';
  const taskId = STATE.currentSelectedTask.id;

  // Remove task from list
  STATE.tasks = STATE.tasks.filter(t => t.id !== taskId);

  // Update instance status
  const inst = STATE.instances.find(i => i.id === STATE.currentSelectedTask.instanceId);
  if (inst) {
    if (decision === 'APROVADO') {
      inst.step = 'Próxima Etapa / Concluído';
      inst.status = 'Concluido';
      inst.sla = 'ok';
    } else {
      inst.step = 'Devolvido ao Solicitante';
      inst.status = 'Suspenso';
      inst.sla = 'warning';
    }
  }

  alert(`✅ Tarefa ${taskId} executada com decisão: ${decision}!\n\nParecer gravado: "${comment}"`);
  closeModal();
  renderTaskInbox();
  renderInstancesTable();
  renderAnalytics();
}

// ==========================================================================
// Tab 2: Visual BPMN Designer
// ==========================================================================

function renderCanvas() {
  const container = document.getElementById('canvas-nodes-container');
  const svg = document.getElementById('canvas-svg-connections');
  if (!container || !svg) return;

  const flow = STATE.currentDesignerFlow;

  // Render Nodes
  container.innerHTML = flow.nodes.map(node => {
    const isSelected = STATE.selectedNodeId === node.id ? 'selected' : '';
    const iconMap = { start: '🟢', 'user-task': '🟦', 'service-task': '⚙️', gateway: '🔷', end: '🔴' };

    return `
      <div class="bpm-node node-type-${node.type} ${isSelected}"
           id="${node.id}"
           style="left:${node.x}px; top:${node.y}px;"
           onclick="selectNode('${node.id}')"
           onmousedown="startDragNode(event, '${node.id}')">
        <span style="font-size:18px;">${iconMap[node.type] || '📦'}</span>
        <div>
          <div class="node-title">${node.title}</div>
          <div class="node-sub">${node.assignee || node.type}</div>
        </div>
      </div>
    `;
  }).join('');

  // Render SVG Connection Lines
  svg.innerHTML = `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
      </marker>
    </defs>
    ${flow.connections.map(conn => {
      const fromNode = flow.nodes.find(n => n.id === conn.from);
      const toNode = flow.nodes.find(n => n.id === conn.to);
      if (!fromNode || !toNode) return '';

      const x1 = fromNode.x + 80;
      const y1 = fromNode.y + 25;
      const x2 = toNode.x;
      const y2 = toNode.y + 25;

      return `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="connection-line" />
        ${conn.label ? `<text x="${(x1+x2)/2}" y="${(y1+y2)/2 - 8}" fill="#94a3b8" font-size="11" text-anchor="middle">${conn.label}</text>` : ''}
      `;
    }).join('')}
  `;
}

function selectNode(nodeId) {
  STATE.selectedNodeId = nodeId;
  renderCanvas();

  const node = STATE.currentDesignerFlow.nodes.find(n => n.id === nodeId);
  const editor = document.getElementById('properties-editor');

  if (!node) return;

  editor.innerHTML = `
    <div class="prop-group">
      <label>ID do Nó</label>
      <input type="text" value="${node.id}" disabled />
    </div>
    <div class="prop-group">
      <label>Título da Etapa</label>
      <input type="text" id="prop-title" value="${node.title}" onchange="updateNodeProp('${node.id}', 'title', this.value)" />
    </div>
    <div class="prop-group">
      <label>Tipo de Nó</label>
      <select id="prop-type" onchange="updateNodeProp('${node.id}', 'type', this.value)">
        <option value="start" ${node.type === 'start' ? 'selected' : ''}>Início (Start Event)</option>
        <option value="user-task" ${node.type === 'user-task' ? 'selected' : ''}>Tarefa de Usuário</option>
        <option value="service-task" ${node.type === 'service-task' ? 'selected' : ''}>Automação / Script</option>
        <option value="gateway" ${node.type === 'gateway' ? 'selected' : ''}>Decisão (Gateway)</option>
        <option value="end" ${node.type === 'end' ? 'selected' : ''}>Fim de Processo</option>
      </select>
    </div>
    <div class="prop-group">
      <label>Responsável / Perfil</label>
      <input type="text" id="prop-assignee" value="${node.assignee || ''}" placeholder="Ex: Gestor, RH, Diretoria" onchange="updateNodeProp('${node.id}', 'assignee', this.value)" />
    </div>
    <div class="prop-group">
      <label>SLA Esperado (Horas)</label>
      <input type="number" id="prop-sla" value="${node.sla || 24}" onchange="updateNodeProp('${node.id}', 'sla', parseInt(this.value))" />
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:10px; background-color:var(--status-danger); color:white;" onclick="deleteNode('${node.id}')">Excluir Etapa</button>
  `;
}

function updateNodeProp(nodeId, prop, value) {
  const node = STATE.currentDesignerFlow.nodes.find(n => n.id === nodeId);
  if (node) {
    node[prop] = value;
    renderCanvas();
  }
}

function deleteNode(nodeId) {
  STATE.currentDesignerFlow.nodes = STATE.currentDesignerFlow.nodes.filter(n => n.id !== nodeId);
  STATE.currentDesignerFlow.connections = STATE.currentDesignerFlow.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
  STATE.selectedNodeId = null;
  document.getElementById('properties-editor').innerHTML = '<p class="muted">Selecione uma etapa para configurar.</p>';
  renderCanvas();
}

function initDesignerControls() {
  document.getElementById('flow-template-select')?.addEventListener('change', (e) => {
    const key = e.target.value;
    if (TEMPLATES[key]) {
      STATE.currentDesignerFlow = JSON.parse(JSON.stringify(TEMPLATES[key]));
      document.getElementById('canvas-process-name').textContent = STATE.currentDesignerFlow.name;
      renderCanvas();
    }
  });

  document.getElementById('btn-save-flow')?.addEventListener('click', async () => {
    const flowJson = JSON.stringify(STATE.currentDesignerFlow);

    if (STATE.gristConnected && window.grist?.docApi) {
      try {
        await grist.docApi.applyUserActions([
          ['AddRecord', 'BPM_Processos', null, { Nome: STATE.currentDesignerFlow.name, Estrutura_JSON: flowJson }]
        ]);
        alert('💾 Processo BPM gravado com sucesso na tabela BPM_Processos do Grist!');
      } catch (err) {
        alert('Fluxo salvo localmente! (Aviso ao gravar no Grist: ' + err.message + ')');
      }
    } else {
      alert('💾 Fluxo de Processo salvo com sucesso no estado do widget!');
    }
  });

  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    const jsonStr = JSON.stringify(STATE.currentDesignerFlow, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${STATE.currentDesignerFlow.id}_bpm.json`;
    a.click();
  });

  document.getElementById('btn-clear-canvas')?.addEventListener('click', () => {
    if (confirm('Deseja realmente limpar todas as etapas do canvas?')) {
      STATE.currentDesignerFlow.nodes = [];
      STATE.currentDesignerFlow.connections = [];
      renderCanvas();
    }
  });
}

let draggedNodeId = null;
let dragStartX = 0, dragStartY = 0;

function startDragNode(e, nodeId) {
  draggedNodeId = nodeId;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  const onMouseMove = (moveEvent) => {
    if (!draggedNodeId) return;
    const dx = moveEvent.clientX - dragStartX;
    const dy = moveEvent.clientY - dragStartY;

    const node = STATE.currentDesignerFlow.nodes.find(n => n.id === draggedNodeId);
    if (node) {
      node.x += dx;
      node.y += dy;
      dragStartX = moveEvent.clientX;
      dragStartY = moveEvent.clientY;
      renderCanvas();
    }
  };

  const onMouseUp = () => {
    draggedNodeId = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

// ==========================================================================
// Tab 3: Instâncias Ativas
// ==========================================================================

function renderInstancesTable() {
  const body = document.getElementById('instances-table-body');
  if (!body) return;

  const search = document.getElementById('instance-search')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('instance-status-filter')?.value || 'all';

  const filtered = STATE.instances.filter(inst => {
    const matchesSearch = inst.id.toLowerCase().includes(search) ||
                          inst.process.toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'all' || inst.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    body.innerHTML = '<tr><td colspan="7" class="text-center muted">Nenhuma instância encontrada.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(inst => `
    <tr>
      <td><strong>${inst.id}</strong></td>
      <td>${inst.process}</td>
      <td><span class="task-process-tag">Ref #${inst.gristId}</span></td>
      <td>${inst.step}</td>
      <td><span class="sla-badge ${inst.sla}">${inst.sla.toUpperCase()}</span></td>
      <td>${inst.startedAt}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="alert('Histórico e auditoria da instância ${inst.id}')">Trilha</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('instance-search')?.addEventListener('input', renderInstancesTable);
  document.getElementById('instance-status-filter')?.addEventListener('change', renderInstancesTable);
}

// ==========================================================================
// Tab 4: Analytics
// ==========================================================================

function renderAnalytics() {
  const activeCount = STATE.instances.filter(i => i.status === 'Em_Andamento').length;
  document.getElementById('kpi-active').textContent = activeCount;

  const stepDistContainer = document.getElementById('chart-step-distribution');
  if (stepDistContainer) {
    stepDistContainer.innerHTML = `
      <div class="progress-bar-item">
        <div class="progress-bar-label"><span>Aprovação Gestor Direto</span><span>45%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:45%;"></div></div>
      </div>
      <div class="progress-bar-item">
        <div class="progress-bar-label"><span>Aprovação Diretoria</span><span>35%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:35%; background:#f59e0b;"></div></div>
      </div>
      <div class="progress-bar-item">
        <div class="progress-bar-label"><span>Geração Ordem de Compra</span><span>20%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:20%; background:#10b981;"></div></div>
      </div>
    `;
  }

  const slaPerformance = document.getElementById('chart-sla-performance');
  if (slaPerformance) {
    slaPerformance.innerHTML = `
      <div class="progress-bar-item">
        <div class="progress-bar-label"><span>Mariana Costa (RH)</span><span>98% no prazo</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:98%;"></div></div>
      </div>
      <div class="progress-bar-item">
        <div class="progress-bar-label"><span>Carlos Silva (Gestor)</span><span>85% no prazo</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:85%;"></div></div>
      </div>
      <div class="progress-bar-item">
        <div class="progress-bar-label"><span>Diretoria Executiva</span><span>62% no prazo (Gargalo)</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:62%; background:#ef4444;"></div></div>
      </div>
    `;
  }
}

function refreshData() {
  renderTaskInbox();
  renderInstancesTable();
  renderAnalytics();
  alert('🔄 Dados do BPM Studio recarregados com sucesso!');
}

function startNewInstance() {
  const newInstId = `INST-2026-00${STATE.instances.length + 1}`;
  const newTask = {
    id: `TSK-10${STATE.tasks.length + 1}`,
    instanceId: newInstId,
    processName: 'Aprovação de Compras',
    stepTitle: 'Aprovação Gestor',
    assignee: 'Gestor Direto',
    createdHoursAgo: 1,
    slaHours: 24,
    slaStatus: 'ok',
    gristRef: `#${Math.floor(Math.random() * 50 + 50)} - Nova Solicitação`,
    description: 'Instância iniciada via BPM Studio',
    value: 'R$ 12.000,00'
  };

  STATE.tasks.unshift(newTask);
  STATE.instances.unshift({
    id: newInstId,
    process: 'Aprovação de Compras',
    gristId: Math.floor(Math.random() * 50 + 50),
    step: 'Aprovação Gestor',
    status: 'Em_Andamento',
    startedAt: new Date().toLocaleString('pt-BR'),
    sla: 'ok'
  });

  alert(`🚀 Nova instância ${newInstId} iniciada com sucesso! Uma tarefa foi atribuída à Minha Fila.`);
  renderTaskInbox();
  renderInstancesTable();
  renderAnalytics();
}
