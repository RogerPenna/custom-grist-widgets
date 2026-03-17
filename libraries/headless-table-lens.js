// libraries/headless-table-lens.js
import { GristTableLens as OriginalGristTableLens } from './grist-table-lens/grist-table-lens.js';

/**
 * Headless version of GristTableLens.
 * Expects a GristRestAdapter instance instead of the Grist plugin API object.
 */
export const HeadlessTableLens = function(restAdapter) {
    // We can simply reuse the original logic by passing our adapter 
    // which mimics the docApi interface.
    return new OriginalGristTableLens(restAdapter);
};
