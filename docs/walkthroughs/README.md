# Walkthroughs

Five walkthroughs of the same add-on, written for five audiences. Each is a
script to follow live in a real Google Doc — what to click, what to say, what
should happen.

| # | Walkthrough | Audience | Length | Goal |
| --- | --- | --- | --- | --- |
| 1 | [Stress test](1-stress-test.md) | QA, the maintainer before release | 2–3 h | Try to break it. Surface every unexpected behaviour before Sefaria sees it. |
| 2 | [Under the hood](2-developer.md) | Developers, Sefaria engineers | 45–60 min | What happens on the server and client for every user action. |
| 3 | [Power user tour](3-advanced-user.md) | People who write source sheets and shiurim in Docs every week | 25–30 min | The features that save real time once you know them. |
| 4 | [Coming from version 1.0](4-returning-user.md) | People who use version 1.0 of *Sefaria for Google Docs* | 15 min | Where its three commands went, what's new, and what behaves differently. |
| 5 | [First five minutes](5-new-user.md) | Someone who has never used it | 5 min | Get one source into a document. |

The version under demo is **2.0.0, preference schema 33** (`docs/VERSION.json`
and the v2.0.0 entry in `docs/CHANGELOG.md`).
*Help & Support → About* should read **Current line: 2.0**.

**Status:** these scripts have been reconciled with the current source,
including Texts v3, edition persistence, Commentary and Notes, the grouped
sidebar and keyboard controls. They are not a record of a completed live
demonstration or a video. The new Google Docs checks in the
[live test checklist](../live-test-checklist-2.0.0.md) remain pending;
record the deployed commit and observed results there before a launch demo.

## Before any live session

1. **Use test accounts, not your own.** At least one account that has never
   installed the add-on (walkthroughs 3–5 look best on a clean install; a
   clean install opens first-run setup, which walkthrough 5 starts with). The
   stress test needs three; see its setup section.
2. **Make a fresh copy of the demo document for each run.** Several steps
   rewrite the document (Link Texts, Insert from Selection, Transform Divine
   Names). The contents are below.
3. **Keep the browser console open** (<kbd>F12</kbd>) during 1 and 2. Script
   integrity, CSP and `google.script.run` failures only show there.
4. **Check that sefaria.org is up.** Every feature except Preferences calls it.
5. Zoom the browser to 110–125 % if you are screen-sharing. The sidebar is
   300 px wide.
6. **Record the test deployment's commit.** About's release line does not
   establish which HEAD a test deployment runs. A passing Node suite or live
   Sefaria API check does not prove Google Docs insertion or browser layout.

## Shared demo document

Paste this into a new Google Doc titled *Sefaria for Google Docs demo*. Walkthroughs
2–5 use parts of it. The stress test builds a longer one.

```text
Shiur notes: Creation and Rest

The Torah opens with Genesis 1:1, and the seventh day is described in Genesis 2:1-3.
The Talmud discusses the evening Shema in Berakhot 2a.
Rambam codifies the laws in Hil. Shabbat 1:1.
Compare Psalms 92:1, the psalm for the Sabbath day.
בראשית א:א

Some ordinary prose with no citation in it, so we can see what is and isn't sent to Sefaria.
```

## Keeping these current

These documents describe UI labels and behaviour. When a change renames a
button, moves a preference or changes a default, update the walkthroughs in
the same commit, the same way you would `docs/google-docs-walkthrough.md`.
