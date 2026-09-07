// Pins sanitizeSourceHtml (apps-script/shared/ui/dom.html).
//
// Sefaria's library texts are rendered as HTML, not escaped, because footnotes
// and emphasis are the point of the preview. Their server-side allowlist also
// permits <img src> and <a href>, so a text could name a third-party host and
// the reader's browser would fetch it — leaking their IP and the fact that they
// opened that passage. The add-on's privacy policy states it contacts no host
// other than sefaria.org; these tests are what keep that literally true.
//
// Two directions matter equally:
//   1. Nothing that loads a subresource or executes survives.
//   2. Everything Sefaria uses for typography DOES survive. A sanitizer that
//      eats <b> and footnote markup would "pass" a security test and ruin the
//      feature.
//
// Loaded with vm.runInContext; .html script bodies are not Node modules.
// See AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const DOM_PARTIAL = path.resolve(__dirname, '../../apps-script/shared/ui/dom.html');

// Node has no DOMParser, so `linkedom` provides one as a devDependency. It is
// the ONLY dependency in the repo and it is test-only — the add-on itself ships
// no packages (see AGENTS.md: Apps Script has no module loader). The behavioural
// tests skip rather than fail if it is ever missing, so a fresh checkout that
// has not run `npm ci` still gets the policy tests and the fallback test.
let DOMParserImpl = null;
try {
  // eslint-disable-next-line global-require
  DOMParserImpl = require('linkedom').DOMParser;
} catch (error) {
  DOMParserImpl = null;
}

function load({ withDomParser = true } = {}) {
  const html = fs.readFileSync(DOM_PARTIAL, 'utf8');
  const body = html.replace(/^[\s\S]*?<script>/, '').replace(/<\/script>[\s\S]*$/, '');
  const context = { console };
  if (withDomParser && DOMParserImpl) {
    context.DOMParser = DOMParserImpl;
  }
  vm.createContext(context);
  vm.runInContext(body, context, { filename: 'dom.html' });
  return context;
}

// ---------------------------------------------------------------------------
// Policy tests — these run everywhere, with or without a DOM parser.
//
// The security-relevant decision is WHICH elements and attributes are removed.
// That policy is a plain list, so it can be asserted directly without parsing
// HTML. The behavioural tests further down exercise the DOM path when a parser
// is available; these make sure the rules themselves cannot be quietly
// narrowed in the meantime.
// ---------------------------------------------------------------------------

function readPolicy() {
  const html = fs.readFileSync(DOM_PARTIAL, 'utf8');
  const context = {};
  vm.createContext(context);
  const elements = html.match(/var SANITIZE_DROP_ELEMENTS_ = \[[\s\S]*?\.join\(','\);/);
  const attributes = html.match(/var SANITIZE_DROP_ATTRIBUTES_ = \[[\s\S]*?\];/);
  assert.ok(elements, 'expected SANITIZE_DROP_ELEMENTS_ in dom.html');
  assert.ok(attributes, 'expected SANITIZE_DROP_ATTRIBUTES_ in dom.html');
  vm.runInContext(elements[0] + '\n' + attributes[0], context);
  return {
    elements: String(context.SANITIZE_DROP_ELEMENTS_).split(','),
    attributes: Array.from(context.SANITIZE_DROP_ATTRIBUTES_),
  };
}

test('policy: every element that can fetch a subresource or execute is dropped', () => {
  const { elements } = readPolicy();

  // img and svg are the ones that matter most here: Sefaria's own allowlist
  // permits <img src>, so this is the reachable case, not a theoretical one.
  ['img', 'script', 'iframe', 'object', 'embed', 'link', 'svg', 'video', 'audio', 'source']
    .forEach((tag) => {
      assert.ok(elements.includes(tag), `${tag} must be in the drop list`);
    });
});

test('policy: URL-bearing attributes are dropped', () => {
  const { attributes } = readPolicy();

  ['src', 'href', 'srcset', 'formaction', 'background', 'poster', 'style']
    .forEach((attribute) => {
      assert.ok(attributes.includes(attribute), `${attribute} must be in the drop list`);
    });
});

test('policy: the typography Sefaria relies on is NOT dropped', () => {
  const { elements } = readPolicy();

  // A sanitizer that ate these would pass every security assertion above and
  // still destroy the feature. Footnotes are <sup>/<i class="footnote">.
  ['b', 'i', 'em', 'strong', 'sup', 'sub', 'span', 'br', 'small', 'big', 'u']
    .forEach((tag) => {
      assert.ok(!elements.includes(tag), `${tag} must NOT be dropped`);
    });
});

test('falls back to escaped plain text when DOMParser is unavailable', () => {
  const { sanitizeSourceHtml } = load({ withDomParser: false });

  const out = sanitizeSourceHtml('<b>bold</b> and <img src="https://evil.example/p.png">');

  // No markup at all, and nothing left that could be re-parsed as a tag.
  assert.ok(!/</.test(out.replace(/&lt;/g, '')), `unexpected markup in ${out}`);
  assert.ok(out.includes('bold'));
  assert.ok(!out.includes('evil.example'));
});

const describeDom = DOMParserImpl ? test : test.skip;

describeDom('strips elements that fetch a subresource or execute', () => {
  const { sanitizeSourceHtml } = load();

  const cases = [
    '<img src="https://evil.example/pixel.png">',
    '<script>window.x=1</script>',
    '<iframe src="https://evil.example"></iframe>',
    '<object data="https://evil.example/x.swf"></object>',
    '<link rel="stylesheet" href="https://evil.example/x.css">',
    '<svg><use href="https://evil.example/x.svg"></use></svg>',
  ];

  cases.forEach((input) => {
    const out = sanitizeSourceHtml(`before ${input} after`);
    assert.ok(!out.includes('evil.example'), `leaked a URL for ${input}: ${out}`);
    assert.ok(!/<(img|script|iframe|object|link|svg)\b/i.test(out), `kept a tag for ${input}: ${out}`);
    assert.ok(out.includes('before') && out.includes('after'), `lost text for ${input}: ${out}`);
  });
});

describeDom('keeps the markup Sefaria actually uses for typography', () => {
  const { sanitizeSourceHtml } = load();

  // The Steinsaltz pattern: bolded Talmud text against interpolated commentary,
  // plus a footnote marker.
  const input =
    '<b>ואמר לו</b> the Gemara explains ' +
    '<i class="footnote">a note</i><sup class="footnote-marker">1</sup> ' +
    '<span dir="rtl">רש"י</span><br><em>emph</em><strong>strong</strong>';

  const out = sanitizeSourceHtml(input);

  ['<b>', '<i', '<sup', '<span', '<br', '<em>', '<strong>'].forEach((tag) => {
    assert.ok(out.includes(tag), `expected ${tag} to survive: ${out}`);
  });
  // Class and dir carry meaning (footnote styling, RTL runs) and must survive.
  assert.ok(out.includes('footnote'), 'lost the footnote class');
  assert.ok(out.includes('dir="rtl"') || out.includes("dir='rtl'"), 'lost dir');
});

describeDom('unwraps anchors, keeping the words and dropping the destination', () => {
  const { sanitizeSourceHtml } = load();

  const out = sanitizeSourceHtml('see <a href="https://evil.example">Rashi here</a> now');

  assert.ok(out.includes('Rashi here'), `lost the link text: ${out}`);
  assert.ok(!out.includes('evil.example'), `kept the href: ${out}`);
  assert.ok(!/<a\b/i.test(out), `kept the anchor: ${out}`);
});

describeDom('keeps an image alt text rather than silently dropping the content', () => {
  const { sanitizeSourceHtml } = load();

  const out = sanitizeSourceHtml('<img src="https://evil.example/f.png" alt="Figure 1">');

  assert.ok(out.includes('Figure 1'), `lost alt text: ${out}`);
  assert.ok(!out.includes('evil.example'));
});

describeDom('removes event-handler and URL-bearing attributes from surviving tags', () => {
  const { sanitizeSourceHtml } = load();

  const out = sanitizeSourceHtml(
    '<span onclick="steal()" onmouseover="x()" style="background:url(https://evil.example/p)">t</span>'
  );

  assert.ok(!/onclick/i.test(out), `kept onclick: ${out}`);
  assert.ok(!/onmouseover/i.test(out), `kept onmouseover: ${out}`);
  assert.ok(!/evil\.example/.test(out), `kept a URL in style: ${out}`);
  assert.ok(out.includes('t'), 'lost the text');
});

describeDom('handles empty and non-string input', () => {
  const { sanitizeSourceHtml } = load();

  assert.equal(sanitizeSourceHtml(''), '');
  assert.equal(sanitizeSourceHtml(null), '');
  assert.equal(sanitizeSourceHtml(undefined), '');
});

describeDom('a stray </body> cannot smuggle an element past the sweep', () => {
  const { sanitizeSourceHtml } = load();

  // Content is wrapped in <body> before parsing so the parse is deterministic
  // across DOM implementations. That wrapper is closeable from inside the
  // input, which could hoist later nodes out of body — so the strip runs over
  // the whole document, and the output is read from body alone.
  const out = sanitizeSourceHtml('ok</body><img src="https://evil.example/p.png"><script>x=1</script>');

  assert.ok(!out.includes('evil.example'), `leaked a URL: ${out}`);
  assert.ok(!/<(img|script)\b/i.test(out), `kept a tag: ${out}`);
  assert.ok(out.includes('ok'), `lost the real text: ${out}`);
});

describeDom('an empty parse result is not mistaken for successful sanitizing', () => {
  const { sanitizeSourceHtml } = load();

  // The failure that motivated the wrapper: a parser that drops a bare fragment
  // returns an empty document, and every "did it strip X?" assertion passes
  // trivially while the content is simply gone. Non-empty input must survive.
  const out = sanitizeSourceHtml('plain text with <b>emphasis</b>');

  assert.ok(out.includes('plain text'), `content was discarded: ${out}`);
  assert.ok(out.includes('<b>'), `formatting was discarded: ${out}`);
});
