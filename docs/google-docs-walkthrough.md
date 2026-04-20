# Using the Torah Library Add-On for Google Docs

This guide walks through the current forked version of the Torah Library Add-On for Google Docs.

> This is not an official Sefaria project.

## What this add-on does

The add-on helps you:

- find a source by reference, title, nested path, phrase, or Sefaria URL
- preview the result before inserting it
- insert Source, Translation, or Source with Translation into Google Docs
- control layout and Hebrew formatting
- link inserted or existing references to Sefaria
- apply typography and divine-name preferences

## Open the add-on

From Google Docs, open the add-on menu and choose:

- **Find & Insert Source**

This opens the unified sidebar.

## Find a source

In the search box, you can enter:

- a reference like `Genesis 1:1`
- a tractate reference like `Berakhot 2a`
- a nested/library path
- a phrase
- a Sefaria URL

Results are grouped into:

- **Library matches**
- **Search results**

Select a result to preview it.

## Choose how the source should appear

The add-on supports three display modes:

- **Source**
- **Translation**
- **Source with Translation**

If you choose **Source with Translation**, you can also choose a bilingual layout:

- **Hebrew on top**
- **Hebrew left**
- **Hebrew right**

## Hebrew formatting controls

The sidebar includes visible Hebrew controls for:

- **Vowels**
- **Cantillation**

Use these to change how Hebrew text appears in preview and insertion.

## Translation versions

When Translation is involved, you can:

- filter translation versions
- choose a translation
- optionally include translation details

## Insert links

The add-on supports:

- **Insert Sefaria link** when inserting a source
- **Open on Sefaria** for the selected result
- **Link Texts with Sefaria** to add hyperlinks to recognizable references already in the document

## Preferences

The Preferences dialog lets you configure defaults such as:

- Hebrew font
- Hebrew font size
- Translation font
- Translation font size
- divine-name transformations
- Hebrew orthography settings

These preferences are persisted and used during insertion.

## Divine-name workflow

The add-on includes:

- insertion-time divine-name transformations
- a quick **Transform Divine Names** menu action for existing document text

If no divine-name transforms are configured, the add-on will prompt you accordingly.

## Structural / non-insertable nodes

Some library hits are structural nodes rather than directly insertable text.

In these cases, the sidebar will:

- show a warning/explanation
- keep Insert disabled
- encourage choosing a more specific subsection or opening the result on Sefaria

## Link existing references in a document

Use the menu action:

- **Link Texts with Sefaria**

This scans the current Google Doc and attempts to hyperlink recognizable references to their corresponding Sefaria pages.

## Worked example

A worked example Google Doc is available here:

- [Worked example Google Doc](PASTE_GOOGLE_DOC_LINK_HERE)

## Changelog

For a summary of major fork enhancements, see:

- [CHANGELOG.md](./CHANGELOG.md)

## Current limitations

- Hebrew misspelling tolerance is deferred; valid Hebrew-script references are supported, but typo correction is not implemented.
- Some matching/linking behavior remains intentionally conservative to avoid false positives.
- Google Docs sidebar width and layout behavior remain subject to Apps Script platform constraints.