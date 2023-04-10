/**
 * @module ol/source/VectorTileStream
 */

import VectorTile from './VectorTile.js';
import {create as createVectorTileWorker} from '../worker/vectorTile.js';

/**
 * @typedef {Object} VectorTileWorkerRequest
 * @property {number} exchangeId
 * @property {'mvt'} format
 * @property {import("../extent.js").Extent} extent
 * @property {number} resolution
 * @property {string} projectionCode
 * @property {ArrayBuffer} arrayBuffer
 */

/**
 * @typedef {Object} VectorTileWorkerResponse
 * @property {number} exchangeId
 * @property {Array<import("../render/Feature").default>} features Features
 */

/**
 * @typedef {Object} Options
 * @property {import("./Source.js").AttributionLike} [attributions] Attributions.
 * @property {boolean} [attributionsCollapsible=true] Attributions are collapsible.
 * @property {number} [cacheSize] Initial tile cache size. Will auto-grow to hold at least twice the number of tiles in the viewport.
 * @property {import("../extent.js").Extent} [extent] Extent.
 * @property {'mvt'} [format] Feature format for tiles, as string
 * @property {import("../proj.js").ProjectionLike} [projection='EPSG:3857'] Projection of the tile grid.
 * @property {import("./Source.js").State} [state] Source state.
 * @property {typeof import("../VectorTile.js").default} [tileClass] Class used to instantiate image tiles.
 * Default is {@link module:ol/VectorTile~VectorTile}.
 * @property {number} [maxZoom=22] Optional max zoom level. Not used if `tileGrid` is provided.
 * @property {number} [minZoom] Optional min zoom level. Not used if `tileGrid` is provided.
 * @property {number|import("../size.js").Size} [tileSize=512] Optional tile size. Not used if `tileGrid` is provided.
 * @property {number} [maxResolution] Optional tile grid resolution at level zero. Not used if `tileGrid` is provided.
 * @property {import("../tilegrid/TileGrid.js").default} [tileGrid] Tile grid.
 * @property {import("../Tile.js").UrlFunction} [tileUrlFunction] Optional function to get tile URL given a tile coordinate and the projection.
 * @property {string} [url] URL template. Must include `{x}`, `{y}` or `{-y}`, and `{z}` placeholders.
 * A `{?-?}` template pattern, for example `subdomain{a-f}.domain.com`, may be
 * used instead of defining each one separately in the `urls` option.
 * @property {number} [transition] A duration for tile opacity
 * transitions in milliseconds. A duration of 0 disables the opacity transition.
 * @property {Array<string>} [urls] An array of URL templates.
 * @property {boolean} [wrapX=true] Whether to wrap the world horizontally.
 * When set to `false`, only one world
 * will be rendered. When set to `true`, tiles will be wrapped horizontally to
 * render multiple worlds.
 * @property {number|import("../array.js").NearestDirectionFunction} [zDirection=1]
 * Choose whether to use tiles with a higher or lower zoom level when between integer
 * zoom levels. See {@link module:ol/tilegrid/TileGrid~TileGrid#getZForResolution}.
 */

/**
 * @classdesc
 * Class for layer sources providing vector data divided into a tile grid, to be
 * used with {@link module:ol/layer/VectorTile~VectorTileLayer}. Although this source receives tiles
 * with vector features from the server, it is not meant for feature editing.
 * Features are optimized for rendering, their geometries are clipped at or near
 * tile boundaries and simplified for a view resolution. See
 * {@link module:ol/source/Vector~VectorSource} for vector sources that are suitable for feature
 * editing.
 *
 * @fires import("./Tile.js").TileSourceEvent
 * @api
 */
class VectorTileStream extends VectorTile {
  /**
   * @param {!Options} options Vector tile options.
   */
  constructor(options) {
    let currentExchangeId = 0;
    const tileLoadFunctionWorker = (tile, url) => {
      tile.setLoader(
        /**
         * @param {import("../extent.js").Extent} extent Extent.
         * @param {number} resolution Resolution.
         * @param {import("../proj/Projection.js").default} projection Projection.
         */
        async (extent, resolution, projection) => {
          const arrayBuffer = await fetch(url).then((resp) => {
            if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`);
            return resp.arrayBuffer();
          });

          /** @type {VectorTileWorkerRequest} */
          const request = {
            exchangeId: currentExchangeId++,
            extent,
            resolution,
            format: options.format,
            projectionCode: projection.getCode(),
            arrayBuffer,
          };
          /**
           * @param {VectorTileWorkerResponse} response
           */
          const handleResponse = (response) => {
            if (response.exchangeId !== request.exchangeId) return;
            this.worker_.removeEventListener('message', handleResponse);
            // TODO: handle error

            // add methods for the render features to be usable... (horrible hack)
            response.features.forEach((feature) => {
              feature.getGeometry = () => feature;
              feature.getType = () => feature.type_;
              feature.getFlatCoordinates = () => feature.flatCoordinates_;
              feature.getEnds = () => feature.ends_;
              feature.get = (propName) => feature.properties_[propName];
            });

            tile.setFeatures(response.features);
          };
          this.worker_.addEventListener('message', (evt) =>
            handleResponse(evt.data)
          );
          this.worker_.postMessage(request, [arrayBuffer]);
        }
      );
    };

    super({
      attributions: options.attributions,
      attributionsCollapsible: options.attributionsCollapsible,
      cacheSize: options.cacheSize,
      projection: options.projection,
      state: options.state,
      tileGrid: options.tileGrid,
      tileLoadFunction: tileLoadFunctionWorker,
      url: options.url,
      urls: options.urls,
      wrapX: options.wrapX === undefined ? true : options.wrapX,
      transition: options.transition,
      zDirection: options.zDirection === undefined ? 1 : options.zDirection,
    });

    /**
     * @private
     */
    this.worker_ = createVectorTileWorker();
  }
}

export default VectorTileStream;
