/**
 * @module ol/source/VectorTileStream
 */

import {create as createVectorTileWorker} from '../worker/vectorTile.js';
import TileState from '../TileState.js';
import Tile from '../Tile.js';
import {getKeyZXY} from '../tilecoord.js';
import {buffer as bufferExtent, intersects} from '../extent.js';
import {getUid} from '../util.js';
import UrlTile from './UrlTile.js';

const VECTOR_TILE_WORKER = createVectorTileWorker();
let currentExchangeId = 0;

export class StreamVectorTile extends Tile {
  /**
   * @param {import("../tilecoord.js").TileCoord} tileCoord Tile coordinate.
   * @param {import("../TileState.js").default} state State.
   * @param {string} src Data source url.
   */
  constructor(tileCoord, state, src) {
    super(tileCoord, state);

    /**
     * @type {ArrayBuffer}
     */
    this.polygonVertexBuffer = null;

    /**
     * @type {ArrayBuffer}
     */
    this.polygonIndexBuffer = null;

    /**
     * @type {ArrayBuffer}
     */
    this.lineStringVertexBuffer = null;

    /**
     * @type {ArrayBuffer}
     */
    this.lineStringIndexBuffer = null;

    /**
     * @type {ArrayBuffer}
     */
    this.pointVertexBuffer = null;

    /**
     * @type {ArrayBuffer}
     */
    this.pointIndexBuffer = null;

    this.src_ = src;

    this.layerId = '';

    /**
     * Extent of this tile; set by the source.
     * @type {import("../extent.js").Extent}
     */
    this.extent = null;

    /**
     * Feature projection of this tile; set by the source.
     * @type {import("../proj/Projection.js").default}
     */
    this.projection = null;

    /**
     * Resolution of this tile; set by the source.
     * @type {number}
     */
    this.resolution;
  }

  async load() {
    this.setState(TileState.LOADING);
    const arrayBuffer = await fetch(this.src_).then((resp) => {
      if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`);
      return resp.arrayBuffer();
    });

    /** @type {VectorTileWorkerReadTileRequest} */
    const request = {
      type: 'readTile',
      exchangeId: currentExchangeId++,
      layerId: this.layerId,
      extent: this.extent,
      resolution: this.resolution,
      format: 'mvt',
      projectionCode: this.projection.getCode(),
      arrayBuffer,
    };
    /**
     * @param {VectorTileWorkerReadTileResponse} response
     */
    const handleResponse = (response) => {
      if (response.exchangeId !== request.exchangeId) return;
      VECTOR_TILE_WORKER.removeEventListener('message', handleResponse);
      // TODO: handle error
      this.polygonIndexBuffer = response.polygonIndexBuffer;
      this.polygonVertexBuffer = response.polygonVertexBuffer;
      this.lineStringIndexBuffer = response.lineStringIndexBuffer;
      this.lineStringVertexBuffer = response.lineStringVertexBuffer;
      this.pointIndexBuffer = response.pointIndexBuffer;
      this.pointVertexBuffer = response.pointVertexBuffer;
      this.setState(TileState.LOADED);
    };
    VECTOR_TILE_WORKER.addEventListener('message', (evt) =>
      handleResponse(evt.data)
    );
    VECTOR_TILE_WORKER.postMessage(request, [arrayBuffer]);
  }
}

/**
 * @typedef {Object} VectorTileWorkerNewLayerRequest
 * @property {'newLayer'} type
 * @property {number} exchangeId
 * @property {string} layerId The same id will be used for all exchanges relating to the same id
 * @property {import('../style/literal.js').LiteralStyle} style Literal style to be rendered
 */

/**
 * @typedef {Object} VectorTileWorkerNewLayerResponse
 * @property {number} exchangeId
 * @property {string} layerId
 */

/**
 * @typedef {Object} VectorTileWorkerReadTileRequest
 * @property {'readTile'} type
 * @property {number} exchangeId
 * @property {string} layerId
 * @property {'mvt'} format
 * @property {import("../extent.js").Extent} extent
 * @property {number} resolution
 * @property {string} projectionCode
 * @property {ArrayBuffer} arrayBuffer Raw data loaded from the tile url
 */

/**
 * @typedef {Object} VectorTileWorkerReadTileResponse
 * @property {number} exchangeId
 * @property {string} layerId
 * @property {ArrayBuffer} polygonVertexBuffer Vertices raw binary buffer for this tile.
 * @property {ArrayBuffer} polygonIndexBuffer Indices raw binary buffer for this tile.
 * @property {ArrayBuffer} lineStringVertexBuffer Vertices raw binary buffer for this tile.
 * @property {ArrayBuffer} lineStringIndexBuffer Indices raw binary buffer for this tile.
 * @property {ArrayBuffer} pointVertexBuffer Vertices raw binary buffer for this tile.
 * @property {ArrayBuffer} pointIndexBuffer Indices raw binary buffer for this tile.
 */

/**
 * @typedef {VectorTileWorkerNewLayerRequest | VectorTileWorkerReadTileRequest} VectorTileWorkerRequest
 */
/**
 * @typedef {VectorTileWorkerNewLayerResponse | VectorTileWorkerReadTileResponse} VectorTileWorkerResponse
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
class VectorTileStreamSource extends UrlTile {
  /**
   * @param {!Options} options Vector tile options.
   */
  constructor(options) {
    super({
      attributions: options.attributions,
      attributionsCollapsible: options.attributionsCollapsible,
      cacheSize: options.cacheSize,
      projection: options.projection,
      state: options.state,
      tileGrid: options.tileGrid,
      tileLoadFunction: null,
      url: options.url,
      urls: options.urls,
      wrapX: options.wrapX === undefined ? true : options.wrapX,
      transition: options.transition,
      zDirection: options.zDirection === undefined ? 1 : options.zDirection,
    });

    this.format_ = options.format;
  }

  /**
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection.js").default} projection Projection.
   * @return {StreamVectorTile|null} Tile.
   */
  getTile(z, x, y, pixelRatio, projection) {
    const coordKey = getKeyZXY(z, x, y);
    const key = this.getKey();
    let tile;
    if (this.tileCache.containsKey(coordKey)) {
      tile = this.tileCache.get(coordKey);
      if (tile.key === key) {
        return tile;
      }
    }
    const tileCoord = [z, x, y];
    let urlTileCoord = this.getTileCoordForTileUrlFunction(
      tileCoord,
      projection
    );
    if (urlTileCoord === null) {
      return null;
    }
    const tileGrid = this.getTileGridForProjection(projection);
    const gridExtent = tileGrid.getExtent();
    const tileExtent = tileGrid.getTileCoordExtent(urlTileCoord);
    // make extent 1 pixel smaller so we don't load tiles for < 0.5 pixel render space
    bufferExtent(tileExtent, -tileGrid.getResolution(z), tileExtent);
    if (!intersects(gridExtent, tileExtent)) {
      return null;
    }
    const tileUrl = this.tileUrlFunction(urlTileCoord, pixelRatio, projection);
    const newTile = new StreamVectorTile(tileCoord, TileState.IDLE, tileUrl);
    newTile.extent = tileGrid.getTileCoordExtent(urlTileCoord);
    newTile.projection = projection;
    newTile.resolution = tileGrid.getResolution(urlTileCoord[0]);

    newTile.key = key;
    if (tile) {
      newTile.interimTile = tile;
      newTile.refreshInterimChain();
      this.tileCache.replace(coordKey, newTile);
    } else {
      this.tileCache.set(coordKey, newTile);
    }
    return newTile;
  }

  async registerLayerAndStyle(layer, style) {
    /** @type {VectorTileWorkerNewLayerRequest} */
    const request = {
      type: 'newLayer',
      exchangeId: currentExchangeId++,
      layerId: getUid(layer),
      style: style,
    };
    return new Promise((resolve) => {
      const handleResponse = (response) => {
        if (response.exchangeId !== request.exchangeId) return;
        VECTOR_TILE_WORKER.removeEventListener('message', handleResponse);
        // TODO: handle error
        this.setState('ready');
        resolve();
      };
      VECTOR_TILE_WORKER.addEventListener('message', (evt) =>
        handleResponse(evt.data)
      );
      VECTOR_TILE_WORKER.postMessage(request);
    });
  }
}

export default VectorTileStreamSource;
