import { widgetRegistry } from '../../libraries/widget-registry.js';
import './config-cards.js'; // Ensure CardConfigEditor is loaded

console.log('Registering CardSystem widget...');
widgetRegistry.register({
    componentType: 'CardSystem', // Corrected component type based on existing references
    editor: window.CardConfigEditor,
});
console.log('CardSystem widget registered.');