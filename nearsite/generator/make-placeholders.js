#!/usr/bin/env node
/* make-placeholders.js — creates SVG stand-ins for logos, hero images and
 * gallery photos so the demo build renders completely.
 *
 * Real listings should use WebP files at the same paths (set "logo" and
 * "heroImage" in providers.json). Existing files are never overwritten. */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var providers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'providers.json'), 'utf8'));

function write(file, content) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

/* SVG is XML: an unescaped & or < in a label makes the whole file invalid
   and the browser silently refuses to render it. */
function xml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name) {
  return name.replace(/&/g, '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); }).join('');
}

function logoSvg(p) {
  var t = p.theme || {};
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="' + xml(p.name) + ' logo">' +
    '<rect width="128" height="128" rx="30" fill="' + (t.primary || '#2b2a63') + '"/>' +
    '<circle cx="98" cy="30" r="11" fill="' + (t.accent || '#dfa72c') + '"/>' +
    '<text x="64" y="82" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="44" font-weight="600" letter-spacing="1" fill="#ffffff">' +
    initials(p.name) + '</text></svg>\n';
}

/* Soft duotone stand-in: a calm gradient with organic shapes in the
   business's own colours. Replace with real WebP photography. */
function sceneSvg(p, w, h, seed, label) {
  var t = p.theme || {};
  var primary = t.primary || '#12483a';
  var accent = t.accent || '#dfa72c';
  var id = 'g' + Math.abs(hash(p.slug + seed)) % 99999;
  var r1 = Math.round(h * (0.55 + (seed % 3) * 0.07));
  var r2 = Math.round(h * (0.3 + (seed % 2) * 0.06));
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + xml(label) + '">' +
    '<defs>' +
      '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="' + primary + '"/>' +
        '<stop offset="100%" stop-color="' + shade(primary, -22) + '"/>' +
      '</linearGradient>' +
      '<clipPath id="c' + id + '"><rect width="' + w + '" height="' + h + '"/></clipPath>' +
    '</defs>' +
    '<g clip-path="url(#c' + id + ')">' +
      '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + ')"/>' +
      '<circle cx="' + Math.round(w * 0.2) + '" cy="' + Math.round(h * 0.95) + '" r="' + r1 + '" fill="#ffffff" opacity="0.07"/>' +
      '<circle cx="' + Math.round(w * 0.78) + '" cy="' + Math.round(h * 0.3) + '" r="' + r2 + '" fill="' + accent + '" opacity="0.9"/>' +
      '<circle cx="' + Math.round(w * 0.78) + '" cy="' + Math.round(h * 0.3) + '" r="' + Math.round(r2 * 0.62) + '" fill="' + shade(accent, 18) + '" opacity="0.55"/>' +
      '<path d="M0 ' + Math.round(h * 0.78) + ' Q ' + Math.round(w * 0.35) + ' ' + Math.round(h * 0.6) + ' ' +
        w + ' ' + Math.round(h * 0.86) + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z" fill="#ffffff" opacity="0.09"/>' +
    '</g></svg>\n';
}

function hash(str) {
  var out = 0;
  for (var i = 0; i < str.length; i++) out = (out * 31 + str.charCodeAt(i)) | 0;
  return out;
}

function shade(hex, amount) {
  var n = parseInt(hex.replace('#', ''), 16);
  var parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
    return Math.max(0, Math.min(255, v + Math.round(255 * amount / 100)));
  });
  return '#' + parts.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
}

var created = 0;
providers.forEach(function (p) {
  var dir = path.join(ROOT, 'assets', 'providers', p.slug);
  if (write(path.join(dir, 'logo.svg'), logoSvg(p))) created++;
  if (write(path.join(dir, 'hero.svg'), sceneSvg(p, 760, 500, 1, p.name + ' hero image placeholder'))) created++;
  (p.gallery || []).forEach(function (g, i) {
    if (write(path.join(dir, g.file), sceneSvg(p, 480, 360, i + 2, g.alt))) created++;
  });
});

/* portal marks */
if (write(path.join(ROOT, 'assets', 'icons', 'favicon.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="12" fill="#2b2a63"/>' +
  '<rect x="16" y="16" width="14" height="14" rx="3" fill="#f2c744"/>' +
  '<rect x="34" y="16" width="14" height="14" rx="3" fill="#ffffff" opacity="0.7"/>' +
  '<rect x="16" y="34" width="14" height="14" rx="3" fill="#ffffff" opacity="0.7"/>' +
  '<rect x="34" y="34" width="14" height="14" rx="3" fill="#ffffff" opacity="0.4"/></svg>\n')) created++;

if (write(path.join(ROOT, 'assets', 'icons', 'logo.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64">' +
  '<rect x="0" y="24" width="16" height="16" rx="4" fill="#2b2a63"/>' +
  '<text x="28" y="42" font-family="Helvetica,Arial,sans-serif" font-size="28" font-weight="700" fill="#191833">Nearsite</text></svg>\n')) created++;

if (write(path.join(ROOT, 'assets', 'og-default.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">' +
  '<rect width="1200" height="630" fill="#2b2a63"/>' +
  '<rect x="80" y="250" width="40" height="40" rx="8" fill="#f2c744"/>' +
  '<text x="140" y="285" font-family="Helvetica,Arial,sans-serif" font-size="52" font-weight="700" fill="#ffffff">Nearsite</text>' +
  '<text x="80" y="370" font-family="Helvetica,Arial,sans-serif" font-size="34" fill="#d9d8ee">Find local businesses that show their work.</text></svg>\n')) created++;

console.log('Placeholder assets created: ' + created);
