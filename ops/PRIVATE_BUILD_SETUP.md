# KeepIt private build template

**Not active in this public repository.** When the owner creates a separate private repository `kdg-007/keepit-build-private`, this workflow belongs at `.github/workflows/build-keepit.yml` in that private repository.

The private workflow accepts one reviewed source ZIP at `source/KeepIt-GitHub-QA.zip`, compiles KeepIt using GitHub Actions and publishes only `dist/` files.

Without `KEEPIT_PAGES_TOKEN`, it produces an internal compiled artifact but **does not publish**. For fully automatic publishing, the owner must configure a fine-grained GitHub personal access token in that private repository's Actions secrets, granting **Contents: read/write** only on `kdg-007/kdg-007.github.io`. Never paste the token into chat, an issue, or source code.

It is not an alternative to Microsoft authentication setup. The QA callback `https://kdg-007.github.io/auth/callback/` still requires registration as a SPA redirect in Microsoft Entra. Publishing must never be interpreted as cloud synchronization or iPhone acceptance.

This template is maintained here only so the connected GitHub tool can install it in the private repository without asking the user to write YAML or use Terminal. The full KeepIt source must never be committed to the public Pages repository.
