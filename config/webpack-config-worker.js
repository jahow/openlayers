const path = require('path');

module.exports = {
  entry: path.join(__dirname, '../src/ol/worker/worker.js'),
  devtool: false,
  mode: 'production',
  output: {
    path: path.join(__dirname, '../src/ol/worker'),
    filename: 'worker.bundle.js',
    libraryTarget: 'umd',
    libraryExport: 'default',
    globalObject: 'self'
  }
};
