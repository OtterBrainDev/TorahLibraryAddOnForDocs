const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile, readContract } = require('./test-utils');

const contracts = readContract('test/ui/contracts/js-contracts.json');

Object.entries(contracts).forEach(([scriptFile, requiredTokens]) => {
  test(`js contract: ${scriptFile}`, () => {
    const jsPartial = readAppScriptFile(scriptFile);

    requiredTokens.forEach((token) => {
      assert.ok(
        jsPartial.includes(token),
        `Expected ${scriptFile} to include token: ${token}`
      );
    });
  });
});
