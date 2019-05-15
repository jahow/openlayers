const fs = require('fs');
const path = require('path');

const workerDir = path.join(__dirname, '../src/ol/worker');
const workerPath = path.join(workerDir, 'worker.bundle.js');
const outputDir = path.join(__dirname, '../build/ol/worker');
const outputPath = path.join(outputDir, 'worker.js');

// read the content of the build worker
const file = fs.readFileSync(workerPath, 'utf-8');
const sFile = JSON.stringify(file);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// this generates a simple module around the built worker as blob
// to instantiate a new worker, simply import this module and call `Worker()`
fs.writeFileSync(outputPath, `
const blob = new Blob([${sFile}], {type: 'application/javascript'});
export default function () {
  return new Worker(URL.createObjectURL(blob));
};
`);
fs.unlinkSync(workerPath);
