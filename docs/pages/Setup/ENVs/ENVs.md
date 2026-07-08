---
layout: page
title: ENVs
permalink: /setup/envs
parent: Setup
nav_order: 2
---

# Environment Variables

Environment variables are set within `MMGIS/.env`. A sample file `MMGIS/sample.env` is provided. On startup, erroneous .env setups are logged.

## Required Variables

#### `SERVER=`

The kind of server running (apache is deprecated) | string enum | default `''`

- _node:_ A node express server running NodeJS v22.20.0+
- _apache (deprecated):_ Served through Apache. Some or all functionality may not work

#### `AUTH=`

The kind of authentication method used | string enum | default `''`

- _off:_ No authentication. Users cannot sign up or log in. Tools that require log in will not work.
- _none:_ No authentication. Users can still sign up and log in from within MMGIS.
- _local:_ Anyone without credentials is blocked. The Admin must log in, create accounts and pass out the credentials or set AUTH_LOCAL_ALLOW_SIGNUP=true.
- _csso:_ Use a Cloud Single Sign On service that's proxied in front of MMGIS.

#### `NODE_ENV=`

Instance type | string enum | default `production`

- _production:_
- _development:_ Shows configure and documentation links on the landing page for convenience

#### `SECRET=`

**Required.** A cryptographically random string used to sign session cookies. This secret ensures that session IDs cannot be forged by attackers.

**Type**: string (minimum 24 characters) | **Default**: None (application will fail to start if not set)

**Important**: This value must be kept confidential. Use a long, random string (e.g., 64+ characters generated with `openssl rand -hex 64` or `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) . Do not use the sample value from `sample.env` in production. If this variable is not set or is shorter than 24 characters, the server will refuse to start.

#### `DB_HOST=`

URL of Postgres database | string | default `null`

**For Docker**: Set to `db` (the service name in docker-compose.yml)  
**For local development**: Set to `localhost`

#### `DB_PORT=`

Port for Postgres database | string | default `5432`

#### `DB_NAME=`

Name of Postgres database | string | default `null`

**For Docker**: Use `mmgis` (matches docker-compose.yml)  
**For local development**: Use your chosen database name

#### `DB_USER=`

User of Postgres database | string | default `null`

**For Docker**: Use `postgres` (matches docker-compose.yml)  
**For local development**: Use your PostgreSQL username

#### `DB_PASS=`

Password of Postgres database | string | default `null`

**For Docker**: Use `postgres` (matches docker-compose.yml)  
**For local development**: Use your PostgreSQL password

> **Note**: The Docker setup in `docker-compose.yml` uses `postgres/postgres/mmgis` as the default credentials. Make sure your `.env` file matches these values when running with Docker.

## Optional Variables

#### `PORT=`

Port to run on | positive integer | default `8888`

#### `HTTPS=`

If true, MMGIS will use an https server with the, now required, `HTTPS_KEY` and `HTTPS_CERT` envs. If false, use a wrapping https proxy server instead and block `PORT` from being public | boolean | false

#### `HTTPS_KEY=`

Relative path to key. If using docker, make sure the key is mounted. Everything under './ssl/' is gitignored and './ssl/' is mounted into docker.

#### `HTTPS_CERT=`

Relative path to cert. If using docker, make sure the cert is mounted. Everything under './ssl/' is gitignored and './ssl/' is mounted into docker.

#### `DB_POOL_MAX=`

Max number connections in the database's pool. CPUs \* 4 is a good number | integer | default `10`

#### `DB_POOL_TIMEOUT=`

How many milliseconds until a DB connection times out | integer | default `30000` (30 sec)

#### `DB_POOL_IDLE=`

How many milliseconds for an incoming connection to wait for a DB connection before getting kicked away | integer | default `10000` (10 sec)

#### `DB_SSL=`

If the Postgres DB instance is enforcing SSL, set to true to have MMGIS connect to it via SSL | boolean | default `false`

#### `DB_SSL_CERT=`

If `DB_SSL=true` and if needed, the path to a certificate for ssl | string | default `null`

#### `DB_SSL_CERT_BASE64=`

Alternatively, if `DB_SSL=true` and if needed, a base64 encoded certificate for ssl. `DB_SSL_CERT_BASE64` will take priority over `DB_SSL_CERT` | string | default `null`

#### `DB_USER_TEST=`

Test-specific database user. Required by test infrastructure (`tests/global-setup.js`, `tests/test-db-clean.js`) for least-privilege separation. No fallback — tests will not run without this | string | default `null`

#### `DB_PASS_TEST=`

Test-specific database password. Required by test infrastructure for least-privilege separation. No fallback — tests will not run without this | string | default `null`

#### `AUTH_LOCAL_ALLOW_SIGNUP=`

If AUTH=local and set to true, this allows all guests to the site to create user accounts otherwise, they just see a login page with no signup section | boolean | default `false`

#### `CSSO_GROUPS=`

A list of CSSO LDAP groups that have access | string[] | default `[]`

#### `VERBOSE_LOGGING=`

Potentially logs a bunch of extra stuff for development purposes | bool | default `false`

#### `FRAME_ANCESTORS=`

Sets the `Content-Security-Policy: frame-ancestors` header to allow the embedding of MMGIS in the specified external sites | string[] | default `null` | ex. FRAME_ANCESTORS='["http://localhost:8888"]'

#### `FRAME_SRC=`

Sets the `Content-Security-Policy: frame-src` header to allow the embedding iframes from external origins into MMGIS | string[] | default `null` | ex. FRAME_SRC='["http://localhost:8888"]'

#### `THIRD_PARTY_COOKIES=`

Sets "SameSite=None; Secure" on the login cookie. Useful when using AUTH=local as an iframe within a cross-origin page. | boolean | default `false`

#### `ROOT_PATH=`

Set MMGIS to be deployed under a subpath. For example if serving at the subpath 'https://{domain}/path/where/I/serve/mmgis' is desired, set `ROOT_PATH=/path/where/I/serve/mmgis`. Should always begin with a `/`. If no subpath, leave blank. | string | default `""`

#### `EXTERNAL_ROOT_PATH=`

Tell MMGIS that it's already deployed under a subpath. For example if already proxying to the subpath 'https://{domain}/path/where/I/serve/mmgis' is desired, set `ROOT_PATH=/path/where/I/serve/mmgis`. This differs from ROOT_PATH in that MMGIS will not place any of it's endpoints under this path but will still query as if it did. Should always begin with a `/`. If `ROOT_PATH` is also set, requests will use `EXTERNAL_ROOT_PATH` + `ROOT_PATH`. If no external subpath, leave blank. | string | default `""`

#### `WEBSOCKET_ROOT_PATH=`

Overrides ROOT_PATH's use when the client connects via websocket. Websocket url: `${ws_protocol}://${window.location.host}${WEBSOCKET_ROOT_PATH || ROOT_PATH || ''}/` | string | default `""`

#### `CLEARANCE_NUMBER=`

Sets a clearance for the website | string | default `CL##-####`

#### `CONTACT_INFO=`

A string of text for contact information on the bottom right corner of the login pages | string | default `None Provided`

#### `LINK_PREVIEW_TITLE=`

Initial HTML page title. When sharing a link to MMGIS in an application that supports link previews, the title to be used | string | default `MMGIS`

#### `LINK_PREVIEW_DESCRIPTION=`

Initial HTML page description. When sharing a link to MMGIS in an application that supports link previews, the description to be used | string | default `A web-based mapping and localization solution for science operation on planetary missions.`

#### `DISABLE_LINK_SHORTENER=`

If true, users that use the 'Copy Link' feature will receive a full-length deep link. Writing new short links will be disabled but expanding existing ones will still work. | bool | default `false`

#### `HIDE_CONFIG=`

Make the configure page inaccessible to everyone | bool | default `false`

#### `FORCE_CONFIG_PATH=`

The path to a json config file that acts as the only configured mission for the instance | string | default `''`

#### `LEADS=`

When not using AUTH=csso, this is a list of usernames to be treated as leads (users with elevated permissions) | string[] | default `[]`

#### `CSSO_LEAD_GROUP=`

LDAP group of leads (users with elevated permissions) | string | default `''`

#### `ENABLE_MMGIS_WEBSOCKETS=`

If true, enables the backend MMGIS websockets to tell clients to update layers | boolean | default `false`

#### `ENABLE_CONFIG_WEBSOCKETS=`

If true, notifications are sent to /configure users whenever the current mission's configuration object changes out from under them and thne puts (overridable) limits on saving | boolean | default `false`

#### `ENABLE_CONFIG_OVERRIDE=`

For use when `ENABLE_CONFIG_WEBSOCKETS=true` (if `ENABLE_CONFIG_WEBSOCKETS=false`, all saves will freely overwrite already). If true, gives /configure users the ability to override changes made to the configuration while they were working on it with their own. | boolean | default `false`

#### `MAIN_MISSION=`

If the new MAIN_MISSION ENV is set to a valid mission, skip the landing page and go straight to that mission. Other missions will still be accessible by either forcing the landing page (clicking the top-left M logo) or by going to a link directly. | string | default `''`

#### `SKIP_CLIENT_INITIAL_LOGIN=`

If true, MMGIS will not auto-login returning users. This can be useful when login is managed someplace else. The initial login process can be manually triggered with `mmgisAPI.initialLogin()` | boolean | default `false`

#### `GENERATE_SOURCEMAP=`

If true at build-time, JavaScript source maps will also be built | boolean | default `false`


#### `SPICE_SCHEDULED_KERNEL_DOWNLOAD=`

If true, then at every other midnight, MMGIS will read /Missions/spice-kernels-conf.json and re/download all the specified kernels. See /Missions/spice-kernels-conf.example.json | boolean | default `false`

#### `SPICE_SCHEDULED_KERNEL_DOWNLOAD_ON_START=`

If true, then also triggers the kernel download when MMGIS starts | boolean | default `false`

#### `SPICE_SCHEDULED_KERNEL_CRON_EXPR=`

A cron schedule expression for use in the [node-schedule npm library](https://www.npmjs.com/package/node-schedule) | string | default `"0 0 */2 * *"` (every other day)

#### `COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS=`

When using composited time tiles, MMGIS queries the tileset's folder for existing time folders. It caches the results of the these folder listings every COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS milliseconds. Defaults to requerying every 30 minutes. If 0, no caching. If null or NaN, uses default. | number | default `1800000`

## Adjacent Servers

Enables and proxies to other self-hosted services. [Additional setup](/MMGIS/setup/adjacent-servers) may be required.

#### `WITH_STAC=`

STAC Catalogs - https://github.com/stac-utils/stac-fastapi-pgstac | default `false`

#### `STAC_PORT=`

Port to proxy stac on | default `8881`

#### `WITH_TIPG=`

TiTiler PG Vectors - https://github.com/developmentseed/tipg | default `false`

#### `TIPG_PORT=`

Port to ruproxyn tipg on | default `8882`

#### `WITH_TITILER=`

TiTiler - https://developmentseed.org/titiler | default `false`

#### `TITILER_PORT=`

Port to proxy titiler on | default `8883`

#### `TITILER_ALLOWED_URL_PATTERNS=`

**Security Feature**: URL validation for TiTiler proxy to prevent Server-Side Request Forgery (SSRF) attacks.

A JSON array of regular expression patterns that define allowed URLs for TiTiler requests. When configured, any URL passed to TiTiler (via `?url=` parameter) must match at least one pattern or the request will be blocked with HTTP 403 Forbidden.

**Format**: JSON array of regex strings | **Type**: string[] | **Default**: `[]` (allow all)

**Behavior**:
- **Unset or empty array `[]`**: Allow all URLs (backward compatible with existing deployments)
- **Non-empty array**: URL must match at least one regex pattern to be proxied
- **Invalid JSON or regex**: Logs error, disables validation (allows all URLs)
- **Important**: To allow TiTiler to read from the local `/Missions` directory, include the file:// pattern in your configuration (see examples below).

**Security Recommendations**:
- Always configure this in production environments
- Use the most restrictive patterns possible for your use case
- Regularly review logs for blocked requests

**Common Patterns**:

1. **Recommended for Production** (HTTPS + local Missions files):
   ```bash
   TITILER_ALLOWED_URL_PATTERNS='["^https://(?!.*\\.\\.)(?!.*\\x00).*$", "^/Missions/(?!.*\\.\\.).*$"]'
   ```
   - Requires HTTPS protocol for remote URLs
   - Allows local `/Missions` directory files as relative paths (e.g., `/Missions/Test/data.tif`)
   - Blocks path traversal (`..`) in both remote and local paths
   - Blocks null byte injection

2. **Specific Trusted Domains**:
   ```bash
   TITILER_ALLOWED_URL_PATTERNS='["^https://tiles\\.example\\.com/.*", "^https://data\\.nasa\\.gov/.*"]'
   ```
   - Only allows specific trusted domains

3. **S3 Buckets**:
   ```bash
   TITILER_ALLOWED_URL_PATTERNS='["^https://[^/]*\\.s3\\.[^/]*\\.amazonaws\\.com/.*"]'
   ```
   - Allows any S3 bucket URL

4. **Multiple Patterns** (OR logic):
   ```bash
   TITILER_ALLOWED_URL_PATTERNS='["^https://tiles\\.example\\.com/.*", "^https://.*\\.s3\\.amazonaws\\.com/.*", "^https://data\\.nasa\\.gov/.*", "^/Missions/.*"]'
   ```
   - URLs matching ANY pattern are allowed
   - Includes local Missions directory access

**Regex Syntax Notes**:
- Use `\\.` to match literal dots (escape backslash in JSON: `\\\\.`)
- Use `.*` to match any characters (zero or more)
- Use `^` to anchor at start, `$` to anchor at end
- Use `(?!...)` for negative lookahead (e.g., block patterns)
- Test patterns before deployment (invalid regex will be logged and skipped)

**Error Response** (when URL blocked):
```json
{
  "error": "Forbidden",
  "message": "The requested URL does not match allowed patterns",
  "detail": "URL parameter must match one of the configured TITILER_ALLOWED_URL_PATTERNS"
}
```

**Logging**: Blocked requests are logged at `warn` level with the blocked URL, request details, and user session for security auditing.

**Note**: Changes to this ENV variable require server restart to take effect.

**See Also**: [Adjacent Servers Security](../Adjacent-Servers/adjacent-servers.md#security)

#### `WITH_TITILER_PGSTAC=`

TiTiler Mosaicking - https://github.com/stac-utils/titiler-pgstac | default `false`

#### `TITILER_PGSTAC_PORT=`

Port to proxy titiler-pgstac on | default `8884`

#### `WITH_VELOSERVER=`

Veloserver - Velocity and Wind Data Visualization Server - https://github.com/NASA-AMMOS/Veloserver | default `false`

#### `VELOSERVER_PORT=`

Port to proxy veloserver on | default `8104`

### Custom Adjacent Servers

Configure your own adjacent servers without modifying core MMGIS code. These environment variables allow you to add custom proxy endpoints that follow the same pattern as the built-in adjacent servers.

#### `ADJACENT_SERVER_CUSTOM_X=`

Custom adjacent server configuration where X is a number (0, 1, 2, etc.) | JSON array | default `null`

**Format:** `["isEnabled", "routeName", "serviceName", "port"]`

**Parameters:**

- `isEnabled` - String "true" or "false" to enable/disable this server
- `routeName` - URL path name (will be accessible at `/routeName`)
- `serviceName` - Docker service name or "localhost" for non-containerized deployments
- `port` - Port number the service runs on

**Examples:**

```bash
ADJACENT_SERVER_CUSTOM_0=["true", "my_api", "my_api_service", "8105"]
ADJACENT_SERVER_CUSTOM_1=["true", "data_service", "data_service_container", "9000"]
ADJACENT_SERVER_CUSTOM_2=["false", "disabled_service", "disabled_service", "8106"]
```

**Access Pattern:**
Custom servers will be accessible at `{ROOT_PATH}/{routeName}` where `ROOT_PATH` is your configured root path (if any) and `routeName` is the route name specified in the configuration.

**Note:**

- Includes standard authentication middleware (allows all GETs, requires admin auth for other methods)

## Aircraft Tracking (OpenSky Network Plugin)

#### `WITH_AIRCRAFT=`

Enable real-time aircraft tracking via OpenSky Network ADS-B data | boolean | default `false`

Set to `true` to activate the Aircraft plugin, which polls the OpenSky Network REST API for live aircraft positions and displays them on the map. Requires no API key (free public access with rate limits).

#### `OPENSKY_BBOX_LAMIN=`

Minimum latitude for OpenSky Network bounding box query | float | default `66.5` (Arctic Circle)

Defines the southern boundary of the geographic area to track aircraft. Default covers the Arctic Circle and above.

#### `OPENSKY_BBOX_LOMIN=`

Minimum longitude for OpenSky Network bounding box query | float | default `-180`

Defines the western boundary of the geographic area to track aircraft.

#### `OPENSKY_BBOX_LAMAX=`

Maximum latitude for OpenSky Network bounding box query | float | default `90` (North Pole)

Defines the northern boundary of the geographic area to track aircraft.

#### `OPENSKY_BBOX_LOMAX=`

Maximum longitude for OpenSky Network bounding box query | float | default `180`

Defines the eastern boundary of the geographic area to track aircraft.

#### `OPENSKY_POLL_INTERVAL=`

Polling interval in milliseconds | integer | default `30000` (30 seconds)

How often to query the OpenSky Network API for updated aircraft positions.

**Note:** OpenSky enforces a daily credit quota (about 400 credits/day anonymously; a global-sized bounding box costs 4 credits per request). Without `OPENSKY_CLIENT_ID`/`OPENSKY_CLIENT_SECRET`, the poll interval is clamped to a minimum of 900000ms (15 minutes) so the quota lasts the whole day. When the quota is exceeded, polling is automatically suspended until the time indicated by OpenSky's rate-limit response.

#### `OPENSKY_CLIENT_ID=`

OpenSky Network OAuth2 client id | string | optional

Register an account at [opensky-network.org](https://opensky-network.org/) and create an API client to obtain OAuth2 client credentials. Authenticated access grants a much higher daily API quota (4000+ credits/day) and allows faster polling intervals.

#### `OPENSKY_CLIENT_SECRET=`

OpenSky Network OAuth2 client secret | string | optional

The client secret paired with `OPENSKY_CLIENT_ID`.

#### `OPENSKY_TTL_MINUTES=`

In-memory cache TTL for aircraft positions in minutes | integer | default `60`

How long to keep aircraft positions in the in-memory cache before considering them stale and removing them.

#### `AIRCRAFT_HISTORY_DAYS=`

Days of aircraft track history to retain in PostgreSQL | integer | default `7`

Number of days of historical aircraft position data to keep in the database for track replay. Set to `0` to disable persistence entirely (in-memory only mode).

**Example Configuration:**

```bash
# Enable aircraft tracking
WITH_AIRCRAFT=true

# Full Arctic Circle coverage (default)
OPENSKY_BBOX_LAMIN=66.5
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90
OPENSKY_BBOX_LOMAX=180

# Poll every 30 seconds (default)
OPENSKY_POLL_INTERVAL=30000

# Keep positions in cache for 1 hour
OPENSKY_TTL_MINUTES=60

# Retain 7 days of track history
AIRCRAFT_HISTORY_DAYS=7
```

**API Reference:**

- OpenSky Network API Documentation: [https://opensky-network.org/apidoc/](https://opensky-network.org/apidoc/)
- Rate Limits: 5 requests per 10 seconds (unauthenticated), 400 requests per day per IP
- Coverage: Global ADS-B data (sparse in polar regions due to limited ground stations)
