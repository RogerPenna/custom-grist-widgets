// libraries/headless-data-writer.js
import { GristDataWriter as OriginalGristDataWriter } from './grist-data-writer.js';

/**
 * Headless version of GristDataWriter.
 * Expects a GristRestAdapter instance instead of the Grist plugin API object.
 */
export const HeadlessDataWriter = function(restAdapter) {
    // Reuse original logic. It expects 'grist.docApi.applyUserActions'.
    // Our restAdapter provides exactly that.
    return new OriginalGristDataWriter(restAdapter);
};
