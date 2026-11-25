// Exercise the shared card's real keyboard bindings and state updates. This
// catches focus lost into a closed style menu, accidental selection on Escape,
// and the Texts controls reaching the independent Voices menu.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readAppScriptFile } = require('./test-utils');

let parseHTML = null;
try { parseHTML = require('linkedom').parseHTML; } catch (_) {}
const needsDom = { skip: !parseHTML && 'linkedom not installed' };
const MARKUP = readAppScriptFile('shared/composition-card/markup.html');
const OPTIONS = readAppScriptFile('shared/insertion-options/markup.html');
const SCRIPT = readAppScriptFile('shared/composition-card/shared.html').replace(/<\/?script>/g, '');

function harness() {
  const { document, window } = parseHTML(`<html><body><div id="composition-card-container" data-cc-features="linkedTitle">${OPTIONS}${MARKUP}</div>
    <div id="voices-translit-menu"><button class="cc-translit-option" data-value="traditional">Voice choice</button></div></body></html>`);
  let focused = null;
  Object.defineProperty(document, 'activeElement', { get: () => focused });
  window.HTMLElement.prototype.focus = function () { focused = this; };
  const bindings = new WeakMap();
  function $(selector) {
    const nodes = typeof selector === 'string' ? [...document.querySelectorAll(selector)]
      : selector ? [selector] : [];
    const api = {
      length: nodes.length,
      each(fn) { nodes.forEach((node, i) => fn.call(node, i, node)); return api; },
      find(inner) { return collection(nodes.flatMap((node) => [...node.querySelectorAll(inner)])); },
      closest(inner) { return collection(nodes.map((node) => node.closest && node.closest(inner)).filter(Boolean)); },
      attr(key, value) {
        if (value === undefined) return nodes[0] ? nodes[0].getAttribute(key) : undefined;
        nodes.forEach((node) => node.setAttribute(key, value)); return api;
      },
      prop(key, value) { if (value === undefined) return nodes[0] && nodes[0][key]; nodes.forEach((node) => { node[key] = value; }); return api; },
      text(value) { if (value === undefined) return nodes[0] ? nodes[0].textContent : ''; nodes.forEach((node) => { node.textContent = value; }); return api; },
      toggleClass(name, on) { nodes.forEach((node) => node.classList.toggle(name, on)); return api; },
      addClass(name) { nodes.forEach((node) => node.classList.add(name)); return api; },
      removeClass(name) { nodes.forEach((node) => node.classList.remove(name)); return api; },
      hasClass(name) { return !!nodes[0] && nodes[0].classList.contains(name); },
      hide() { nodes.forEach((node) => { node.style.display = 'none'; }); return api; },
      is(selector) { return selector === ':visible' && !!nodes[0] && !nodes[0].hidden && nodes[0].style.display !== 'none'; },
      off(eventName) {
        nodes.forEach((node) => {
          const registered = bindings.get(node) || [];
          registered.filter((item) => item.name === eventName).forEach((item) => node.removeEventListener(item.type, item.fn));
          bindings.set(node, registered.filter((item) => item.name !== eventName));
        });
        return api;
      },
      on(eventName, fn) {
        nodes.forEach((node) => {
          const type = eventName.split('.')[0];
          // jQuery binds `this` to the subscribed element, including when an
          // event bubbles up from a listbox option to the menu.
          const listener = (event) => fn.call(node, event);
          node.addEventListener(type, listener);
          const registered = bindings.get(node) || [];
          registered.push({ name: eventName, type, fn: listener }); bindings.set(node, registered);
        });
        return api;
      }
    };
    nodes.forEach((node, index) => { api[index] = node; });
    return api;
  }
  // Preserve DOM nodes and event bindings when a selector returns several.
  function collection(nodes) {
    if (nodes.length === 1) return $(nodes[0]);
    const api = $(null);
    api.length = nodes.length;
    api.each = function (fn) { nodes.forEach((node, i) => fn.call(node, i, node)); return api; };
    api.prop = function (key, value) { nodes.forEach((node) => { node[key] = value; }); return api; };
    nodes.forEach((node, i) => { api[i] = node; });
    return api;
  }
  const changes = [];
  const state = { transliterationOn: true, scheme: 'traditional', vowelsMode: 'always', cantillationMode: 'tanakh', notesMode: 'omit' };
  const context = vm.createContext({ document, window, $ });
  vm.runInContext(SCRIPT, context);
  context.initCompositionCard({
    getState: () => ({ ...state }),
    onToggle: (key) => { changes.push([key]); if (key === 'translit') state.transliterationOn = !state.transliterationOn; },
    onChoice: (key, value) => { changes.push([key, value]); state[key === 'vowels' ? 'vowelsMode' : key === 'notes' ? 'notesMode' : key] = value; },
    onSchemeSelect: (value) => { changes.push(['scheme', value]); state.scheme = value; state.transliterationOn = value !== 'none'; }
  });
  const get = (selector) => document.querySelector(selector);
  function key(node, keyName, extra = {}) {
    const event = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.assign(event, { key: keyName }, extra);
    node.dispatchEvent(event);
    return event;
  }
  return { document, context, get, key, changes, state };
}

test('segmented choices have one tab stop and arrow keys choose through the normal handler', needsDom, () => {
  const h = harness();
  const group = h.get('#cc-vowels-toggle');
  assert.deepEqual([...group.children].map((button) => button.getAttribute('tabindex')), ['-1', '-1', '0']);
  const initial = group.querySelector('[aria-checked="true"]');
  initial.focus();
  assert.equal(h.key(initial, 'ArrowRight').defaultPrevented, true);
  assert.equal(h.document.activeElement.getAttribute('data-value'), 'never');
  assert.equal(h.state.vowelsMode, 'never');
  assert.deepEqual(h.changes, [['vowels', 'never']]);
  assert.equal(group.querySelector('[tabindex="0"]').getAttribute('aria-checked'), 'true');
  h.key(h.document.activeElement, 'End');
  assert.equal(h.state.vowelsMode, 'always');
  h.key(h.document.activeElement, 'ArrowLeft');
  assert.equal(h.state.vowelsMode, 'tanakh');
  assert.equal(h.key(h.document.activeElement, 'ArrowLeft', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(h.state.vowelsMode, 'tanakh');
});

test('transliteration opens on its selected option and keyboard navigation waits for selection', needsDom, () => {
  const h = harness();
  const trigger = h.get('#cc-translit-toggle');
  assert.equal(trigger.getAttribute('aria-label'), 'Transliteration style: Traditional');
  h.key(trigger, 'ArrowDown');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(h.document.activeElement.getAttribute('data-value'), 'traditional');
  assert.equal(h.document.activeElement.getAttribute('role'), 'option');
  h.key(h.document.activeElement, 'ArrowDown');
  assert.equal(h.document.activeElement.getAttribute('data-value'), 'modern_israeli');
  assert.equal(h.state.scheme, 'traditional');
  assert.deepEqual(h.changes, []);
  h.key(h.document.activeElement, 'Enter');
  assert.equal(h.state.scheme, 'modern_israeli');
  assert.equal(h.get('#cc-translit-menu [aria-selected="true"]').getAttribute('data-value'), 'modern_israeli');
  assert.equal(h.document.activeElement, trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(h.changes, [['scheme', 'modern_israeli']]);
});

test('Escape closes only the transliteration menu and restores the trigger without changing a value', needsDom, () => {
  const h = harness();
  let outerEscape = 0;
  h.document.addEventListener('keydown', (event) => { if (event.key === 'Escape') outerEscape++; });
  h.get('#cc-translit-toggle').click();
  h.key(h.document.activeElement, 'End');
  assert.equal(h.document.activeElement.getAttribute('data-value'), 'ipa_tiberian');
  assert.equal(h.key(h.document.activeElement, 'Escape').defaultPrevented, true);
  assert.equal(outerEscape, 0);
  assert.equal(h.document.activeElement, h.get('#cc-translit-toggle'));
  assert.equal(h.get('#cc-translit-menu').classList.contains('hidden'), true);
  assert.deepEqual(h.changes, []);
});

test('choosing None returns focus to the transliteration switch because Style becomes hidden', needsDom, () => {
  const h = harness();
  h.get('#cc-translit-toggle').click();
  h.key(h.document.activeElement, 'Home');
  assert.equal(h.document.activeElement.getAttribute('data-value'), 'none');
  h.key(h.document.activeElement, ' ');
  assert.equal(h.state.transliterationOn, false);
  assert.equal(h.get('#cc-translit-scheme-row').hidden, true);
  assert.equal(h.document.activeElement, h.get('#cc-translit-pill'));
  assert.deepEqual(h.changes, [['scheme', 'none']]);
});

test('Tab dismisses the style menu without consuming browser navigation or committing a choice', needsDom, () => {
  const h = harness();
  h.get('#cc-translit-toggle').click();
  h.key(h.document.activeElement, 'ArrowDown');
  const event = h.key(h.document.activeElement, 'Tab');
  assert.equal(event.defaultPrevented, false);
  assert.equal(h.document.activeElement, h.get('#cc-translit-toggle'));
  assert.equal(h.get('#cc-translit-menu').classList.contains('hidden'), true);
  assert.deepEqual(h.changes, []);
});

test('composition keyboard bindings do not reach the independent Voices transliteration choices', needsDom, () => {
  const h = harness();
  const voice = h.get('#voices-translit-menu .cc-translit-option');
  voice.focus();
  h.key(voice, 'ArrowDown');
  voice.click();
  assert.equal(h.document.activeElement, voice);
  assert.equal(voice.hasAttribute('aria-selected'), false);
  assert.deepEqual(h.changes, []);
});
