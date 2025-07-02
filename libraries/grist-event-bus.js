// libraries/grist-event-bus.js

// This is a very simple event bus implementation.
// It creates a single, hidden DOM element to manage custom events.
const bus = document.createElement('div');

/**
 * Subscribes to an event.
 * @param {string} eventName - The name of the event to listen for (e.g., 'data-changed').
 * @param {function} callback - The function to execute when the event is fired.
 */
export function subscribe(eventName, callback) {
    bus.addEventListener(eventName, callback);
}

/**
 * Unsubscribes from an event to prevent memory leaks.
 * @param {string} eventName - The name of the event.
 * @param {function} callback - The specific function that was subscribed.
 */
export function unsubscribe(eventName, callback) {
    bus.removeEventListener(eventName, callback);
}

/**
 * Publishes (or "fires") an event.
 * @param {string} eventName - The name of the event to publish.
 * @param {object} [detail] - An optional object containing data to send with the event.
 */
export function publish(eventName, detail = {}) {
    bus.dispatchEvent(new CustomEvent(eventName, { detail }));
}