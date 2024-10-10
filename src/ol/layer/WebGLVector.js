/**
 * @module ol/layer/WebGLVector
 */
import Layer from './Layer.js';
import WebGLPointsLayerRenderer from '../renderer/webgl/PointsLayer.js';
import WebGLVectorLayerRenderer from '../renderer/webgl/VectorLayer.js';
import {parseLiteralStyle} from '../webgl/styleparser.js';

/***
 * @template T
 * @typedef {T extends import("../source/Vector.js").default<infer U extends import("../Feature.js").FeatureLike> ? U : never} ExtractedFeatureType
 */

/**
 * @template {import("../source/Vector.js").default<FeatureType>} [VectorSourceType=import("../source/Vector.js").default<*>]
 * @template {import('../Feature.js').FeatureLike} [FeatureType=ExtractedFeatureType<VectorSourceType>]
 * @typedef {Object} Options
 * @property {string} [className='ol-layer'] A CSS class name to set to the layer element.
 * @property {number} [opacity=1] Opacity (0, 1).
 * @property {boolean} [visible=true] Visibility.
 * @property {import("../extent.js").Extent} [extent] The bounding extent for layer rendering.  The layer will not be
 * rendered outside of this extent.
 * FIXME: not supported yet
 * @property {number} [zIndex] The z-index for layer rendering.  At rendering time, the layers
 * will be ordered, first by Z-index and then by position. When `undefined`, a `zIndex` of 0 is assumed
 * for layers that are added to the map's `layers` collection, or `Infinity` when the layer's `setMap()`
 * method was used.
 * @property {number} [minResolution] The minimum resolution (inclusive) at which this layer will be
 * visible.
 * @property {number} [maxResolution] The maximum resolution (exclusive) below which this layer will
 * be visible.
 * @property {number} [minZoom] The minimum view zoom level (exclusive) above which this layer will be
 * visible.
 * @property {number} [maxZoom] The maximum view zoom level (inclusive) at which this layer will
 * be visible.
 * @property {VectorSourceType} [source] Source.
 * @property {import('../style/webgl.js').WebGLStyle} style Layer style.
 * @property {import("./Base.js").BackgroundColor} [background] Background color for the layer. If not specified, no background
 * will be rendered.
 * FIXME: not supported yet
 * @property {boolean} [disableHitDetection=false] Setting this to true will provide a slight performance boost, but will
 * prevent all hit detection on the layer.
 * @property {Object<string, *>} [properties] Arbitrary observable properties. Can be accessed with `#get()` and `#set()`.
 */

/**
 * @classdesc
 * Layer optimized for rendering large vector datasets.
 *
 * **Important: a `WebGLVector` layer must be manually disposed when removed, otherwise the underlying WebGL context
 * will not be garbage collected.**
 *
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Vector.js").default<FeatureType>} [VectorSourceType=import("../source/Vector.js").default<*>]
 * @template {import('../Feature.js').FeatureLike} [FeatureType=ExtractedFeatureType<VectorSourceType>]
 * @extends {Layer<VectorSourceType, WebGLVectorLayerRenderer>}
 */
class WebGLVectorLayer extends Layer {
  /**
   * @param {Options<VectorSourceType, FeatureType>} [options] Options.
   */
  constructor(options) {
    const baseOptions = Object.assign({}, options);

    super(baseOptions);

    /**
     * @private
     */
    this.style = options.style;

    /**
     * @private
     */
    this.hitDetectionDisabled = !!options.disableHitDetection;
  }

  /**
   * @override
   */
  createRenderer() {
    return new WebGLVectorLayerRenderer(this, {
      style: this.style,
      disableHitDetection: this.hitDetectionDisabled,
      className: this.getClassName(),
    });
  }

  /**
   * Update any variables used by the layer style and trigger a re-render.
   * @param {Object<string, number>} variables Variables to update.
   */
  updateStyleVariables(variables) {
    // FIXME: move style variables to the layer in order update them
    //Object.assign(this.styleVariables_, variables);
    this.changed();
  }
}

export default WebGLVectorLayer;
