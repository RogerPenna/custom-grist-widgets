// --- START OF CORRECTED grist-event-bus.js ---

/**
 * A simple publish-subscribe event bus for cross-component communication.
 * This implementation ensures a Singleton pattern by attaching the bus to the global 'window' object,
 * guaranteeing that all modules share the same event bus instance.
 */

const BUS_KEY = Symbol.for("GRF_EVENT_BUS");
const scriptUrl = import.meta.url;

if (!window[BUS_KEY]) {
    window[BUS_KEY] = {
        listeners: {},
        version: "1.1.2",
        createdAt: new Date().toISOString(),
        loadedBy: [scriptUrl]
    };
    console.log(`[EventBus] Global instance created. Version: 1.1.2, URL: ${scriptUrl}, CreatedAt: ${window[BUS_KEY].createdAt}`);
} else {
    window[BUS_KEY].loadedBy.push(scriptUrl);
    console.log(`[EventBus] Using existing global instance. Version: ${window[BUS_KEY].version}, URL: ${scriptUrl}, LoadedBy count: ${window[BUS_KEY].loadedBy.length}`);
}

const eventBus = window[BUS_KEY];

export function subscribe(eventName, callback) {
    if (!eventBus.listeners[eventName]) {
        eventBus.listeners[eventName] = [];
    }
    eventBus.listeners[eventName].push(callback);
    console.log(`[EventBus] [v${eventBus.version}] Subscribed to '${eventName}'. Total listeners for this event: ${eventBus.listeners[eventName].length}. URL: ${scriptUrl}`);

    return () => {
        eventBus.listeners[eventName] = eventBus.listeners[eventName].filter(
            listener => listener !== callback
        );
        console.log(`[EventBus] Unsubscribed from '${eventName}'. URL: ${scriptUrl}`);
    };
}

export function publish(eventName, data) {
    const listeners = eventBus.listeners[eventName];
    if (listeners && listeners.length > 0) {
        console.log(`[EventBus] [v${eventBus.version}] Publishing '${eventName}' to ${listeners.length} listeners. URL: ${scriptUrl}`, data);
        listeners.forEach((callback, index) => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[EventBus] Error in listener ${index} for event '${eventName}':`, error);
            }
        });
    } else {
        console.warn(`[EventBus] [v${eventBus.version}] No listeners for event '${eventName}'. URL: ${scriptUrl}`);
        // Debug: list all available events
        const available = Object.keys(eventBus.listeners).filter(k => eventBus.listeners[k] && eventBus.listeners[k].length > 0);
        console.log(`[EventBus] All registered events:`, available);
        console.log(`[EventBus] Full listeners object:`, eventBus.listeners);
    }
}
