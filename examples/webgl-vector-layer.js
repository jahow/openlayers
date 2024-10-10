import GeoJSON from '../src/ol/format/GeoJSON.js';
import Map from '../src/ol/Map.js';
import OSM from '../src/ol/source/OSM.js';
import TileLayer from '../src/ol/layer/WebGLTile.js';
import VectorSource from '../src/ol/source/Vector.js';
import View from '../src/ol/View.js';
import WebGLVectorLayer from '../src/ol/layer/WebGLVector.js';

/** @type {import('../src/ol/style/webgl.js').WebGLStyle} */
const style = {
  variables: {
    highlightedId: -1,
  },
  'stroke-color': [
    'case',
    ['==', ['var', 'highlightedId'], ['get', 'id']],
    'white',
    ['*', ['get', 'COLOR'], [220, 220, 220]],
  ],
  'stroke-width': 2,
  'stroke-offset': -1,
  'fill-color': ['*', ['get', 'COLOR'], [255, 255, 255, 0.6]],
};

const osm = new TileLayer({
  source: new OSM(),
});

const vectorLayer = new WebGLVectorLayer({
  source: new VectorSource({
    url: 'https://openlayers.org/data/vector/ecoregions.json',
    format: new GeoJSON(),
  }),
  style,
});

const map = new Map({
  layers: [osm, vectorLayer],
  target: 'map',
  view: new View({
    center: [0, 0],
    zoom: 1,
  }),
});

let highlightedId = -1;
const displayFeatureInfo = function (pixel) {
  const feature = map.forEachFeatureAtPixel(pixel, function (feature) {
    return feature;
  });

  const info = document.getElementById('info');
  if (feature) {
    info.innerHTML = feature.get('ECO_NAME') || '&nbsp;';
  } else {
    info.innerHTML = '&nbsp;';
  }

  if (!feature) {
    highlightedId = -1;
    // FIXME: do vectorLayer.updateStyleVariables({ highlightedId })
    style.variables.highlightedId = -1;
    vectorLayer.changed();
    return;
  }

  const id = feature.getId(); // FIXME: use feature.getId()
  if (id !== highlightedId) {
    highlightedId = id;
    // FIXME: do vectorLayer.updateStyleVariables({ highlightedId })
    style.variables.highlightedId = highlightedId;
    vectorLayer.changed();
  }
};

map.on('pointermove', function (evt) {
  if (evt.dragging) {
    return;
  }
  const pixel = map.getEventPixel(evt.originalEvent);
  displayFeatureInfo(pixel);
});

map.on('click', function (evt) {
  displayFeatureInfo(evt.pixel);
});
