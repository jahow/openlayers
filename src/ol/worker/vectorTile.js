/**
 * A worker that loads features for a given vector tile.
 * @module ol/worker/vectorTile
 */
import MVT from '../format/MVT.js';

/** @type {any} */
const worker = self;

/**
 * @param {{ data: import("../source/VectorTileStream.js").VectorTileWorkerRequest }} event
 */
function handleMessage(event) {
  const request = event.data;
  const exchangeId = request.exchangeId;
  const format = new MVT();
  if (request.format !== 'mvt') throw new Error('unknown format');

  const data = request.arrayBuffer;
  const features = format.readFeatures(data, {
    extent: request.extent,
    featureProjection: request.projectionCode,
  });
  sendResponse({
    features: /** @type {any} */ (features),
    exchangeId,
  });
}

/**
 * @param {import("../source/VectorTileStream.js").VectorTileWorkerResponse} response
 */
function sendResponse(response) {
  worker.postMessage(response);
}

worker.onmessage = handleMessage;

export let create;
