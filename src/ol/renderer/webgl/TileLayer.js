import WebGLHelper, {DefaultAttrib} from '../../webgl/Helper';
import WebGLArrayBuffer from '../../webgl/Buffer';
import {ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, FLOAT, STATIC_DRAW} from '../../webgl';
import CanvasTileLayerRenderer from '../canvas/TileLayer';

const VERTEX_SHADER = `
  precision mediump float;
  
  attribute vec2 a_position;
  
  varying vec2 v_texCoord;
  
  void main(void) {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = vec2(a_position.x * 0.5 + 0.5, -a_position.y * 0.5 + 0.5);
  }`;

const FRAGMENT_SHADER = `
  precision mediump float;
  
  uniform sampler2D u_layer;

  varying vec2 v_texCoord;
  
  void main(void) {
    vec4 layerColor = texture2D(u_layer, v_texCoord);
    gl_FragColor = layerColor;
    gl_FragColor.rgb *= gl_FragColor.a;
  }`;

class WebGLTileLayerRenderer extends CanvasTileLayerRenderer {

  /**
   * @param {import("../../layer/Tile.js").default|import("../../layer/VectorTile.js").default} tileLayer Tile layer.
   */
  constructor(tileLayer, opt_options) {
    super(tileLayer);

    const options = opt_options || {};

    this.helper_ = new WebGLHelper({
      postProcesses: options.postProcesses,
      uniforms: {
        u_layer: this.context.canvas
      }
    });

    this.verticesBuffer_ = new WebGLArrayBuffer([], STATIC_DRAW);
    this.indicesBuffer_ = new WebGLArrayBuffer([], STATIC_DRAW);

    // insert initial geometry
    this.verticesBuffer_.getArray().push(
      -1, -1,
      1, -1,
      1, 1,
      -1, 1
    );
    this.indicesBuffer_.getArray().push(
      0, 1, 3,
      1, 2, 3
    );

    this.program_ = this.helper_.getProgram(
      options.fragmentShader || FRAGMENT_SHADER,
      options.vertexShader || VERTEX_SHADER
    );
    console.log(this.getShaderCompileErrors());
    this.helper_.useProgram(this.program_);
  }

  /**
   * @inheritDoc
   */
  renderFrame(frameState, layerState) {
    super.renderFrame(frameState, layerState);

    this.helper_.drawElements(0, this.indicesBuffer_.getArray().length);
    this.helper_.finalizeDraw(frameState);

    const canvas = this.helper_.getCanvas();

    // copy attributes from the canvas renderer
    canvas.style.opacity = this.context.canvas.style.opacity;

    return canvas;
  }

  /**
   * @inheritDoc
   */
  prepareFrame(frameState, layerState) {
    const stride = 2;

    this.helper_.prepareDraw(frameState);

    // bind buffers
    this.helper_.bindBuffer(ARRAY_BUFFER, this.verticesBuffer_);
    this.helper_.bindBuffer(ELEMENT_ARRAY_BUFFER, this.indicesBuffer_);

    const bytesPerFloat = Float32Array.BYTES_PER_ELEMENT;
    this.helper_.enableAttributeArray(DefaultAttrib.POSITION, 2, FLOAT, bytesPerFloat * stride, 0);

    return true;
  }

  /**
   * Will return the last shader compilation errors. If no error happened, will return null;
   * @return {string|null} Errors, or null if last compilation was successful
   * @api
   */
  getShaderCompileErrors() {
    return this.helper_.getShaderCompileErrors();
  }
}

export default WebGLTileLayerRenderer;
