import { widgetRegistry } from '../../widget-registry.js';
import { IndicatorsConfigEditor } from './config-indicators.js';

widgetRegistry.register({
    componentType: 'Indicators',
    editor: IndicatorsConfigEditor,
});
