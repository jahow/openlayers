
import {inherits} from '../../index.js';
import LayerType from '../../LayerType.js';
import TileState from '../../TileState.js';
import ViewHint from '../../ViewHint.js';
import rbush from 'rbush';
import {buffer, getIntersection, equals, intersects, createEmpty, containsExtent, getWidth} from '../../extent.js';
import {equivalent as equivalentProjection} from '../../proj.js';
import Units from '../../proj/Units.js';
import ReplayType from '../../render/ReplayType.js';
import {labelCache, rotateAtOffset} from '../../render/canvas.js';
import WebGLReplayGroup from '../../render/webgl/ReplayGroup.js';
import RendererType from '../Type.js';
import WebGLTileLayerRenderer from '../webgl/TileLayer.js';
import {defaultOrder as defaultRenderOrder, getSquaredTolerance as getSquaredRenderTolerance, getTolerance as getRenderTolerance, renderFeature} from '../vector.js';
import _ol_transform_ from '../../transform.js';


/**
 * @constructor
 * @extends {ol.renderer.webgl.TileLayer}
 * @param {ol.renderer.webgl.Map} mapRenderer Map renderer.
 * @param {ol.layer.VectorTile} tileLayer Tile layer.
 * @api
 */
const WebGLVectorTileLayerRenderer = function(mapRenderer, tileLayer) {

  /**
   * @type {CanvasRenderingContext2D}
   */
  this.context = null;

  WebGLTileLayerRenderer.call(this, mapRenderer, tileLayer);

  /**
   * Declutter tree.
   * @private
     */
  this.declutterTree_ = tileLayer.getDeclutter() ? rbush(9) : null;

  /**
   * @private
   * @type {number}
   */
  this.renderedResolution_ = NaN;

  /**
   * @private
   * @type {ol.Extent}
   */
  this.renderedExtent_ = createEmpty();

  /**
   * @private
   * @type {function(ol.Feature, ol.Feature): number|null}
   */
  this.renderedRenderOrder_ = null;

  /**
   * @private
   * @type {ol.render.webgl.ReplayGroup}
   */
  this.replayGroup_ = null;

  /**
   * @private
   * @type {ol.Transform}
   */
  this.tmpTransform_ = _ol_transform_.create();

  /**
   * @protected
   * @type {number}
   */
  this.zDirection = 0;

  /**
   * @private
   * @type {!Array.<ol.Tile>}
   */
  this.renderedTiles_ = [];
};
inherits(WebGLVectorTileLayerRenderer, WebGLTileLayerRenderer);


/**
 * Determine if this renderer handles the provided layer.
 * @param {ol.renderer.Type} type The renderer type.
 * @param {ol.layer.Layer} layer The candidate layer.
 * @return {boolean} The renderer can render the layer.
 */
WebGLVectorTileLayerRenderer['handles'] = function(type, layer) {
  return type === RendererType.WEBGL && layer.getType() === LayerType.VECTOR_TILE;
};


/**
 * Create a layer renderer.
 * @param {ol.renderer.Map} mapRenderer The map renderer.
 * @param {ol.layer.Layer} layer The layer to be rendererd.
 * @return {WebGLVectorTileLayerRenderer} The layer renderer.
 */
WebGLVectorTileLayerRenderer['create'] = function(mapRenderer, layer) {
  return new WebGLVectorTileLayerRenderer(
    /** @type {ol.renderer.webgl.Map} */ (mapRenderer),
    /** @type {ol.layer.VectorTile} */ (layer));
};


/**
 * @inheritDoc
 */
WebGLVectorTileLayerRenderer.prototype.composeFrame = function(frameState, layerState, context) {

  console.group('composeFrame');

  var layer = this.getLayer();
  // var source = /** @type {ol.source.VectorTile} */ (layer.getSource());
  var pixelRatio = frameState.pixelRatio;
  var viewState = frameState.viewState;
  // var rotation = viewState.rotation;
  var size = frameState.size;
  var gl = this.mapRenderer.getGL();

  var tiles = this.renderedTiles_;
  // var tileGrid = source.getTileGridForProjection(viewState.projection);
  console.log(tiles.length + ' rendered tiles');

  gl.enable(gl.SCISSOR_TEST);

  for (var i = tiles.length - 1; i >= 0; --i) {
    var tile = /** @type {ol.VectorImageTile} */ (tiles[i]);
    if (tile.getState() == TileState.ABORT) {
      continue;
    }
    var tileCoord = tile.tileCoord;
    // var worldOffset = tileGrid.getTileCoordExtent(tileCoord)[0] -
    //     tileGrid.getTileCoordExtent(tile.tileCoord)[0];
    for (var t = 0, tt = tile.tileKeys.length; t < tt; ++t) {
      console.log('rendering sourceTile with key ' + tile.tileKeys[t]);
      var sourceTile = tile.getTile(tile.tileKeys[t]);
      if (sourceTile.getState() == TileState.ERROR) {
        continue;
      }
      var replayGroup = sourceTile.getReplayGroup(layer, tileCoord.toString());
      if (!replayGroup) {
        console.warn(' > no replay group available (this should not happen)');
        continue;
      }
      if (replayGroup && !replayGroup.isEmpty()) {
        console.log(' > replaying replaygroup...');
        // TODO: apply scissor test on intersection between view & tile extent
        gl.scissor(0, 0, size[0] * pixelRatio, size[1] * pixelRatio);
        replayGroup.replay(context,
          viewState.center, viewState.resolution, viewState.rotation,
          size, pixelRatio, layerState.opacity,
          layerState.managed ? frameState.skippedFeatureUids : {});
        console.log('                     ...done');
      }
    }
  }
  gl.disable(gl.SCISSOR_TEST);
  console.groupEnd();
};


/**
 * @inheritDoc
 */
WebGLVectorTileLayerRenderer.prototype.prepareFrame = function(frameState, layerState, context) {

  var tileLayer = /** @type {ol.layer.VectorTile} */ (this.getLayer());
  var tileSource = tileLayer.getSource();

  var animating = frameState.viewHints[ViewHint.ANIMATING];
  var interacting = frameState.viewHints[ViewHint.INTERACTING];
  var updateWhileAnimating = tileLayer.getUpdateWhileAnimating();
  var updateWhileInteracting = tileLayer.getUpdateWhileInteracting();

  if ((!updateWhileAnimating && animating) ||
      (!updateWhileInteracting && interacting)) {
    return true;
  }

  console.group('prepareFrame');

  var frameStateExtent = frameState.extent;
  var viewState = frameState.viewState;
  var projection = viewState.projection;
  var resolution = viewState.resolution;
  var pixelRatio = frameState.pixelRatio;
  var layerRevision = tileLayer.getRevision();
  var layerRenderBuffer = tileLayer.getRenderBuffer();
  var layerRenderOrder = tileLayer.getRenderOrder();
  var tileGrid = tileSource.getTileGridForProjection(projection);
  var z = tileGrid.getZForResolution(resolution, this.zDirection);
  var tileRange = tileGrid.getTileRangeForExtentAndZ(frameStateExtent, z);

  if (layerRenderOrder === undefined) {
    layerRenderOrder = defaultRenderOrder;
  }

  var extent = buffer(frameStateExtent,
      layerRenderBuffer * resolution);

  this.renderedTiles_.length = 0;
  var tile, x, y;
  for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
    for (y = tileRange.minY; y <= tileRange.maxY; ++y) {
      tile = tileSource.getTile(z, x, y, pixelRatio, projection);
      console.log('creating replay group for tile at x=' + x + ' y=' + y);
      this.renderedTiles_.push(tile);
      this.createReplayGroup_(
        /** @type {ol.VectorImageTile} */(tile),
        frameState,
        context);
    }
  }

  this.updateUsedTiles(frameState.usedTiles, tileSource, z, tileRange);
  this.manageTilePyramid(frameState, tileSource, tileGrid, pixelRatio,
      projection, extent, z, tileLayer.getPreload());
  this.scheduleExpireCache(frameState, tileSource);

  this.renderedResolution_ = resolution;
  this.renderedRevision = layerRevision;
  this.renderedRenderOrder_ = layerRenderOrder;
  this.renderedExtent_ = extent;

  console.groupEnd();

  return true;
};


/**
 * @param {ol.VectorImageTile} tile Tile.
 * @param {olx.FrameState} frameState Frame state.
 * @param {ol.webgl.Context} context Context.
 * @private
 */
WebGLVectorTileLayerRenderer.prototype.createReplayGroup_ = function(
    tile, frameState, context) {
  var layer = /** @type {ol.layer.VectorTile} */ (this.getLayer());
  var pixelRatio = frameState.pixelRatio;
  var projection = frameState.viewState.projection;
  var revision = layer.getRevision();
  var renderOrder = /** @type {ol.RenderOrderFunction} */
      (layer.getRenderOrder()) || null;

  if (tile.getState() !== TileState.LOADED) {
    return;
  }

  var replayState = tile.getReplayState(layer);
  console.log('last replay state: ', replayState);
  if (!replayState.dirty && replayState.renderedRevision == revision &&
      replayState.renderedRenderOrder == renderOrder) {
    console.log(' > nothing changed on tile (replaystate), skipping');
    return;
  }

  var source = /** @type {ol.source.VectorTile} */ (layer.getSource());
  var sourceTileGrid = source.getTileGrid();
  var tileGrid = source.getTileGridForProjection(projection);
  var resolution = tileGrid.getResolution(tile.tileCoord[0]);
  var tileExtent = tileGrid.getTileCoordExtent(tile.tileCoord);

  // var zIndexKeys = {};
  for (var t = 0, tt = tile.tileKeys.length; t < tt; ++t) {
    var sourceTile = tile.getTile(tile.tileKeys[t]);
    console.log(' > creating replay group for sourceTile ' + tile.tileKeys[t]);
    if (sourceTile.getState() == TileState.ERROR) {
      console.log(' > sourceTile in error, skipping');
      continue;
    }
    console.log(' > sourceTile state: ' + sourceTile.getState());

    var sourceTileCoord = sourceTile.tileCoord;
    var sourceTileExtent = sourceTileGrid.getTileCoordExtent(sourceTileCoord);
    var sharedExtent = getIntersection(tileExtent, sourceTileExtent);
    var bufferedExtent = equals(sourceTileExtent, sharedExtent) ? null :
      buffer(sharedExtent, layer.getRenderBuffer() * resolution);
    var tileProjection = sourceTile.getProjection();
    var reproject = false;
    if (!equivalentProjection(projection, tileProjection)) {
      reproject = true;
      sourceTile.setProjection(projection);
    }
    replayState.dirty = false;
    var replayGroup = new WebGLReplayGroup(
      getRenderTolerance(resolution, pixelRatio),
      tileExtent, layer.getRenderBuffer());

    /**
     * @param {ol.Feature|ol.render.Feature} feature Feature.
     * @this {WebGLVectorTileLayerRenderer}
     */
    var renderFeature = function(feature) {
      var styles;
      var styleFunction = layer.getStyleFunction();
      if (styleFunction) {
        styles = styleFunction(feature, resolution);
      }
      if (styles) {
        var dirty = this.renderFeature(
          /** @type {ol.Feature} */(feature), resolution, pixelRatio, styles, replayGroup);
        replayState.dirty = replayState.dirty || dirty;
      }
    };

    var features = sourceTile.getFeatures();
    if (!features || !features.length) {
      console.warn(' > no features found in sourceTile, skipping (this should not happen)');
      return;
    }
    console.log(' > ' + features.length + ' features found in sourceTile');

    if (renderOrder && renderOrder !== replayState.renderedRenderOrder) {
      console.log(' > sorting features');
      features.sort(renderOrder);
    }
    var feature;
    console.log(' > saving features in replaygroup...');
    for (var i = 0, ii = features.length; i < ii; ++i) {
      feature = features[i];
      if (reproject) {
        if (tileProjection.getUnits() == Units.TILE_PIXELS) {
          // projected tile extent
          tileProjection.setWorldExtent(sourceTileExtent);
          // tile extent in tile pixel space
          tileProjection.setExtent(sourceTile.getExtent());
        }
        feature.getGeometry().transform(tileProjection, projection);
      }
      if (!bufferedExtent || intersects(bufferedExtent, feature.getGeometry().getExtent())) {
        renderFeature.call(this, feature);
      }
    }
    console.log('                           ...done');
    replayGroup.finish(context);
    sourceTile.setReplayGroup(layer, tile.tileCoord.toString(), replayGroup);
  }
  replayState.renderedRevision = revision;
  replayState.renderedRenderOrder = renderOrder;
};


/**
 * @inheritDoc
 */
WebGLVectorTileLayerRenderer.prototype.forEachFeatureAtCoordinate = function(coordinate, frameState, hitTolerance, callback, thisArg) {
  // var resolution = frameState.viewState.resolution;
  // var rotation = frameState.viewState.rotation;
  // hitTolerance = hitTolerance == undefined ? 0 : hitTolerance;
  // var layer = this.getLayer();
  // /** @type {Object.<string, boolean>} */
  // var features = {};

  // /** @type {Array.<ol.VectorImageTile>} */
  // var renderedTiles = this.renderedTiles;

  // var source = /** @type {ol.source.VectorTile} */ (layer.getSource());
  // var tileGrid = source.getTileGridForProjection(frameState.viewState.projection);
  // var bufferedExtent, found;
  // var i, ii, replayGroup;
  // var tile, tileCoord, tileExtent;
  // for (i = 0, ii = renderedTiles.length; i < ii; ++i) {
  //   tile = renderedTiles[i];
  //   tileCoord = tile.wrappedTileCoord;
  //   tileExtent = tileGrid.getTileCoordExtent(tileCoord, this.tmpExtent);
  //   bufferedExtent = ol.extent.buffer(tileExtent, hitTolerance * resolution, bufferedExtent);
  //   if (!ol.extent.containsCoordinate(bufferedExtent, coordinate)) {
  //     continue;
  //   }
  //   for (var t = 0, tt = tile.tileKeys.length; t < tt; ++t) {
  //     var sourceTile = tile.getTile(tile.tileKeys[t]);
  //     if (sourceTile.getState() == TileState.ERROR) {
  //       continue;
  //     }
  //     replayGroup = sourceTile.getReplayGroup(layer, tile.tileCoord.toString());
  //     found = found || replayGroup.forEachFeatureAtCoordinate(
  //         coordinate, resolution, rotation, hitTolerance, {},
  //         /**
  //          * @param {ol.Feature|ol.render.Feature} feature Feature.
  //          * @return {?} Callback result.
  //          */
  //         function(feature) {
  //           var key = ol.getUid(feature).toString();
  //           if (!(key in features)) {
  //             features[key] = true;
  //             return callback.call(thisArg, feature, layer);
  //           }
  //         }, null);
  //   }
  // }
  // return found;
  return [];
};


/**
 * Handle changes in image style state.
 * @param {ol.events.Event} event Image style change event.
 * @private
 */
WebGLVectorTileLayerRenderer.prototype.handleStyleImageChange_ = function(event) {
  this.renderIfReadyAndVisible();
};


/**
 * @inheritDoc
 */
// WebGLVectorTileLayerRenderer.prototype.postCompose = function(context, frameState, layerState) {
// };


/**
 * @param {ol.Feature} feature Feature.
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {(ol.style.Style|Array.<ol.style.Style>)} styles The style or array of
 *     styles.
 * @param {ol.render.webgl.ReplayGroup} replayGroup Replay group.
 * @return {boolean} `true` if an image is loading.
 */
WebGLVectorTileLayerRenderer.prototype.renderFeature = function(feature, resolution, pixelRatio, styles, replayGroup) {
  if (!styles) {
    return false;
  }
  var loading = false;
  if (Array.isArray(styles)) {
    for (var i = styles.length - 1, ii = 0; i >= ii; --i) {
      loading = renderFeature(
          replayGroup, feature, styles[i],
          getSquaredRenderTolerance(resolution, pixelRatio),
          this.handleStyleImageChange_, this) || loading;
    }
  } else {
    loading = renderFeature(
        replayGroup, feature, styles,
        getSquaredRenderTolerance(resolution, pixelRatio),
        this.handleStyleImageChange_, this) || loading;
  }
  return loading;
};
export default WebGLVectorTileLayerRenderer;
