# Contributing to LiftOff

Thanks for wanting to help. Pull requests are open to everyone.

## Before you write code

- **Open an issue first** for anything beyond a typo or a small bug fix, and wait for a reply. This avoids work on a feature that does not fit the plugin.
- **One change per pull request.** Small pull requests get reviewed faster.

## Setup

You need Node.js 25 (see `.nvmrc`).

```sh
git clone https://github.com/<your-username>/obsidian-liftoff.git
cd obsidian-liftoff
npm ci
npm run dev
```

`npm run dev` rebuilds `main.js` on every change. To try the plugin, open the `test-vault/` folder as a vault in Obsidian, or copy `main.js`, `manifest.json` and `styles.css` into `.obsidian/plugins/liftoff/` in a vault of your own.

## Checks

CI runs these three commands on every pull request. Run them locally first:

```sh
npm run lint
npm test
npm run build
```

## What a good pull request looks like

- It links the issue it solves (`Closes #123`).
- It adds or updates tests in `tests/` for any changed logic.
- It works on a phone. LiftOff is mobile first, so check narrow widths and touch targets.
- It keeps saved workout notes compatible. Notes written by older versions must still load.
- It adds no new runtime dependency without discussing it in the issue first. Dependencies are bundled into `main.js` and ship to every user's vault.
- It does not change `manifest.json`, `versions.json`, the version in `package.json`, or `CHANGELOG.md`. The maintainer does that at release time.
- It includes a screenshot or short recording for any visible change.

## Review and releases

The maintainer reviews and merges all pull requests and cuts all releases. A merged change ships in the next release, not immediately.

## License

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
