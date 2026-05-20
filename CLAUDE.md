# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Upstream context

For tech stack, spec-kit workflow, and the upstream MMGIS architecture, see AGENTS.md.

@AGENTS.md

The notes below cover what AGENTS.md doesn't: this checkout's actual runtime setup and the Frozon-specific customizations.

## Runtime setup (this checkout)

Despite AGENTS.md's "Local development uses hot-reloading" note, this checkout actually runs the app as a **baked Docker image** (`ghcr.io/nasa-ammos/mmgis:development`). Local source edits do **not** take effect until they're shipped into the running container.

Containers (project name `mmgis_default` network):

| Container | Host port | Notes |
|---|---|---|
| `mmgis-mmgis-1` | 8889 → 8888 | Main app; bind-mounts `./Missions`, `./ssl`, `~/.azure` |
| `mmgis-db-1` | dynamic → 5432 | Postgres + PgStac |
| `mmgis-stac-api` | 8881 | STAC sidecar — needs DNS alias `stac-fastapi` on the network |
| `mmgis-titiler-pgstac` | 8884 | Tile sidecar — needs DNS alias `titiler-pgstac` on the network |

Mission URL: `http://localhost:8889/?mission=frozon_ai_forecast`

`adjacent-servers/adjacent-servers-proxy.js` (in the mmgis container) hardcodes `http://stac-fastapi:8881` and `http://titiler-pgstac:8884` as proxy targets. If the sidecars are missing those network aliases, `/stac/*` and `/titilerpgstac/*` proxies return 504. Re-add with:

```sh
docker network disconnect mmgis_default mmgis-stac-api && \
docker network connect --alias stac-fastapi mmgis_default mmgis-stac-api
```

Container's Python (rasterio, pypgstac) is at `/opt/micromamba/envs/mmgis/bin/python3` — `PATH` doesn't include it.

## Shipping changes into the running container

- **Backend JS** (`API/Backend/...`): `docker cp <local> mmgis-mmgis-1:/usr/src/app/<path>` → `docker restart mmgis-mmgis-1`. Express caches compiled pug views in production, so a restart is required even when only `build/index.pug` changes.
- **Frontend**: `npm run build` (~3 min on host) → `docker cp build/. mmgis-mmgis-1:/usr/src/app/build/` → `docker restart mmgis-mmgis-1`. Browser needs a hard refresh (Cmd+Shift+R) since `index.html` references the new bundle hash.
- **`.env`**: Compose's `env_file` only applies at container *creation*, not on `docker restart`. To pick up a new env var on an existing container: `docker cp .env mmgis-mmgis-1:/usr/src/app/.env` then restart — `provider.js` calls `require("dotenv").config()` and will re-read.

Webpack mangles names; grepping the built bundle for source identifiers won't match. Search for stable strings (CSS class names, error text, URLs) instead.

## Frozon Copilot (custom plugin, not upstream)

This checkout has a non-upstream "MMGIS Copilot" feature. Two halves communicating over `POST /api/agent`:

**Backend — `API/Backend/Agent/`**
- `provider.js` — `planWithProvider(message, context)`. Tries Azure first if its env is set; falls back to Gemini on any error. Returns `{actions, reply, citations}` after parsing the model's JSON output. The system prompt (with examples for each tool) is in `buildPrompt(...)`.
- `azureService.js` — `@azure/ai-agents` `AgentsClient` + `DefaultAzureCredential`. The credential's token is cached in `sharedClient` for the Node process lifetime — **always restart the container after `az login`** for a token refresh.
- `geminiService.js` — direct REST to `generativelanguage.googleapis.com` for `GEMINI_MODEL` (default `gemini-3-flash-preview`). Reads `GEMINI_API_KEY` from env.
- `tool-registry.json` — flat list of agent tools loaded once at startup; `tools/*.json` are per-tool source files but the registry is the authoritative loaded file. Adding/removing a tool requires editing this and restarting.
- `routes/agent.js` — mounts `POST /api/agent`, `GET /api/agent/tools`, `GET /api/agent/layer-info`, and the analytics endpoint `/api/agent/analytics/difference` (computes pixel-wise diff between two STAC-collection layers using `geotiff`).

**Frontend — `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/`**
- `AgentChatTool.js` — chat panel + the topbar Copilot (robot icon) button. Sends `POST /api/agent` with `{message, context, history}` (last 12 turns).
- `renderers.js` — dispatch table mapping each tool's `execution.ui.type` (from the registry) to a `render_*` function. Renderers run in the browser and can manipulate `L_`, `Map_`, `TimeUI`, `LayersTool`, `LegendTool`, and `window.mmgisAPI` directly.

**Adding a Copilot tool** — three locations must agree:
1. `tool-registry.json` entry with a unique `name` and an `execution.ui.type`.
2. `renderers.js` exports `render_<X>` and registers it in the `RENDERERS` map under the matching `ui.type` key.
3. `provider.js` `buildPrompt(...)` quick-reference — without an example, the LLM tends to say "I don't have a tool for that" even when one exists.

After backend changes: restart container. After frontend changes: rebuild bundle, copy into container, restart, hard-refresh.

## Frozon mission data

- Mission name `frozon_ai_forecast`; `missionFolderName` is `frozon` (these differ — DB uses `mission='frozon_ai_forecast'`, files live under `Missions/frozon/`).
- Layers use STAC collections served via `titiler-pgstac`: `forecast-7day-PRED`, `forecast-7day-GRND`, `forecast-7day-DIFF`.
- Source TIFs at `Missions/frozon/Layers/forecast-7day-{PRED,GRND,DIFF}/NSIDC_SICONC_AI_{PRED,GRND,DIFF}_YYYYMMDD.tif`.
- Tile expression is `(asset_b1*100)` — in-tile values are 0–100 (% sea ice fraction × 100). Diff layer uses `rdbu_r` colormap, default rescale `[-50, 50]`.
- Mission configs are versioned rows in the `configs` table (`mission` + `version`). `/api/configure/get?mission=X` returns the highest-version row. **Insert a new version** to update — don't UPDATE in place (history preserved, easy rollback).

## Footgun: STAC `layer.url` is not prefixed at runtime

For `sourceType: "stac-collection"` layers, the runtime `L_.layers.data[name].url` is the bare collection name (e.g. `"forecast-7day-DIFF"`), **not** prefixed with `"stac-collection:"`. `LayersTool.populateCogScale` early-returns when the URL lacks that prefix. When calling it programmatically (e.g. from a Copilot renderer that just changed `currentCogMin`/`Max`), prefix transiently and restore in a `finally`.
