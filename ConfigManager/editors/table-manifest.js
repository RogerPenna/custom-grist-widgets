import { widgetRegistry } from '../../libraries/widget-registry.js';
import './config-table.js'; // Ensure TableConfigEditor is loaded

widgetRegistry.register({
    componentType: 'Table',
    editor: window.TableConfigEditor,
});
