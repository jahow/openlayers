/**
* @license
* Latitude/longitude spherical geodesy formulae taken from
* http://www.movable-type.co.uk/scripts/latlong.html
* Licensed under CC-BY-3.0.
*/

/**
 * @module ol/Sphere
 */
import {toRadians, toDegrees} from './math.js';
import GeometryType from './geom/GeometryType.js';


/**
 * Object literal with options for the {@link getLength} or
 * {@link getArea} functions.
 * @typedef {{projection: (ol.ProjectionLike|undefined),
 *    radius: (number|undefined)}}
 */
export let SphereMetricOptions;


/**
 * The mean Earth radius (1/3 * (2a + b)) for the WGS84 ellipsoid.
 * https://en.wikipedia.org/wiki/Earth_radius#Mean_radius
 * @type {number}
 */
export const DEFAULT_RADIUS = 6371008.8;


/**
 * Get the great circle distance (in meters) between two geographic coordinates.
 * @param {Array} c1 Starting coordinate.
 * @param {Array} c2 Ending coordinate.
 * @param {number=} opt_radius The sphere radius to use.  Defaults to the Earth's
 *     mean radius using the WGS84 ellipsoid.
 * @return {number} The great circle distance between the points (in meters).
 * @api
 */
export function getDistance(c1, c2, opt_radius) {
  const radius = opt_radius || DEFAULT_RADIUS;
  const lat1 = toRadians(c1[1]);
  const lat2 = toRadians(c2[1]);
  const deltaLatBy2 = (lat2 - lat1) / 2;
  const deltaLonBy2 = toRadians(c2[0] - c1[0]) / 2;
  const a = Math.sin(deltaLatBy2) * Math.sin(deltaLatBy2) +
      Math.sin(deltaLonBy2) * Math.sin(deltaLonBy2) *
      Math.cos(lat1) * Math.cos(lat2);
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


/**
 * Get the cumulative great circle length of linestring coordinates (geographic).
 * @param {Array} coordinates Linestring coordinates.
 * @param {number} radius The sphere radius to use.
 * @return {number} The length (in meters).
 */
function getLengthInternal(coordinates, radius) {
  let length = 0;
  for (let i = 0, ii = coordinates.length; i < ii - 1; ++i) {
    length += getDistance(coordinates[i], coordinates[i + 1], radius);
  }
  return length;
}


/**
 * Get the spherical length of a geometry.  This length is the sum of the
 * great circle distances between coordinates.  For polygons, the length is
 * the sum of all rings.  For points, the length is zero.  For multi-part
 * geometries, the length is the sum of the length of each part.
 * @param {ol.geom.Geometry} geometry A geometry.
 * @param {SphereMetricOptions=} opt_options Options for the length
 *     calculation.  By default, geometries are assumed to be in 'EPSG:3857'.
 *     You can change this by providing a `projection` option.
 * @param {(ol.ProjectionLike|undefined)} opt_options.projection Projection of
 *     the geometry.  By default, the geometry is assumed to be in EPSG:3857
 *     (Web Mercator).
 * @param {(number|undefined)} opt_options.radius Sphere radius.  Defaults to
 *     the Earth's mean radius using the WGS84 ellipsoid.
 * @return {number} The spherical length (in meters).
 * @api
 */
export function getLength(geometry, opt_options) {
  const options = opt_options || {};
  const radius = options.radius || DEFAULT_RADIUS;
  const projection = options.projection || 'EPSG:3857';
  const type = geometry.getType();
  if (type !== GeometryType.GEOMETRY_COLLECTION) {
    geometry = geometry.clone().transform(projection, 'EPSG:4326');
  }
  let length = 0;
  let coordinates, coords, i, ii, j, jj;
  switch (type) {
    case GeometryType.POINT:
    case GeometryType.MULTI_POINT: {
      break;
    }
    case GeometryType.LINE_STRING:
    case GeometryType.LINEAR_RING: {
      coordinates = /** @type {ol.geom.SimpleGeometry} */ (geometry).getCoordinates();
      length = getLengthInternal(coordinates, radius);
      break;
    }
    case GeometryType.MULTI_LINE_STRING:
    case GeometryType.POLYGON: {
      coordinates = /** @type {ol.geom.SimpleGeometry} */ (geometry).getCoordinates();
      for (i = 0, ii = coordinates.length; i < ii; ++i) {
        length += getLengthInternal(coordinates[i], radius);
      }
      break;
    }
    case GeometryType.MULTI_POLYGON: {
      coordinates = /** @type {ol.geom.SimpleGeometry} */ (geometry).getCoordinates();
      for (i = 0, ii = coordinates.length; i < ii; ++i) {
        coords = coordinates[i];
        for (j = 0, jj = coords.length; j < jj; ++j) {
          length += getLengthInternal(coords[j], radius);
        }
      }
      break;
    }
    case GeometryType.GEOMETRY_COLLECTION: {
      const geometries = /** @type {ol.geom.GeometryCollection} */ (geometry).getGeometries();
      for (i = 0, ii = geometries.length; i < ii; ++i) {
        length += getLength(geometries[i], opt_options);
      }
      break;
    }
    default: {
      throw new Error('Unsupported geometry type: ' + type);
    }
  }
  return length;
}


/**
 * Returns the spherical area for a list of coordinates.
 *
 * [Reference](https://trs-new.jpl.nasa.gov/handle/2014/40409)
 * Robert. G. Chamberlain and William H. Duquette, "Some Algorithms for
 * Polygons on a Sphere", JPL Publication 07-03, Jet Propulsion
 * Laboratory, Pasadena, CA, June 2007
 *
 * @param {Array.<ol.Coordinate>} coordinates List of coordinates of a linear
 * ring. If the ring is oriented clockwise, the area will be positive,
 * otherwise it will be negative.
 * @param {number} radius The sphere radius.
 * @return {number} Area (in square meters).
 */
function getAreaInternal(coordinates, radius) {
  let area = 0;
  const len = coordinates.length;
  let x1 = coordinates[len - 1][0];
  let y1 = coordinates[len - 1][1];
  for (let i = 0; i < len; i++) {
    const x2 = coordinates[i][0];
    const y2 = coordinates[i][1];
    area += toRadians(x2 - x1) *
        (2 + Math.sin(toRadians(y1)) +
        Math.sin(toRadians(y2)));
    x1 = x2;
    y1 = y2;
  }
  return area * radius * radius / 2.0;
}


/**
 * Get the spherical area of a geometry.  This is the area (in meters) assuming
 * that polygon edges are segments of great circles on a sphere.
 * @param {ol.geom.Geometry} geometry A geometry.
 * @param {SphereMetricOptions=} opt_options Options for the area
 *     calculation.  By default, geometries are assumed to be in 'EPSG:3857'.
 *     You can change this by providing a `projection` option.
 * @return {number} The spherical area (in square meters).
 * @api
 */
export function getArea(geometry, opt_options) {
  const options = opt_options || {};
  const radius = options.radius || DEFAULT_RADIUS;
  const projection = options.projection || 'EPSG:3857';
  const type = geometry.getType();
  if (type !== GeometryType.GEOMETRY_COLLECTION) {
    geometry = geometry.clone().transform(projection, 'EPSG:4326');
  }
  let area = 0;
  let coordinates, coords, i, ii, j, jj;
  switch (type) {
    case GeometryType.POINT:
    case GeometryType.MULTI_POINT:
    case GeometryType.LINE_STRING:
    case GeometryType.MULTI_LINE_STRING:
    case GeometryType.LINEAR_RING: {
      break;
    }
    case GeometryType.POLYGON: {
      coordinates = /** @type {ol.geom.Polygon} */ (geometry).getCoordinates();
      area = Math.abs(getAreaInternal(coordinates[0], radius));
      for (i = 1, ii = coordinates.length; i < ii; ++i) {
        area -= Math.abs(getAreaInternal(coordinates[i], radius));
      }
      break;
    }
    case GeometryType.MULTI_POLYGON: {
      coordinates = /** @type {ol.geom.SimpleGeometry} */ (geometry).getCoordinates();
      for (i = 0, ii = coordinates.length; i < ii; ++i) {
        coords = coordinates[i];
        area += Math.abs(getAreaInternal(coords[0], radius));
        for (j = 1, jj = coords.length; j < jj; ++j) {
          area -= Math.abs(getAreaInternal(coords[j], radius));
        }
      }
      break;
    }
    case GeometryType.GEOMETRY_COLLECTION: {
      const geometries = /** @type {ol.geom.GeometryCollection} */ (geometry).getGeometries();
      for (i = 0, ii = geometries.length; i < ii; ++i) {
        area += getArea(geometries[i], opt_options);
      }
      break;
    }
    default: {
      throw new Error('Unsupported geometry type: ' + type);
    }
  }
  return area;
}


/**
 * Returns the coordinate at the given distance and bearing from `c1`.
 *
 * @param {ol.Coordinate} c1 The origin point (`[lon, lat]` in degrees).
 * @param {number} distance The great-circle distance between the origin
 *     point and the target point.
 * @param {number} bearing The bearing (in radians).
 * @param {number=} opt_radius The sphere radius to use.  Defaults to the Earth's
 *     mean radius using the WGS84 ellipsoid.
 * @return {ol.Coordinate} The target point.
 */
export function offset(c1, distance, bearing, opt_radius) {
  const radius = opt_radius || DEFAULT_RADIUS;
  const lat1 = toRadians(c1[1]);
  const lon1 = toRadians(c1[0]);
  const dByR = distance / radius;
  const lat = Math.asin(
    Math.sin(lat1) * Math.cos(dByR) +
      Math.cos(lat1) * Math.sin(dByR) * Math.cos(bearing));
  const lon = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(dByR) * Math.cos(lat1),
    Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat));
  return [toDegrees(lon), toDegrees(lat)];
}
