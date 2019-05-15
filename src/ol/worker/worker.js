import * as WebGLRendererWorker from '../renderer/webgl/worker';

console.log('worker started');

self.onmessage = function(event) {
  WebGLRendererWorker.onmessage(event);
};

// this is to avoid errors about missing default export
export default function stub() {
  return 0;
};
