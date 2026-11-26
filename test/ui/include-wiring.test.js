const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile, readContract } = require('./test-utils');

const contract = readContract('test/ui/contracts/include-wiring.contract.json');

Object.entries(contract).forEach(([templateFile, requiredSnippets]) => {
  test(`include wiring: ${templateFile}`, () => {
    const html = readAppScriptFile(templateFile);

    requiredSnippets.forEach((snippet) => {
      assert.ok(
        html.includes(snippet),
        `Expected ${templateFile} to include snippet: ${snippet}`
      );
    });
  });
});


test('sidebar startup follows every JavaScript partial so early server replies can initialize the controls', () => {
  const html = readAppScriptFile('sidebar.html');
  const includes = Array.from(html.matchAll(/include\('([^']+)'\)/g), (match) => match[1]);
  assert.equal(includes.at(-1), 'sidebar/js/bootstrap');
});
