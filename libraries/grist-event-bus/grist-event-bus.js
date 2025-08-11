// --- START OF CORRECTED grist-event-bus.js ---

/**
 * A simple publish-subscribe event bus for cross-component communication.
 * This implementation ensures a Singleton pattern by attaching the bus to the global 'window' object,
 * guaranteeing that all modules share the same event bus instance.
 */

// Use a symbol to create a unique, non-colliding key on the window object.
const BUS_KEY = Symbol.for("GRF_EVENT_BUS");

// Initialize the bus on the window object if it doesn't already exist.
if (!window[BUS_KEY]) {
    window[BUS_KEY] = {
        listeners: {}
    };
    console.log("GRF Event Bus initialized.");
}

const eventBus = window[BUS_KEY];

/**
 * Subscribes a callback function to a specific event.
 * @param {string} eventName The name of the event to subscribe to.
 * @param {function} callback The function to call when the event is published.
 * @returns {function} An unsubscribe function.
 */
export function subscribe(eventName, callback) {
    if (!eventBus.listeners[eventName]) {
        eventBus.listeners[eventName] = [];
    }
    eventBus.listeners[eventName].push(callback);

    // Return an unsubscribe function for cleanup
    return () => {
        eventBus.listeners[eventName] = eventBus.listeners[eventName].filter(
            listener => listener !== callback
        );
    };
}

/**
 * Publishes an event, calling all subscribed callbacks with the provided data.
 * @param {string} eventName The name of the event to publish.
 * @param {*} [data] The data to pass to the subscribers.
 */
export function publish(eventName, data) {
    if (eventBus.listeners[eventName]) {
        console.log(`[EventBus] Publishing event '${eventName}' with data:`, data);
        eventBus.listeners[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[EventBus] Error in subscriber for event '${eventName}':`, error);
            }
        });
    } else {
        console.warn(`[EventBus] No listeners for event '${eventName}'.`);
    }
}

// --- END OF CORRECTED grist-event-bus.js ---