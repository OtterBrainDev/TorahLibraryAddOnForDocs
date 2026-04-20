const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile, readContract, selectorExists } = require('./test-utils');

const contracts = readContract('test/ui/contracts/selector-contracts.json');

Object.entries(contracts).forEach(([pageName, config]) => {
  test(`selector contract: ${pageName}`, () => {
    const html = readAppScriptFile(config.template);

    config.requiredSelectors.forEach((selector) => {
      assert.ok(
        selectorExists(html, selector),
        `Missing selector "${selector}" in ${config.template}`
      );
    });
  });
});
