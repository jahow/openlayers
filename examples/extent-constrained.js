import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import TileLayer from '../src/ol/layer/Tile.js';
import OSM from '../src/ol/source/OSM.js';

const view = new View({
  center: [0, 0],
  zoom: 6,
  extent: [-572513.341856, 5211017.966314,
    916327.095083, 6636950.728974],
  restrictOnlyCenter: false
});

new Map({
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  target: 'map',
  view: view
});
