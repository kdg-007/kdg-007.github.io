# KeepIt — device QA hosting

This public repository is reserved for the **compiled** KeepIt device-QA website at `https://kdg-007.github.io/`.

**Status: NOT DEPLOYED.** Source code, build fixtures, logs, test documents, Microsoft secrets, and OneDrive files must not be uploaded here.

## Release controls
- Only publish `dist/` contents from the guarded KeepIt GitHub Pages QA build.
- The compiled `build-info.json` must specify `deliveryTarget: "github-pages-qa"` and `protectedOneDriveFolder: "KeepIt-TK02-QA-2026-10-30"`.
- Publish only after the compiled bundle passes its local release integrity verification and has `auth/callback/index.html`.
- GitHub Pages is the static UI host, **not** the document library. Test documents stay in the isolated OneDrive QA folder.
- Never place Microsoft client secrets, authentication tokens, production OneDrive libraries, private files, raw source archives, or development ZIPs into this public repository.
- A passing GitHub Pages deployment does **not** mean Microsoft sign-in, iPhone functionality, or OneDrive data integrity has been tested.

## Deployment sequence
1. Build the guarded KeepIt GitHub Pages candidate from the development ZIP on the Mac. The launcher outputs `KeepIt_GitHub_Pages_COMPILED_QA_SITE.zip`. It does not publish anything.
2. Attach **`KeepIt_GitHub_Pages_COMPILED_QA_SITE.zip`** in a comment on [the controlled device-QA upload issue](https://github.com/kdg-007/kdg-007.github.io/issues/1). Do **not** attach the source ZIP. The owner-only workflow verifies the archive and publishes it without Git commands or a GitHub token on the Mac.
3. Enable GitHub Pages in repository **Settings → Pages**. Choose **GitHub Actions** as the deployment source before uploading the ZIP.
4. In Microsoft app registration add `https://kdg-007.github.io/auth/callback/` as a **Single-page application** redirect URI for the QA client ID, *not* a Web redirect URI.
5. Verify login and saving in the disposable OneDrive folder on both Mac and iPhone. No production-library data.

The workflow under `.github/workflows/keepit-pages.yml` checks compiled QA markers and can deploy from a single verified ZIP attached to issue #1 by account owner `kdg-007`. It can also run for directly pushed compiled files.

This repository is public only because GitHub Pages on GitHub Free requires that arrangement. Do not treat the public website as private access control.
