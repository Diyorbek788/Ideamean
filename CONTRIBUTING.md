# Contributing to NetLog Brief

Try the bundled example first. Compatibility reports are most useful when they name the browser major version and the expected and observed report fields. Attach the generated Markdown or a small synthetic JSON fixture with the same event structure. Keep raw work and personal captures on your device.

## Reproduce a change

1. Add a focused fixture or test for the affected reporting behavior. Preserve the `netlog-brief/v1` shape or document a schema change.
2. Run `npm test` with Node.js 22 or newer.
3. Run `npm run build` and `npm run check:build`. Open `index.html` to check the two languages and compare exports.
4. If Chromium is installed, run `npm run test:chromium`. To use Chrome or another Chromium binary, set `CHROMIUM_BIN` to its executable path. This test generates two captures against a temporary loopback server, checks the HTTP status buckets, and verifies that the test URL marker is absent from the exported result.

Start with a focused pull request that explains the reproduced issue and how you verified the change.
