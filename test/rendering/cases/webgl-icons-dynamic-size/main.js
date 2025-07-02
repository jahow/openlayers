import Feature from '../../../../src/ol/Feature.js';
import Map from '../../../../src/ol/Map.js';
import View from '../../../../src/ol/View.js';
import Point from '../../../../src/ol/geom/Point.js';
import TileLayer from '../../../../src/ol/layer/Tile.js';
import WebGLVectorLayer from '../../../../src/ol/layer/WebGLVector.js';
import {fromLonLat} from '../../../../src/ol/proj.js';
import VectorSource from '../../../../src/ol/source/Vector.js';
import XYZ from '../../../../src/ol/source/XYZ.js';

const vector = new WebGLVectorLayer({
  source: new VectorSource({
    features: [
      new Feature({
        geometry: new Point(fromLonLat([0, 0])),
        myScale: [1, 1],
      }),
      new Feature({
        geometry: new Point(fromLonLat([0, -70])),
        myScale: [1, 4],
      }),
      new Feature({
        geometry: new Point(fromLonLat([90, 0])),
        myScale: [2, 0.5],
        myScale2: 2,
      }),
      new Feature({
        geometry: new Point(fromLonLat([90, -70])),
        myScale: [0.4, 0.4],
        myScale2: 10,
      }),
    ],
  }),
  style: {
    'icon-src': '/data/cross.svg',
    'icon-scale': [
      '*',
      2,
      [0.5, 0.5],
      ['get', 'myScale'],
      ['case', ['has', 'myScale2'], ['get', 'myScale2'], 1],
    ],
  },
});

const raster = new TileLayer({
  source: new XYZ({
    url: '/data/tiles/osm/{z}/{x}/{y}.png',
    transition: 0,
  }),
});

new Map({
  layers: [raster, vector],
  target: 'map',
  view: new View({
    center: [0, 0],
    zoom: 0,
  }),
});

render({
  message: 'Points are rendered using webgl with varying icon sizes',
});
