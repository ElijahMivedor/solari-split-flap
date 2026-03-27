#!/usr/bin/env node

/**
 * build.js — Bundle src/solari.js + src/solari.css into dist/ (UMD + ESM).
 * No external dependencies required.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Read source files
const jsSource = fs.readFileSync(path.join(srcDir, 'solari.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(srcDir, 'solari.css'), 'utf8');

// Minify CSS (basic: collapse whitespace, remove comments)
const cssMinified = cssSource
  .replace(/\/\*[\s\S]*?\*\//g, '')    // remove comments
  .replace(/\s+/g, ' ')                // collapse whitespace
  .replace(/\s*([{}:;,>+~])\s*/g, '$1') // remove space around selectors/props
  .replace(/;}/g, '}')                 // remove trailing semicolons
  .trim();

// Escape for embedding in JS string
const cssEscaped = cssMinified
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\n/g, '\\n');

// Strip the ES module export lines from the source for embedding
const jsCore = jsSource
  .replace(/^export \{[^}]+\};?\s*$/m, '')
  .replace(/^export default [^;]+;?\s*$/m, '')
  .replace("'__SOLARI_CSS__'", "'" + cssEscaped + "'");

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// ──────────────────────────────────────────────
// UMD build (dist/solari.js)
// ──────────────────────────────────────────────
const umd = `/**
 * solari-split-flap v${require('./package.json').version}
 * A physically accurate split-flap (Solari board) display.
 * MIT License
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.SolariBoard = exports.SolariBoard;
    root.SolariBoard.generateTheme = exports.generateTheme;
    root.SolariBoard.themes = exports.themes;
    root.SolariBoard.defaultQuotes = exports.defaultQuotes;
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function() {
${jsCore}

  return {
    SolariBoard: SolariBoard,
    generateTheme: generateTheme,
    themes: THEMES,
    defaultQuotes: DEFAULT_QUOTES
  };
}));
`;

fs.writeFileSync(path.join(distDir, 'solari.js'), umd, 'utf8');

// ──────────────────────────────────────────────
// ESM build (dist/solari.esm.js)
// ──────────────────────────────────────────────
const esm = `/**
 * solari-split-flap v${require('./package.json').version}
 * A physically accurate split-flap (Solari board) display.
 * MIT License
 */
${jsCore}

export { SolariBoard, generateTheme, THEMES as themes, DEFAULT_QUOTES as defaultQuotes };
export default SolariBoard;
`;

fs.writeFileSync(path.join(distDir, 'solari.esm.js'), esm, 'utf8');

console.log('Built:');
console.log('  dist/solari.js     (UMD)  ' + (fs.statSync(path.join(distDir, 'solari.js')).size / 1024).toFixed(1) + ' KB');
console.log('  dist/solari.esm.js (ESM)  ' + (fs.statSync(path.join(distDir, 'solari.esm.js')).size / 1024).toFixed(1) + ' KB');
