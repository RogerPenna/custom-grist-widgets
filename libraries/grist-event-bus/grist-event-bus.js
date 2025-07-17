// libraries/grist-event-bus/grist-event-bus.js

// Cria um único canal de comunicação com um nome fixo para todo o nosso framework.
// Todos os widgets que usarem este arquivo sintonizarão automaticamente nesta "estação de rádio".
const channel = new BroadcastChannel('grist_reusable_framework_channel');

/**
 * Publica uma mensagem no canal para todos os outros widgets ouvintes.
 * @param {string} eventName - O nome do evento (usado para filtragem).
 * @param {any} data - O objeto de dados a ser enviado.
 */
export function publish(eventName, data) {
    // Enviamos um objeto que contém tanto o nome do evento quanto os dados.
    channel.postMessage({ eventName, data });
}

/**
 * Inscreve-se para ouvir mensagens de um tipo específico no canal.
 * @param {string} eventName - O nome do evento para o qual se inscrever.
 * @param {function} callback - A função a ser executada quando o evento for recebido.
 *                                A função receberá um objeto de evento com uma propriedade 'detail'.
 */
export function subscribe(eventName, callback) {
    channel.onmessage = (messageEvent) => {
        // messageEvent.data contém o objeto que enviamos: { eventName, data }
        const { eventName: receivedEventName, data } = messageEvent.data;

        // Verifica se a mensagem recebida é do tipo que estamos esperando.
        if (receivedEventName === eventName) {
            // Para manter a compatibilidade com a API de CustomEvent,
            // passamos para o callback um objeto com uma propriedade 'detail'.
            callback({ detail: data });
        }
    };
}

// Opcional: Adicionar um listener de erro para depuração.
channel.onmessageerror = (errorEvent) => {
    console.error("GristEventBus: Erro no BroadcastChannel:", errorEvent);
};