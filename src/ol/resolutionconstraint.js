/**
 * @module ol/resolutionconstraint
 */
import {linearFindNearest} from './array.js';
import {createEmpty, getHeight, getWidth} from './extent';
import {clamp} from './math';


/**
 * @typedef {function((number|undefined), number, number, (import("./size.js").Size)):(number|undefined)} Type
 */

/**
 * @param {Array<number>} resolutions Resolutions.
 * @param {import("./extent.js").Extent=} opt_maxExtent Maximum allowed extent.
 * @return {Type} Zoom function.
 */
export function createSnapToResolutions(resolutions, opt_maxExtent) {
  return (
    /**
     * @param {number|undefined} resolution Resolution.
     * @param {number} delta Delta.
     * @param {number} direction Direction.
     * @param {import("./size.js").Size} size Viewport size.
     * @return {number|undefined} Resolution.
     */
    function(resolution, delta, direction, size) {
      if (resolution !== undefined) {
        let cappedRes = resolution;

        // apply constraint related to max extent
        if (opt_maxExtent) {
          const xResolution = getWidth(opt_maxExtent) / size[0];
          const yResolution = getHeight(opt_maxExtent) / size[1];
          cappedRes = Math.min(cappedRes, Math.min(xResolution, yResolution));
        }

        // todo: compute direction
        let z = linearFindNearest(resolutions, cappedRes, direction);
        z = clamp(z + delta, 0, resolutions.length - 1);
        const index = Math.floor(z);
        if (z != index && index < resolutions.length - 1) {
          const power = resolutions[index] / resolutions[index + 1];
          return resolutions[index] / Math.pow(power, z - index);
        } else {
          return resolutions[index];
        }
      } else {
        return undefined;
      }
    }
  );
}


/**
 * @param {number} power Power.
 * @param {number} maxResolution Maximum resolution.
 * @param {number=} opt_maxLevel Maximum level.
 * @param {import("./extent.js").Extent=} opt_maxExtent Maximum allowed extent.
 * @return {Type} Zoom function.
 */
export function createSnapToPower(power, maxResolution, opt_maxLevel, opt_maxExtent) {
  return (
    /**
     * @param {number|undefined} resolution Resolution.
     * @param {number} delta Delta.
     * @param {number} direction Direction.
     * @param {import("./size.js").Size} size Viewport size.
     * @return {number|undefined} Resolution.
     */
    function(resolution, delta, direction, size) {
      if (resolution !== undefined) {
        let minLevel;

        // apply constraint related to max extent
        if (opt_maxExtent) {
          const xResolution = getWidth(opt_maxExtent) / size[0];
          const yResolution = getHeight(opt_maxExtent) / size[1];
          const cappedRes = Math.min(maxResolution, Math.min(xResolution, yResolution));
          minLevel = Math.ceil(Math.log(maxResolution / cappedRes) / Math.log(power));
        }

        const offset = -direction / 2 + 0.5;
        const oldLevel = Math.floor(
          Math.log(maxResolution / resolution) / Math.log(power) + offset);
        let newLevel = Math.max(oldLevel + delta, minLevel || 0);
        if (opt_maxLevel !== undefined) {
          newLevel = Math.min(newLevel, opt_maxLevel);
        }
        return maxResolution / Math.pow(power, newLevel);
      } else {
        return undefined;
      }
    });
}
