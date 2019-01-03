import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import TileLayer from '../src/ol/layer/Tile.js';
import BingMaps from '../src/ol/source/BingMaps.js';
import WebGLTileLayerRenderer from '../src/ol/renderer/webgl/TileLayer.js';


class CustomLayer extends TileLayer {
  createRenderer() {
    return new WebGLTileLayerRenderer(this, {
    });
  }
}

const map = new Map({
  layers: [
    new CustomLayer({
      source: new BingMaps({
        key: 'As1HiMj1PvLPlqc_gtM7AqZfBL8ZL3VrjaS3zIb22Uvb9WKhuJObROC-qUpa81U5',
        imagerySet: 'Aerial'
        // use maxZoom 19 to see stretched tiles instead of the BingMaps
        // "no photos at this zoom level" tiles
        // maxZoom: 19
      })
    })
  ],
  // Improve user experience by loading tiles while dragging/zooming. Will make
  // zooming choppy on mobile or slow devices.
  loadTilesWhileInteracting: true,
  target: 'map',
  view: new View({
    center: [-6655.5402445057125, 6709968.258934638],
    zoom: 13
  })
});
