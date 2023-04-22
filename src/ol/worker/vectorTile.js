/**
 * A worker that loads features for a given vector tile.
 * @module ol/worker/vectorTile
 */
import MVT from '../format/MVT.js';
import MixedGeometryBatch from '../render/webgl/MixedGeometryBatch.js';
import {parseLiteralStyle} from '../webgl/styleparser.js';
import PolygonBatchRenderer from '../render/webgl/PolygonBatchRenderer.js';
import PointBatchRenderer from '../render/webgl/PointBatchRenderer.js';
import LineStringBatchRenderer from '../render/webgl/LineStringBatchRenderer.js';
import {
  writeLineSegmentToBuffers,
  writePointFeatureToBuffers,
  writePolygonTrianglesToBuffers,
} from '../render/webgl/utils.js';
import {
  create as createTransform,
  makeInverse as makeInverseTransform,
} from '../transform.js';

/** @type {any} */
const worker = self;

function generatePointBuffers(renderInstructions, customAttrSize) {
  // This is specific to point features (x, y, index)
  const baseVertexAttrsCount = 3;
  const baseInstructionsCount = 2;

  const instructionsCount = baseInstructionsCount + customAttrSize;

  const elementsCount = renderInstructions.length / instructionsCount;
  const indicesCount = elementsCount * 6;
  const verticesCount =
    elementsCount * 4 * (customAttrSize + baseVertexAttrsCount);
  const indexBuffer = new Uint32Array(indicesCount);
  const vertexBuffer = new Float32Array(verticesCount);

  let bufferPositions;
  for (let i = 0; i < renderInstructions.length; i += instructionsCount) {
    bufferPositions = writePointFeatureToBuffers(
      renderInstructions,
      i,
      vertexBuffer,
      indexBuffer,
      customAttrSize,
      bufferPositions
    );
  }

  return {
    vertexBuffer: vertexBuffer.buffer,
    indexBuffer: indexBuffer.buffer,
  };
}

function generateLineStringBuffers(renderInstructions, customAttrSize) {
  const vertices = [];
  const indices = [];

  const instructionsPerVertex = 2;

  let currentInstructionsIndex = 0;

  const transform = createTransform(); // todo: use actual transform!
  const invertTransform = createTransform();
  makeInverseTransform(invertTransform, transform);

  let verticesCount, customAttributes;
  while (currentInstructionsIndex < renderInstructions.length) {
    customAttributes = Array.from(
      renderInstructions.slice(
        currentInstructionsIndex,
        currentInstructionsIndex + customAttrSize
      )
    );
    currentInstructionsIndex += customAttrSize;
    verticesCount = renderInstructions[currentInstructionsIndex++];

    // last point is only a segment end, do not loop over it
    for (let i = 0; i < verticesCount - 1; i++) {
      writeLineSegmentToBuffers(
        renderInstructions,
        currentInstructionsIndex + i * instructionsPerVertex,
        currentInstructionsIndex + (i + 1) * instructionsPerVertex,
        i > 0
          ? currentInstructionsIndex + (i - 1) * instructionsPerVertex
          : null,
        i < verticesCount - 2
          ? currentInstructionsIndex + (i + 2) * instructionsPerVertex
          : null,
        vertices,
        indices,
        customAttributes,
        transform,
        invertTransform
      );
    }
    currentInstructionsIndex += verticesCount * instructionsPerVertex;
  }

  const indexBuffer = Uint32Array.from(indices);
  const vertexBuffer = Float32Array.from(vertices);

  return {
    vertexBuffer: vertexBuffer.buffer,
    indexBuffer: indexBuffer.buffer,
  };
}

function generatePolygonBuffers(renderInstructions, customAttrSize) {
  const vertices = [];
  const indices = [];

  let currentInstructionsIndex = 0;
  while (currentInstructionsIndex < renderInstructions.length) {
    currentInstructionsIndex = writePolygonTrianglesToBuffers(
      renderInstructions,
      currentInstructionsIndex,
      vertices,
      indices,
      customAttrSize
    );
  }

  const indexBuffer = Uint32Array.from(indices);
  const vertexBuffer = Float32Array.from(vertices);

  return {
    vertexBuffer: vertexBuffer.buffer,
    indexBuffer: indexBuffer.buffer,
  };
}

/**
 * @typedef {Object} LayerInfo
 * @property {import ('../webgl/styleparser.js').StyleParseResult} parsedStyle
 * @property {PolygonBatchRenderer} polygonRenderer
 * @property {LineStringBatchRenderer} lineStringRenderer
 * @property {PointBatchRenderer} pointRenderer
 */

/** @type {Object.<string, LayerInfo>} */
const layers = {};

/**
 * @param {{ data: import("../source/VectorTileStream.js").VectorTileWorkerRequest }} event
 */
function handleMessage(event) {
  const request = event.data;
  const exchangeId = request.exchangeId;
  const type = request.type;
  let response;

  // console.log('received', request);

  if (type === 'newLayer') {
    const parseResult = parseLiteralStyle(request.style);
    layers[request.layerId] = {
      parsedStyle: parseResult,
      polygonRenderer: new PolygonBatchRenderer(
        null,
        null,
        null,
        null,
        parseResult.attributes
      ),
      pointRenderer: new PointBatchRenderer(
        null,
        null,
        null,
        null,
        parseResult.attributes
      ),
      lineStringRenderer: new LineStringBatchRenderer(
        null,
        null,
        null,
        null,
        parseResult.attributes
      ),
    };
    /**
     * @type {import("../source/VectorTileStream.js").VectorTileWorkerNewLayerResponse}
     */
    response = {
      exchangeId,
      layerId: request.layerId,
    };
    sendResponse(response);
    return;
  }

  const format = new MVT();
  if (request.format !== 'mvt') throw new Error('unknown format');
  const data = request.arrayBuffer;
  const features = format.readFeatures(data, {
    extent: request.extent,
    featureProjection: request.projectionCode,
  });
  const batch = new MixedGeometryBatch();
  batch.addFeatures(features);
  // batch.addFeature(features[0]);

  const layerInfo = layers[request.layerId];
  layerInfo.polygonRenderer.generateRenderInstructions(batch.polygonBatch);
  layerInfo.pointRenderer.generateRenderInstructions(batch.pointBatch);
  layerInfo.lineStringRenderer.generateRenderInstructions(
    batch.lineStringBatch
  );

  const customAttrSize = layerInfo.parsedStyle.attributes.reduce(
    (prev, curr) => prev + (curr.size || 1),
    0
  );

  const polygonBuffers = generatePolygonBuffers(
    batch.polygonBatch.renderInstructions,
    customAttrSize
  );
  const pointBuffers = generatePointBuffers(
    batch.pointBatch.renderInstructions,
    customAttrSize
  );
  const lineStringBuffers = generateLineStringBuffers(
    batch.lineStringBatch.renderInstructions,
    customAttrSize
  );

  /**
   * @type {import("../source/VectorTileStream.js").VectorTileWorkerReadTileResponse}
   */
  response = {
    exchangeId,
    layerId: request.layerId,
    polygonVertexBuffer: polygonBuffers.vertexBuffer,
    polygonIndexBuffer: polygonBuffers.indexBuffer,
    pointVertexBuffer: pointBuffers.vertexBuffer,
    pointIndexBuffer: pointBuffers.indexBuffer,
    lineStringVertexBuffer: lineStringBuffers.vertexBuffer,
    lineStringIndexBuffer: lineStringBuffers.indexBuffer,
  };
  sendResponse(response, [
    polygonBuffers.vertexBuffer,
    polygonBuffers.indexBuffer,
    pointBuffers.vertexBuffer,
    pointBuffers.indexBuffer,
    lineStringBuffers.vertexBuffer,
    lineStringBuffers.indexBuffer,
  ]);
}

/**
 * @param {import("../source/VectorTileStream.js").VectorTileWorkerResponse} response
 */
function sendResponse(response, transfer) {
  worker.postMessage(response, transfer);
}

worker.onmessage = handleMessage;

export let create;
