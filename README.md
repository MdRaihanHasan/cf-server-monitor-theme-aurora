<h1 align="center">Aurora Theme for CF Server Monitor</h1>

<p align="center">A clean, English, currency-free dashboard theme for CF Server Monitor, built with Vue 3 + Vite + reka-ui + Tailwind CSS v4.</p>

<p align="center"><b>Created by RYN</b></p>

> Aurora is an independent re-skin inspired by the Emerald theme. The whole UI is in English, all price / currency / exchange-rate features have been removed, and the accent palette is a cool teal → cyan ("aurora").

## Features

- Card and table views for nodes
- Grouping, search, region flags and OS icons
- CPU, memory, disk, traffic, network and Ping history charts
- World map of node distribution with online / offline scatter and counts
- Realtime updates over WebSocket with automatic reconnect
- Single-backend Turnstile verification
- Dark, light and system-follow theme modes
- No currency, price, billing value or exchange-rate UI anywhere

## Theme settings

Copy and adjust the parameters below, paste them into the `Theme custom configuration JSON` field on the **CF Server Monitor** backend settings page, and save.

```json
{
  "configuration": [
    {
      "key": "defaultThemeMode",
      "value": "auto",
      "options": "auto,light,dark",
      "description": "Default theme mode for visitors: auto follows the system, light, or dark (a manual toggle takes precedence afterwards)"
    },
    {
      "key": "defaultViewMode",
      "value": "card",
      "options": "card,list",
      "description": "Default node list display mode"
    },
    {
      "key": "alertEnabled",
      "value": "false",
      "options": "",
      "description": "Show a custom announcement on the home page"
    },
    {
      "key": "alertTitle",
      "value": "",
      "options": "",
      "description": "Announcement title"
    },
    {
      "key": "alertContent",
      "value": "",
      "options": "",
      "description": "Announcement body (supports simple Markdown)"
    },
    {
      "key": "earthViewMode",
      "value": "maps",
      "options": "earth,earth-stop,maps,cards,hide",
      "description": "earth: spinning globe; earth-stop: static globe; maps: dotted map; cards: header cards only; hide: hide the whole header"
    },
    {
      "key": "visitorInfoCardEnabled",
      "value": "true",
      "options": "",
      "description": "Show the visitor source / device / browser info card"
    },
    {
      "key": "hideAdminEntryWhenLoggedOut",
      "value": "false",
      "options": "",
      "description": "Hide the admin button in the header"
    },
    {
      "key": "disablePageAnimation",
      "value": "false",
      "options": "",
      "description": "Reduce page transition animations for faster, snappier navigation"
    },
    {
      "key": "offlineNodesLast",
      "value": "false",
      "options": "",
      "description": "When enabled, offline nodes are sorted to the end of the list"
    },
    {
      "key": "icpEnabled",
      "value": "false",
      "options": "",
      "description": "Show a site filing/registration number in the footer (optional)"
    },
    {
      "key": "icpNumber",
      "value": "",
      "options": "",
      "description": "Footer filing/registration number"
    },
    {
      "key": "icpUrl",
      "value": "",
      "options": "",
      "description": "Link opened when the filing number is clicked"
    },
    {
      "key": "policeEnabled",
      "value": "false",
      "options": "",
      "description": "Show a second footer registration line (optional)"
    },
    {
      "key": "policeNumber",
      "value": "",
      "options": "",
      "description": "Second footer registration number"
    },
    {
      "key": "policeUrl",
      "value": "",
      "options": "",
      "description": "Link opened when the second registration number is clicked; leave empty for no link"
    },
    {
      "key": "backgroundEnabled",
      "value": "false",
      "options": "",
      "description": "Enable a custom image or video page background"
    },
    {
      "key": "backgroundType",
      "value": "image",
      "options": "image,video",
      "description": "Background type: image or video"
    },
    {
      "key": "lightBackgroundUrl",
      "value": "",
      "options": "",
      "description": "Background image/video URL for light mode"
    },
    {
      "key": "darkBackgroundUrl",
      "value": "",
      "options": "",
      "description": "Background image/video URL for dark mode"
    },
    {
      "key": "backgroundBlur",
      "value": "0",
      "options": "",
      "description": "Gaussian blur radius of the background in px; 0 means no blur"
    },
    {
      "key": "backgroundOverlay",
      "value": "0",
      "options": "",
      "description": "Background overlay strength (-100 to 100): negative lowers background opacity, 0 is off, positive adds a black overlay; larger absolute values are stronger"
    }
  ]
}
```

## Development

```bash
npm install
cp .env.example .env   # or create .env manually (see below)
npm run dev
```

Example `.env`:

```dotenv
API_BASE=https://monitor.example.com
BASE_PATH=./
```

`API_BASE` accepts multiple Workers separated by commas. In dev mode, same-origin `/api` requests are proxied to a single `API_BASE` to avoid local CORS issues.

In production this deploys same-origin: a web server (e.g. Nginx) or Cloudflare Worker serves the static `dist/` files and reverse-proxies `/api`, `/flags`, `/os-icons` and `/api/ws` to the CF Server Monitor Worker.

## Build

```bash
npm run lint
npm run build
npm run preview
```

Custom domains and static hosts usually keep `BASE_PATH=./`.

## Using this theme with your CF Server Monitor fork

There are two common ways to serve a custom theme. Pick one:

**A. Third-party theme URL (no rebuild of the monitor needed)**

1. Push this `cf-server-monitor-theme-aurora` folder to a GitHub repo of your own.
2. Run `npm install && npm run build` and commit the generated `dist/` (or let a GitHub Action build it — see `.github/workflows/`).
3. In the CF Server Monitor admin panel, open **Appearance → Theme** and point it at the theme repo's built tree (the backend proxies the theme's `index.html` and `assets/`).
4. If assets are blocked, add the theme host to the **CSP static** allowlist in the admin panel.

**B. Bake it into your fork (self-hosted, single origin)**

1. Build the theme: `npm run build` → produces `dist/`.
2. Copy the contents of `dist/` into your fork's static output so the Worker serves them (replace the built-in dashboard assets), then redeploy the Worker.
3. Because it is same-origin, no extra CORS/CSP changes are needed.

For a purely static deployment (GitHub Pages / Nginx) hitting a remote Worker, set `CORS_ALLOWED_ORIGINS` on the backend to your static site's origin.

### Theme development docs

- [CF-Server-Monitor project](https://github.com/huilang-me/CF-Server-Monitor)
- [Backend API reference](https://github.com/huilang-me/CF-Server-Monitor/blob/main/API.md)

## Runtime conventions

- Routes: `/#/`, `/#/server/:id`
- Admin entry: `${origin}#/admin`
- The backend is the current page origin (same-origin deployment)
- Anonymous visitors can query up to the last 24h of history; logged-in users with long history enabled can query up to the last 7 days

## Credits

- [Tokinx/komari-theme-emerald](https://github.com/Tokinx/komari-theme-emerald) and [Tokinx/cf-server-monitor-theme-emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) — the Emerald theme this re-skin is based on
- [huilang-me/CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)

## License

[MIT](./LICENSE)
