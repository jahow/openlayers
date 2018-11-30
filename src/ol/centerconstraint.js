/**
 * @module ol/centerconstraint
 */
import {clamp} from './math.js';
import {createEmpty, getForViewAndSize, getHeight, getWidth} from './extent';


/**
 * @typedef {function((import("./coordinate.js").Coordinate|undefined),number,number,(import("./size.js").Size),boolean): (import("./coordinate.js").Coordinate|undefined)} Type
 */

const tmpExtent = createEmpty();


/**
 * @param {import("./extent.js").Extent} extent Extent.
 * @param {boolean} elastic If true the center can be slightly "forced" outside of the
 * constraint extent.
 * @return {Type} The constraint.
 */
export function createExtent(extent, elastic) {
  return (
    /**
     * @param {import("./coordinate.js").Coordinate=} center Center.
     * @param {number} resolution Resolution.
     * @param {number} rotation Rotation.
     * @param {import("./size.js").Size=} size Viewport size. If undefined, constrain only center.
     * @param {boolean} whileInteracting Will be true if the constraint is applied
     * during an interaction.
     * @return {import("./coordinate.js").Coordinate|undefined} Center.
     */
    function(center, resolution, rotation, size, whileInteracting) {
      if (center) {
        let viewWidth = 0;
        let viewHeight = 0;
        if (size) {
          const viewExtent = getForViewAndSize(center, resolution, rotation, size, tmpExtent);
          viewWidth = getWidth(viewExtent);
          viewHeight = getHeight(viewExtent);
        }

        const minX = extent[0] + viewWidth / 2;
        const maxX = extent[2] - viewWidth / 2;
        const minY = extent[1] + viewHeight / 2;
        const maxY = extent[3] - viewHeight / 2;
        let x = clamp(center[0], minX, maxX);
        let y = clamp(center[1], minY, maxY);
        let ratio = 15 * resolution;

        // during an interaction, allow some overscroll
        if (whileInteracting && elastic) {
          x += -ratio * Math.log(1 + Math.max(0, minX - center[0]) / ratio) +
            ratio * Math.log(1 + Math.max(0, center[0] - maxX) / ratio);
          y += -ratio * Math.log(1 + Math.max(0, minY - center[1]) / ratio) +
            ratio * Math.log(1 + Math.max(0, center[1] - maxY) / ratio);
        }

        return [x, y];
      } else {
        return undefined;
      }
    }
  );
}


/**
 * @param {import("./coordinate.js").Coordinate=} center Center.
 * @return {import("./coordinate.js").Coordinate|undefined} Center.
 */
export function none(center) {
  return center;
}
