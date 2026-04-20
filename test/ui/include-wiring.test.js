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
