import { widgetRegistry } from '../../widget-registry.js';
import './config-drawer.js'; // Ensure DrawerConfigEditor is loaded

widgetRegistry.register({
    componentType: 'Drawer',
    editor: window.DrawerConfigEditor,
});
