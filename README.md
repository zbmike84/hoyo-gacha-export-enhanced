# HoYo Gacha Export (enhanced)

Genshin Impact, Honkai: Star Rail and Zenless Zone Zero gacha history in one app: fetch and
export the records (Excel, UIGF) as the original tools do, plus an analysis view per game:

- every 5★ / S-rank judged against the banner it came from (won / lost / guaranteed), with
  pity, guarantee and Capturing Radiance state;
- luck tiers (5★ speed, 50/50, full pity twice, worst/best banner), pulls per rate-up;
- 5★ history grouped by banner, with cross-banner guarantees marked;
- limited characters with constellation / eidolon / mindscape and the pulls each cost.

Based on [biuuu/genshin-wish-export](https://github.com/biuuu/genshin-wish-export),
[biuuu/star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export) and
[earthjasonlin/zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) (MIT).

## Builds and releases

- Every push to `dev` builds a Windows zip as a workflow artifact (`.github/workflows/build.yml`).
- Pushing a tag `vX.Y.Z` that matches `package.json` publishes a GitHub Release with the zip and its
  SHA-256 (`.github/workflows/release.yml`). The zip is portable: unzip anywhere, including a NAS
  share. It is unsigned, so browsers and SmartScreen may warn about it.

## Layout

- `src/main/` – app shell: window, IPC namespace (`<game>:<CHANNEL>`), legacy data migration,
  shared vendor modules (proxy, Excel).
- `src/renderer/` – shell UI: game tabs.
- `src/games/<genshin|starrail|zzz>/` – each game's main-process modules, UI, translations and
  banner data, kept close to the upstream projects.
- `scripts/<game>/` – banner data generators; `test/<game>/` – unit tests (`yarn test`).

Data lives next to the app in `userData/<game>/`. On first start, data from the old single-game
apps in sibling folders (`Genshin-Wish-Export`, `StarRailWarpExport`, `ZzzSignalSearchExport`) is
copied over; the old folders are not changed.

## Banner data and assets

- Genshin: [MadeBaruna/paimon-moe](https://github.com/MadeBaruna/paimon-moe) (MIT), generated into
  `src/games/genshin/data/banners.json`.
- Star Rail: [sirarikako/PolyxiaBannerData](https://github.com/sirarikako/PolyxiaBannerData) (CC0); a snapshot
  ships in `src/games/starrail/data/` (`scripts/starrail/update-banners.mjs`) and the app refreshes it at runtime.
- ZZZ: [quantulr/hoyo-gacha](https://github.com/quantulr/hoyo-gacha) (MIT), from BWIKI.
- Icons are downloaded at runtime (paimon-moe, Mar-7th/StarRailRes, Enka) and are not part of
  this repository; they are HoYoverse assets.
