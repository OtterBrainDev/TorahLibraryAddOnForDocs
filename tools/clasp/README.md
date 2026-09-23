# Pinned clasp, and automatic deploys

[`clasp`](https://github.com/google/clasp) uploads `apps-script/` to an Apps
Script project. It is **development and deployment tooling only**: nothing in
this folder is pushed to Apps Script (clasp pushes `rootDir: apps-script`
only), and nothing here reaches the add-on's users.

It lives in its own folder, with its own lockfile, so that the deploy
workflow installs exactly the versions in `package-lock.json`, each checked
against its integrity hash, with install scripts disabled — that job holds a
Google credential — and so that `npm ci` at the repo root never downloads it.

## Deploying by hand (what you need day to day)

```bash
npm ci --prefix tools/clasp --ignore-scripts   # once per checkout
npx --prefix tools/clasp clasp login           # once per computer; opens a browser
bash pre_clasp_qc.sh apps-script
npx --prefix tools/clasp clasp push            # from the repo root; uses .clasp.json
```

A globally installed `clasp` (2.x or 3.x) works the same way if you already
have one. `clasp push` replaces the script project's HEAD — what you see
through **Deploy → Test deployments** in your development document. It never
reaches Marketplace users; see `docs/marketplace-listing.md` §6.

## Automatic deploys from GitHub (optional)

`.github/workflows/deploy.yml` can do the `clasp push` for you on every push to
`master`, after the tests and QC pass. It is **off** in any repository that has
not set it up (the workflow is skipped), so nothing breaks if you never do
this. To turn it on in a repository:

1. **Log in once with clasp** on your computer (see above), as a Google
   account that can edit the Apps Script project. This writes
   `~/.clasprc.json`. Either clasp 2 or clasp 3 is fine.

   That file is a long-lived credential for the account: treat it like a
   password. Ideally use a Google account that has access to this Apps
   Script project and little else. Revoke it any time at
   <https://myaccount.google.com/permissions> (look for "Google Apps Script
   clasp"), then log in again and update the secret.

2. **Copy the file as base64:**

   | System | Command |
   | --- | --- |
   | macOS | `base64 -i ~/.clasprc.json \| pbcopy` |
   | Linux | `base64 -w0 ~/.clasprc.json` (then copy the output) |
   | Windows (PowerShell) | `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\.clasprc.json")) \| Set-Clipboard` |

3. **Add the secret.** On GitHub, open the repository → **Settings** →
   **Secrets and variables** → **Actions** → **Secrets** tab → **New
   repository secret**. Name: `CLASP_TOKEN`. Value: paste.

4. **Add the variable.** Same page → **Variables** tab → **New repository
   variable**. Name: `CLASP_SCRIPT_ID`. Value: the script ID of the project to
   push to — from `.clasp.json`, or the Apps Script editor → ⚙ **Project
   Settings** → **IDs** → **Script ID**.

5. **Check it.** **Actions** tab → **Deploy to Apps Script** → **Run
   workflow** (or push to `master`). The *Select the target script project*
   step of the run's log shows which script ID it pushed to.

Each repository points at its own project: the fork you develop in can push
to your development project while the publishing repository pushes to the
published one. The workflow's jobs use a GitHub environment called
`apps-script-production`, which GitHub creates on the first run; under
**Settings → Environments** you can require an approval before each deploy.

## Changing the clasp version

```bash
cd tools/clasp
npm install --package-lock-only --ignore-scripts @google/clasp@<version>
```

Commit `package.json` and `package-lock.json` together. The workflow runs
clasp 2 commands (`clasp push -f`); check them before moving to clasp 3.
