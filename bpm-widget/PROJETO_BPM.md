# Sistema BPM para Grist (Business Process Management Widget)

## 📌 Visão Geral
O **Sistema BPM para Grist** é um widget modular avançado projetado para transformar o Grist em uma plataforma robusta de Gestão de Processos de Negócio. Ele permite modelar, executar, monitorar e otimizar fluxos de trabalho diretamente nas planilhas e bancos de dados relacionais do Grist.

---

## 🎯 Requisitos do Sistema

### 1. Requisitos Funcionais (RF)
- **RF-01: Modelador Visual de Processos (BPMN 2.0 Simplified)**
  - Criação e edição de nós do fluxo (Início, Tarefa de Usuário, Tarefa Automática, Decisão/Gateway Exclusivo, Decisão/Gateway Paralelo, Fim).
  - Conexão visual entre etapas com definição de condições de transição (ex: `Aprovado == True`).
  - Configuração de formulários e campos associados a cada etapa.

- **RF-02: Gestão de Instâncias de Processo (Execution Engine)**
  - Início manual ou automático de novas instâncias de processo vinculadas a registros do Grist.
  - Avanço automático de etapa com base em regras de validação e preenchimento de campos.
  - Suporte a desvios condicionais e bifurcações (Gateways).

- **RF-03: Central de Tarefas ("Minha Fila de Trabalho")**
  - Painel individual consolidando tarefas pendentes por usuário ou perfil/responsável.
  - Interface de preenchimento rápido de dados e botões de ação (Aprovar, Rejeitar, Solicitar Ajuste, Reatribuir).
  - Notificação visual de tarefas com prazos críticos.

- **RF-04: Gestão de SLA e Prazos**
  - Definição de prazos esperados (horas/dias) por etapa.
  - Cálculo automático de SLA restante e sinalização visual (No Prazo, Alerta de Atenção, Vencido).
  - Registro de tempo gasto em cada etapa para auditoria de desempenho.

- **RF-05: Monitoramento e Auditoria (Audit Log)**
  - Histórico imutável de todas as ações executadas em uma instância (quem fez, quando fez, valor anterior e novo).
  - Linha do tempo visual do processo destacando o caminho percorrido.

- **RF-06: Dashboard de Analytics de Processos**
  - Métricas de tempo médio de ciclo (Cycle Time).
  - Identificação de gargalos (etapas com maior acúmulo de tarefas).
  - Taxas de aprovação/rejeição e volume de processos iniciados vs. concluídos.

---

### 2. Requisitos Não-Funcionais (RNF)
- **RNF-01: Desempenho e Fluidez**
  - Carregamento instantâneo do widget e renderização leve no iframe do Grist.
- **RNF-02: Design Premium e Responsivo**
  - Interface moderna inspirada em sistemas enterprise de alto padrão (tema escuro/claro, micro-animações, suporte ao tema nativo do Grist).
- **RNF-03: Compatibilidade Nativa com Grist**
  - Utilização da API oficial (`grist.docApi`, `grist-plugin-api`) sem necessidade de servidores externos para a interface visual.
- **RNF-04: Execução Assíncrona 24/7 (Headless Engine)**
  - Suporte a motor em background (Background Daemon via API REST do Grist ou Webhooks n8n) para criação automatizada de tarefas, verificação contínua de SLAs e escalonamentos mesmo quando nenhum usuário estiver logado ou com a página aberta no navegador.
- **RNF-05: Extensibilidade**
  - Arquitetura desacoplada via `GristTableLens` e padrão de eventos para fácil inclusão de novas automações.

---

## 🗄️ Modelo de Dados Nativas do Grist (Esquema de Tabelas)

Para operar o BPM nativamente, o Grist deve possuir as seguintes tabelas estruturadas:

1. **`BPM_Processos`**
   - `ID` (Text / Unique key)
   - `Nome` (Text)
   - `Descricao` (Text)
   - `Versao` (Integer)
   - `Ativo` (Bool)
   - `Estrutura_JSON` (Text / JSON com nós e conexões do fluxo)

2. **`BPM_Etapas`**
   - `Processo_ID` (Ref: BPM_Processos)
   - `Codigo_Etapa` (Text)
   - `Nome_Etapa` (Text)
   - `Tipo` (Choice: Start, UserTask, ServiceTask, Gateway, End)
   - `Responsavel_Padrao` (Text / User Ref)
   - `SLA_Horas` (Numeric)

3. **`BPM_Transicoes`**
   - `Processo_ID` (Ref: BPM_Processos)
   - `Origem_Etapa` (Text)
   - `Destino_Etapa` (Text)
   - `Condicao_Formula` (Text / Expressão Python ou JSON)

4. **`BPM_Instancias`**
   - `Processo_ID` (Ref: BPM_Processos)
   - `Registro_Vinculado_ID` (Integer / Ref da tabela de negócio)
   - `Etapa_Atual` (Text)
   - `Status` (Choice: Em_Andamento, Concluido, Cancelado, Suspenso)
   - `Data_Inicio` (DateTime)
   - `Data_Fim` (DateTime)

5. **`BPM_Tarefas`**
   - `Instancia_ID` (Ref: BPM_Instancias)
   - `Etapa_Codigo` (Text)
   - `Responsavel` (Text)
   - `Data_Criacao` (DateTime)
   - `Data_Vencimento` (DateTime)
   - `Status_Tarefa` (Choice: Pendente, Concluida, Cancelada)
   - `Decisao_Tomada` (Text)

6. **`BPM_Historico`**
   - `Instancia_ID` (Ref: BPM_Instancias)
   - `Etapa_Codigo` (Text)
   - `Usuario` (Text)
   - `Acao` (Text)
   - `Data_Hora` (DateTime)
   - `Detalhes_JSON` (Text)

---

## 🛠️ Etapas de Desenvolvimento

### **Fase 1: Estruturação & Interface Principal (UI Base)**
- [x] Criar estrutura de pasta e arquivos do widget (`bpm-widget/`).
- [ ] Construir layout da aplicação com navegação por abas (Modelador, Minha Fila, Instâncias, Analytics).
- [ ] Implementar temas CSS (Dark/Light mode) seguindo o padrão de design dos custom widgets do repositório.

### **Fase 2: Conectores e Integração Grist (`script.js` & API)**
- [ ] Desenvolver camada de adaptação para a API do Grist (`grist.onRecord`, `grist.docApi`).
- [ ] Implementar leitura e gravação das tabelas de configuração do BPM no Grist.
- [ ] Criar gerenciador de estado local e barramento de eventos internos.

### **Fase 3: Modelador Visual de Fluxos (BPM Designer)**
- [ ] Criar canvas interativo para criação e visualização de nós do processo.
- [ ] Implementar drag-and-drop de etapas e conexão entre blocos.
- [ ] Painel de propriedades laterais para configurar regras da etapa selected (SLA, responsável, formulário).

### **Fase 4: Central de Tarefas & Formulários Dinâmicos ("Minha Fila")**
- [ ] Desenvolver visualização de cartões/lista para tarefas pendentes do usuário logado.
- [ ] Implementar renderizador dinâmico de formulários de ação baseados nos campos da etapa.
- [ ] Adicionar suporte a ações rápidas (Aprovar / Rejeitar com 1 clique).

### **Fase 5: Motor de Execução & Regras de Transição (Execution Engine)**
- [ ] Criar lógica para disparo de novo processo a partir de registros da tabela principal do Grist.
- [ ] Avaliação de condições de transição entre etapas e controle de gateways.
- [ ] Atualização automática dos registros vinculados no Grist ao avançar o fluxo.

### **Fase 6: Dashboard de Analytics, SLA & Notificações**
- [ ] Renderizar indicadores estatísticos (Total Ativos, Tempo Médio, Vencidos).
- [ ] Gráficos de distribuição por etapa e gargalos de fluxo.
- [ ] Alertas visuais e regras de escalonamento por estouro de SLA.

---

## 📋 Lista de Tarefas (TODO List)

- [x] **[Estrutura Inicial]** Criar diretório `custom-grist-widgets/bpm-widget`
- [x] **[Documentação]** Elaborar `PROJETO_BPM.md` com arquitetura completa
- [ ] **[UI Base]** Criar `index.html` com layout de abas e header responsivo
- [ ] **[UI Base]** Criar `style.css` com paleta de cores enterprise, tokens e temas
- [ ] **[Core JS]** Implementar `script.js` inicial com suporte ao `grist.ready()`
- [ ] **[Grist Sync]** Implementar mapeamento automatizado de tabelas do Grist
- [ ] **[Designer]** Integrar componente de desenho visual de canvas BPMN
- [ ] **[Task Inbox]** Criar visualização de tarefas da fila de trabalho
- [ ] **[Execution]** Implementar motor de máquina de estados de transição
- [ ] **[Analytics]** Criar painel visual de estatísticas e métricas de processo
