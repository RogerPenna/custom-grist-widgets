const a = {};
export const widgetRegistry = {
    register(e) {
        e && e.componentType && e.editor && (a[e.componentType] = e)
    },
    getEditor(e) {
        var o;
        return (null === (o = a[e]) || void 0 === o ? void 0 : o.editor) || null
    },
    getComponentTypes() {
        return Object.keys(a)
    },
    getComponentManifest(e) {
        return a[e] || null
    }
};