import { copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(projectRoot, 'dist');
const expectedFiles = ['app.js', 'index.html', 'style.css'];
const actualFiles = (await readdir(outputRoot)).sort();

const unexpected = actualFiles.filter((name) => !expectedFiles.includes(name));
const missing = expectedFiles.filter((name) => !actualFiles.includes(name));

if (unexpected.length || missing.length) {
  throw new Error(
    [
      unexpected.length ? `unexpected build outputs: ${unexpected.join(', ')}` : '',
      missing.length ? `missing build outputs: ${missing.join(', ')}` : ''
    ]
      .filter(Boolean)
      .join('; ')
  );
}

await Promise.all(
  expectedFiles.map((name) =>
    copyFile(resolve(outputRoot, name), resolve(projectRoot, name))
  )
);

console.log('Prepared GitHub Pages artifacts: index.html, style.css, app.js');
