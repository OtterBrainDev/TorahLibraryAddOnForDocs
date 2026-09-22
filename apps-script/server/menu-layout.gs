/*
Copyright 2026 Austin Swafford
Licensed under the MIT License. See repository LICENSE.md.
*/

// The user-customizable add-on menu ("Menu Bar" tab in Preferences).
//
// Pure helpers only — no DocumentApp calls — so the Node tests can load this
// file on its own. `buildAndInstallMenu` in server/menu.gs is the consumer.
//
// Stored shape (the `menu_layout` preference, a JSON string):
//
//   {
//     "top":           ["texts", "voices", ..., "quick_actions", "-", ...],
//     "quick_actions": ["quick_actions_sidebar", "-", "transform_divine_names", ...]
//   }
//
// "top" is the add-on menu itself; "quick_actions" is the Quick Actions
// submenu, which appears in "top" as the "quick_actions" placeholder. "-" is a
// divider. Preferences and Help & Support are NOT part of the layout: they are
// always appended after a divider, so the user can never lose the way back to
// this very screen.

var MENU_DIVIDER_ = '-';
var MENU_SUBMENU_ID_ = 'quick_actions';

/**
 * Every item the user may place. `fn` is the global server function the menu
 * item runs; it must stay in sync with the functions defined in server/*.gs.
 */
var MENU_LAYOUT_ITEMS_ = {
  texts:                  { label: 'Texts', fn: 'textsHTML' },
  voices:                 { label: 'Voices', fn: 'voicesHTML' },
  lexicon:                { label: 'Lexicon', fn: 'lexiconHTML' },
  insert_from_selection:  { label: 'Insert Source from Selection', fn: 'insertSourceFromSelection' },
  quick_actions_sidebar:  { label: 'Quick Actions Sidebar', fn: 'quickActionsHTML' },
  transform_divine_names: { label: 'Transform Divine Names', fn: 'transformDivineNames' },
  link_texts:             { label: 'Link Texts with Sefaria', fn: 'linkTextsWithSefaria' },
  unlink_sources:         { label: 'Unlink Sources', fn: 'unlinkSefariaSources' },
  gematriya_count:        { label: 'Gematriya Count', fn: 'gematriyaCountPopup' },
  surprise_me:            { label: 'Surprise Me', fn: 'surpriseMeHTML' }
};

var MENU_SUBMENU_LABEL_ = 'Quick Actions';

/**
 * The menu as it shipped before it was customizable. A user who never opens
 * the Menu Bar tab must see exactly this.
 */
function getDefaultMenuLayout_() {
  return {
    top: ['texts', 'voices', 'lexicon', 'insert_from_selection', MENU_SUBMENU_ID_, MENU_DIVIDER_, 'surprise_me'],
    quick_actions: ['quick_actions_sidebar', MENU_DIVIDER_, 'transform_divine_names', 'link_texts', 'unlink_sources', MENU_DIVIDER_, 'gematriya_count']
  };
}

function getDefaultMenuLayoutJson_() {
  return JSON.stringify(getDefaultMenuLayout_());
}

/** Which list an item lives in when a stored layout does not mention it. */
function getDefaultMenuParent_(id) {
  var defaults = getDefaultMenuLayout_();
  return defaults.quick_actions.indexOf(id) >= 0 ? 'quick_actions' : 'top';
}

/**
 * Coerce anything (a stored JSON string, a parsed object, garbage) into a
 * valid layout:
 *   - unknown ids are dropped; the submenu placeholder is only valid in "top";
 *   - every item appears at most once (first occurrence wins);
 *   - an item the layout does not mention — e.g. one added in a later
 *     release — is appended to its default list, so nothing silently vanishes;
 *   - the submenu placeholder is restored if the submenu has items but the
 *     placeholder went missing.
 * Dividers are kept as-is here; collapsing them is a rendering concern.
 */
function normalizeMenuLayout_(raw) {
  var parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.top)) {
    return getDefaultMenuLayout_();
  }

  var seen = {};
  function clean(list, allowSubmenu) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function(id) {
      id = String(id);
      if (id === MENU_DIVIDER_) {
        out.push(id);
        return;
      }
      var known = Object.prototype.hasOwnProperty.call(MENU_LAYOUT_ITEMS_, id) ||
        (allowSubmenu && id === MENU_SUBMENU_ID_);
      if (!known || seen[id]) return;
      seen[id] = true;
      out.push(id);
    });
    return out;
  }

  var layout = {
    top: clean(parsed.top, true),
    quick_actions: clean(parsed.quick_actions, false)
  };

  Object.keys(MENU_LAYOUT_ITEMS_).forEach(function(id) {
    if (!seen[id]) layout[getDefaultMenuParent_(id)].push(id);
  });

  if (!seen[MENU_SUBMENU_ID_] && layout.quick_actions.some(function(id) { return id !== MENU_DIVIDER_; })) {
    layout.top.push(MENU_SUBMENU_ID_);
  }
  return layout;
}

/**
 * Turn a layout into the concrete menu to build. Items that are unavailable
 * right now (Surprise Me while it is switched off) are skipped; dividers are
 * collapsed so no two are adjacent and none leads or trails a list; an empty
 * submenu is left out. Preferences and Help & Support are always appended.
 *
 * @param {*} layout  anything normalizeMenuLayout_ accepts
 * @param {{surpriseMeEnabled: boolean}} availability
 * @return {Array<{type: string}>} entries of type "item" ({label, fn}),
 *   "separator", or "submenu" ({label, entries})
 */
function planMenuFromLayout_(layout, availability) {
  var normalized = normalizeMenuLayout_(layout);
  var surpriseOn = !!(availability && availability.surpriseMeEnabled);

  function isAvailable(id) {
    return id !== 'surprise_me' || surpriseOn;
  }

  function collapse(entries) {
    var out = [];
    entries.forEach(function(entry) {
      if (entry.type === 'separator') {
        if (!out.length || out[out.length - 1].type === 'separator') return;
      }
      out.push(entry);
    });
    while (out.length && out[out.length - 1].type === 'separator') out.pop();
    return out;
  }

  function toEntries(list) {
    var entries = [];
    list.forEach(function(id) {
      if (id === MENU_DIVIDER_) {
        entries.push({ type: 'separator' });
      } else if (id === MENU_SUBMENU_ID_) {
        var children = collapse(toEntries(normalized.quick_actions));
        if (children.length) {
          entries.push({ type: 'submenu', label: MENU_SUBMENU_LABEL_, entries: children });
        }
      } else if (isAvailable(id)) {
        var item = MENU_LAYOUT_ITEMS_[id];
        entries.push({ type: 'item', label: item.label, fn: item.fn });
      }
    });
    return entries;
  }

  var top = toEntries(normalized.top);
  top.push({ type: 'separator' });
  top.push({ type: 'item', label: 'Preferences', fn: 'preferencesPopup' });
  top.push({ type: 'item', label: 'Help & Support', fn: 'openHelpModal' });
  return collapse(top);
}

/**
 * What the Preferences dialog needs to draw the Menu Bar editor: item labels
 * and the default layout (for "Restore default menu").
 */
function getMenuLayoutEditorConfig_(devFlags) {
  var items = {};
  Object.keys(MENU_LAYOUT_ITEMS_).forEach(function(id) {
    if (id === 'surprise_me' && !(devFlags && devFlags.SURPRISE_ME)) return;
    items[id] = { label: MENU_LAYOUT_ITEMS_[id].label };
  });
  return {
    items: items,
    submenuLabel: MENU_SUBMENU_LABEL_,
    defaultLayout: getDefaultMenuLayout_()
  };
}
