import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const heatIndexRoot = resolve(repositoryRoot, 'heat-index');
const [app, guidePage, guideSource] = await Promise.all([
  readFile(resolve(heatIndexRoot, 'index.html'), 'utf8'),
  readFile(resolve(heatIndexRoot, 'guide.html'), 'utf8'),
  readFile(resolve(heatIndexRoot, 'guide-content.js'), 'utf8'),
]);

function createMockElement() {
  return {
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
  };
}

const sandbox = {
  document: { createElement: createMockElement },
  window: {},
};
vm.runInNewContext(guideSource, sandbox, { filename: 'guide-content.js' });
const sections = sandbox.window.HEAT_INDEX_GUIDE;
if (!Array.isArray(sections) || sections.length === 0) {
  throw new Error('The shared heat-index guide must contain at least one section.');
}

const documentedControls = new Set();
for (const section of sections) {
  if (
    !section.title ||
    !section.description ||
    !Array.isArray(section.steps) ||
    section.steps.length === 0 ||
    !Array.isArray(section.controls)
  ) {
    throw new Error(`Guide section "${section.title ?? '(untitled)'}" needs a title, description, and steps.`);
  }
  for (const control of section.controls) {
    if (documentedControls.has(control)) {
      throw new Error(`Guide control "${control}" is listed more than once.`);
    }
    documentedControls.add(control);
  }
}

const controlsInApp = new Set();
const interactiveTags = [
  ...app.matchAll(/<(?:button|input|select|textarea)\b[^>]*>/gi),
  ...app.matchAll(/<a\b(?=[^>]*\bhref=["']tel:)[^>]*>/gi),
];
for (const [tag] of interactiveTags) {
  const marker = tag.match(/\bdata-guide-control=["']([^"']+)["']/i)?.[1];
  if (!marker) throw new Error(`Interactive app control is missing data-guide-control: ${tag}`);
  controlsInApp.add(marker);
}

for (const marker of app.matchAll(/\bdata-guide-control=["']([^"']+)["']/gi)) {
  const control = marker[1];
  if (!documentedControls.has(control)) {
    throw new Error(`App control "${control}" is not documented in guide-content.js.`);
  }
  controlsInApp.add(control);
}
for (const control of documentedControls) {
  if (!controlsInApp.has(control)) {
    throw new Error(`Guide control "${control}" does not exist in the app.`);
  }
}

if (!app.includes('src="./guide-content.js"') || !guidePage.includes('src="./guide-content.js"')) {
  throw new Error('Both the dashboard and printable guide must use the shared guide-content.js source.');
}
if (!guidePage.includes('window.print()') || !guidePage.includes('id="guide-content"')) {
  throw new Error('The printable guide needs a print action and a guide content container.');
}

const renderedGuide = createMockElement();
sandbox.window.renderHeatIndexGuide(renderedGuide);
if (renderedGuide.children.length !== sections.length) {
  throw new Error('The shared guide renderer did not render every guide section.');
}

console.log(`Validated ${sections.length} guide sections and ${controlsInApp.size} documented interactive controls.`);
