const IS_ANDROID_APP = typeof window.Android !== 'undefined' && typeof window.Android.salvarDados === 'function';
const IS_GRIST_WIDGET = typeof grist !== 'undefined' && typeof grist.ready === 'function';

let environmentName = 'Browser (Local)';
if (IS_ANDROID_APP) {
    environmentName = 'Android App';
} else if (IS_GRIST_WIDGET) {
    environmentName = 'Grist Widget';
}

export const env = {
    isAndroid: IS_ANDROID_APP,
    isGrist: IS_GRIST_WIDGET,
    isBrowser: !IS_ANDROID_APP && !IS_GRIST_WIDGET,
    name: environmentName
};