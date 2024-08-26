import { execSync } from 'child_process';
const start = performance.now();
try {
  const output = execSync('ls', { encoding: 'utf-8' });
  console.log('Output:', output);
} catch (error) {
  console.error('Error:', error);
}
const end = performance.now();
let lag = end - start;
console.log("lag", lag);
