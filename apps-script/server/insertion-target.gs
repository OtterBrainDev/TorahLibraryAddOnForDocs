// Where an insert goes: the cursor or selection, resolved to a container (the
// document body, or a table cell) and a child index inside it.
//
// Every insert path (texts, multi-translation, source sheets, lexicon, the
// linker's per-row insert, Insert from Selection) goes through
// resolveInsertionTarget_. They used to compute
// `cursor.getElement().getParent().getChildIndex(el) + 1` and then insert into
// the BODY at that index. That index was relative to whatever the parent was
// (a table cell, a header, the paragraph holding a Text element), so an insert
// from inside a table landed at an unrelated place in the body, and said
// nothing. See docs/regression-log.md.
//
// Rules:
// - In the body: insert after the block holding the cursor.
// - In a table cell: paragraph layouts (one language, Hebrew on top, several
//   translations, sheets, lexicon) go inside the cell, after the cursor's
//   paragraph. A side-by-side layout is itself a table; rather than nest a
//   table in a cell, it goes directly below the table, and the result carries
//   a `notice` saying so, for the caller to show.
// - In a header, footer or footnote: refused with a message. Nothing about a
//   source belongs repeated on every page, and "below" has no meaning there.
//
// The walk only uses getType / getParent / getChildIndex / getNumChildren, so
// it runs against fakes in test/tests/insertion-target.test.js.

var INSERT_BELOW_TABLE_NOTICE_ =
  'Inserted below the table: side-by-side layouts are themselves tables, and ' +
  'Google Docs can’t nest one cleanly inside a cell. To insert inside the ' +
  'cell, choose one language or the Stacked layout.';

var INSERT_UNSUPPORTED_LOCATION_MESSAGE_ =
  'Sources can’t be inserted into a header, footer or footnote. Click in ' +
  'the main text of the document, then try again.';

var INSERT_SELECTION_KEPT_NOTICE_ =
  'Your selection spans more than one table cell, so it was kept and the ' +
  'source was inserted below the table.';

/**
 * Walk up from `element` to the document body.
 *
 * @returns {{where: 'body'|'cell'|'other', bodyBlock: ?Object, cell: ?Object, cellBlock: ?Object}}
 *   bodyBlock: the direct child of the body that contains the element (for a
 *              cell, the outermost table). cell / cellBlock: the innermost table
 *              cell holding the element, and its direct child that does.
 */
function locateInsertionElement_(element) {
  var types = DocumentApp.ElementType;
  if (!element) return { where: 'other', bodyBlock: null, cell: null, cellBlock: null };

  var node = element;
  var cell = null;
  var cellBlock = null;
  while (node && node.getParent) {
    var parent = node.getParent();
    if (!parent) break;
    var parentType = parent.getType();
    if (parentType === types.TABLE_CELL && !cell) {
      cell = parent;
      cellBlock = node;
    }
    if (parentType === types.BODY_SECTION) {
      return { where: cell ? 'cell' : 'body', bodyBlock: node, cell: cell, cellBlock: cellBlock };
    }
    node = parent;
  }
  return { where: 'other', bodyBlock: null, cell: null, cellBlock: null };
}

/**
 * Resolve where an insert goes.
 *
 * @param {Object} opts
 *   layout:            'paragraphs' (default) or 'table' — whether the insert
 *                      creates a table of its own.
 *   replaceSelection:  delete the selected text before inserting (Insert
 *                      Source from Selection). Otherwise a selection is kept
 *                      and the insert goes after it.
 * @returns {{container: Object, index: number, notice: string}}
 */
function resolveInsertionTarget_(opts) {
  var options = opts || {};
  var wantsTable = options.layout === 'table';
  var document = DocumentApp.getActiveDocument();
  var body = document.getBody();
  var cursor = (!options.anchor && document.getCursor) ? document.getCursor() : null;
  var selection = (!options.anchor && !cursor && document.getSelection) ? document.getSelection() : null;

  var afterBody = function (block, notice) {
    return { container: body, index: body.getChildIndex(block) + 1, notice: notice || '' };
  };
  var place = function (located) {
    if (located.where === 'other') {
      throw new Error(INSERT_UNSUPPORTED_LOCATION_MESSAGE_);
    }
    if (located.where === 'cell') {
      if (wantsTable) return afterBody(located.bodyBlock, INSERT_BELOW_TABLE_NOTICE_);
      return { container: located.cell, index: located.cell.getChildIndex(located.cellBlock) + 1, notice: '' };
    }
    return afterBody(located.bodyBlock);
  };

  // An explicit anchor (the linker's per-row insert: the paragraph holding the
  // citation) wins over the user's cursor and selection, which it never moves.
  if (options.anchor) {
    return place(locateInsertionElement_(options.anchor));
  }

  if (cursor) {
    var element = cursor.getElement();
    // An empty body can report the body itself, with the offset as a child index.
    if (element && element.getType() === DocumentApp.ElementType.BODY_SECTION) {
      return { container: body, index: Math.min(cursor.getOffset(), body.getNumChildren()), notice: '' };
    }
    return place(locateInsertionElement_(element));
  }

  var rangeElements = selection ? selection.getRangeElements() : [];
  if (!rangeElements || !rangeElements.length) {
    return { container: body, index: body.getNumChildren(), notice: '' };
  }

  var first = locateInsertionElement_(rangeElements[0].getElement());
  var last = locateInsertionElement_(rangeElements[rangeElements.length - 1].getElement());
  if (first.where === 'other' || last.where === 'other') {
    throw new Error(INSERT_UNSUPPORTED_LOCATION_MESSAGE_);
  }

  var sameCell = first.where === 'cell' && last.where === 'cell' && sameElement_(first.cell, last.cell);
  var touchesTable = first.where === 'cell' || last.where === 'cell';

  // A selection across cells (or from a cell out into the body) is never
  // deleted: clearing several cells is not what "replace the citation" means.
  if (touchesTable && !sameCell) {
    return afterBody(last.bodyBlock, options.replaceSelection ? INSERT_SELECTION_KEPT_NOTICE_ : '');
  }

  if (options.replaceSelection) {
    return replaceSelectionAndLocate_(body, rangeElements, first, wantsTable);
  }

  // Keep the selection: insert after its last block.
  if (sameCell) {
    if (wantsTable) return afterBody(last.bodyBlock, INSERT_BELOW_TABLE_NOTICE_);
    return { container: last.cell, index: last.cell.getChildIndex(last.cellBlock) + 1, notice: '' };
  }
  return afterBody(last.bodyBlock);
}

/**
 * Apps Script hands out a fresh proxy for each getParent() call, so two
 * references to one element are not ===. Compare by position instead.
 */
function sameElement_(a, b) {
  if (a === b) return true;
  try {
    var pa = a.getParent();
    var pb = b.getParent();
    if (!pa || !pb) return false;
    return pa.getChildIndex(a) === pb.getChildIndex(b) && sameElement_(pa, pb);
  } catch (error) {
    return false;
  }
}

/**
 * Delete the selected text (Insert Source from Selection's default), then
 * return where the source goes: where the first selected block was.
 */
function replaceSelectionAndLocate_(body, rangeElements, first, wantsTable) {
  var types = DocumentApp.ElementType;
  var inCell = first.where === 'cell';
  var container = inCell ? first.cell : body;
  var anchor = inCell ? first.cellBlock : first.bodyBlock;
  var index = container.getChildIndex(anchor) + 1;

  for (var i = rangeElements.length - 1; i >= 0; i--) {
    var re = rangeElements[i];
    var el = re.getElement();
    try {
      var type = el.getType();
      if (re.isPartial()) {
        if (type === types.TEXT) {
          var start = re.getStartOffset();
          var end = re.getEndOffsetInclusive();
          if (start >= 0 && end >= start) el.asText().deleteText(start, end);
        }
      } else if (type === types.TEXT) {
        var text = el.asText().getText();
        if (text.length > 0) el.asText().deleteText(0, text.length - 1);
      } else if (type === types.PARAGRAPH || type === types.LIST_ITEM) {
        var parent = el.getParent();
        // Remove a whole selected paragraph from the body (keeping at least
        // one child); in a cell, only empty it, so the cell never loses its
        // last paragraph.
        if (!inCell && parent && parent.getType() === types.BODY_SECTION && body.getNumChildren() > 1) {
          var elIndex = body.getChildIndex(el);
          el.removeFromParent();
          if (elIndex < index) index--;
        } else {
          el.clear();
        }
      }
    } catch (error) {
      // Skip anything that cannot be deleted.
    }
  }

  if (inCell && wantsTable) {
    return { container: body, index: body.getChildIndex(first.bodyBlock) + 1, notice: INSERT_BELOW_TABLE_NOTICE_ };
  }
  return { container: container, index: Math.max(0, index), notice: '' };
}
