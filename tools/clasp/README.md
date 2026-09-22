# Pinned clasp

[`clasp`](https://github.com/google/clasp) uploads `apps-script/` to an Apps
Script project. It is **development and deployment tooling only**: nothing in
this folder is pushed to Apps Script (clasp pushes `rootDir: apps-script`
only), and nothing here reaches the add-on's users.

It lives in its own folder, with its own lockfile, so that:

- the deploy workflow installs exactly the versions in
  `package-lock.json`, each checked against its integrity hash, with install
  scripts disabled. That job holds the `CLASP_TOKEN` credential, so nothing
  in it should be resolved fresh from the registry;
- the test job and `npm ci` at the repo root never download clasp.

## Using it locally

```bash
npm ci --prefix tools/clasp --ignore-scripts
npx --prefix tools/clasp clasp login     # once
npx --prefix tools/clasp clasp push      # from the repo root; uses .clasp.json
```

A globally installed `clasp` 2.x works the same way if you prefer it.

## Changing the version

The deploy workflow converts a clasp 3 credential file into clasp 2's
`.clasprc.json` shape, so moving to clasp 3 means changing that step too.
To update within 2.x:

```bash
cd tools/clasp
npm install --package-lock-only --ignore-scripts @google/clasp@<version>
```

Commit `package.json` and `package-lock.json` together.
