// assets/help/ajuda.js

// Exporta o conteúdo HTML como uma string multilinhas
export const ajudaHTML = `
    <h2>1. Carregando Pacotes de Auditoria</h2>
    <p>
        O aplicativo funciona com "Pacotes de Auditoria", que são arquivos <strong>.json</strong> ou <strong>.zip</strong> (contendo um .json) gerados pelo sistema Grist.
    </p>
    <ul>
        <li><strong>Carregar um Novo Pacote:</strong> Na tela inicial, clique em "Carregar Novo Pacote". O seletor de arquivos do seu celular abrirá. Navegue até a pasta (geralmente "Downloads") onde você salvou o pacote e selecione-o.</li>
        <li><strong>Atualizar um Pacote Existente:</strong> Se você carregar um pacote com um ID que já existe no aplicativo (ex: carregar uma nova versão do "2025 - 1"), o app perguntará se você deseja <strong>ATUALIZAR</strong>. Ao confirmar, o progresso das auditorias que você já iniciou será mantido, e apenas novos setores/perguntas serão adicionados. <strong>Seu trabalho não será perdido.</strong></li>
    </ul>

    <h2>2. Tela de Planejamento</h2>
    <p>
        Após selecionar um pacote, você verá a lista de todas as auditorias planejadas para aquele pacote.
    </p>
    <ul>
        <li><strong>Cards de Auditoria:</strong> Cada card representa uma auditoria a ser feita em um setor específico.</li>
        <li><strong>Cores dos Cards:</strong>
            <ul>
                <li><strong>Branco:</strong> Auditoria ainda não iniciada.</li>
                <li><strong>Borda Laranja:</strong> Auditoria "Em Andamento". Você pode continuá-la.</li>
                <li><strong>Borda Azul:</strong> Auditoria "Finalizada". Você pode reabri-la ou exportar os resultados.</li>
            </ul>
        </li>
        <li><strong>Informações do Card:</strong> Ao tocar em um card, ele se expande para mostrar mais detalhes: progresso, contagem de Não Conformidades (NC) e botões de ação.</li>
        <li><strong>Ações:</strong>
            <ul>
                <li><strong>Iniciar/Continuar:</strong> Leva você para a tela do checklist para começar ou continuar a preencher as perguntas.</li>
                <li><strong>Exportar JSON/PDF:</strong> Gera um arquivo com os resultados daquela auditoria específica, que pode ser compartilhado via WhatsApp, E-mail, etc.</li>
                <li><strong>Reabrir:</strong> Muda o status de uma auditoria "Finalizada" de volta para "Em Andamento", permitindo que você faça edições.</li>
                <li><strong>Resetar (Ícone de Lixeira):</strong> Apaga <strong>permanentemente</strong> todo o progresso daquela auditoria. Use com cuidado!</li>
            </ul>
        </li>
    </ul>

    <h2>3. Realizando a Auditoria (Tela do Checklist)</h2>
    <p>
        Esta é a tela principal de trabalho, onde você responde às perguntas.
    </p>
    <ul>
        <li><strong>Navegação:</strong> Role a tela para cima e para baixo para ver todas as perguntas.</li>
        <li><strong>Modo Compacto:</strong> Marque a caixa "Modo Compacto" no topo para uma visualização mais densa. Em vez de todos os botões de resposta, aparecerá um único botão "Selecionar Resposta". Toque nele para expandir as opções.</li>
        <li><strong>Anotações:</strong> Para adicionar uma nota a uma pergunta, toque em "Adicionar/Editar anotação". O texto da sua anotação aparecerá diretamente no card.</li>
        <li><strong>Mídia:</strong> Toque em "Mídia" para anexar fotos ou outros arquivos a uma pergunta. O seletor de arquivos incluirá a opção de usar a câmera do seu celular.</li>
        <li><strong>Ação (Pontos em Aberto):</strong> Use o botão "Ação" para marcar uma pergunta como um "Ponto em Aberto" que precisa de verificação futura. O card ficará destacado. Toque novamente para resolver o ponto.</li>
        <li><strong>Finalizar Auditoria:</strong> Ao terminar de responder, role até o final e clique em "Finalizar Auditoria" para salvar o estado e voltar para a tela de planejamento.</li>
    </ul>
`;