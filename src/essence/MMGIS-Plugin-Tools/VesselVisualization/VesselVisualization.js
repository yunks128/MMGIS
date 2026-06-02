/**
 * Vessel Visualization Plugin
 *
 * Provides rich popups and track visualization for the live AIS vessel layer.
 * Works with the backend Vessels plugin API at /api/vessels/*.
 *
 * Features:
 * - Rich popups with vessel metadata (name, MMSI, flag, speed, course, etc.)
 * - External links to MarineTraffic and VesselFinder
 * - Auto-draw track on vessel click
 * - Idempotent popup binding (survives layer refresh and time slider changes)
 */

const VESSEL_LAYER_NAME = 'Vessels (Live AIS)'
const VESSEL_HIGH_ICE_OVERLAY_KEY = 'vessels-in-ice'
const VESSEL_TRACK_OVERLAY_KEY = 'vessel-track'

// Build rich popup HTML from vessel feature properties
function buildVesselPopupHTML(p) {
    if (!p) return ''
    const row = (label, val) =>
        val == null || val === '' || val === 'Unknown' || val === '??'
            ? ''
            : `<tr><td style="color:#94a3b8;padding-right:8px;font-size:11px;white-space:nowrap;">${label}</td>` +
              `<td style="color:#f1f5f9;font-size:12px;">${val}</td></tr>`
    const link = (label, url) =>
        url
            ? `<tr><td style="color:#94a3b8;padding-right:8px;font-size:11px;">${label}</td>` +
              `<td style="font-size:12px;"><a href="${url}" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline;">open ↗</a></td></tr>`
            : ''
    const title = p.name || p.mmsi || 'Unknown vessel'
    const subtitle = [p.shipTypeText, p.flagCountry].filter(Boolean).join(' · ')
    return [
        `<div style="font-family:system-ui,-apple-system,sans-serif;color:#f1f5f9;min-width:240px;">`,
        `<div style="font-weight:600;font-size:14px;line-height:1.2;">${title}</div>`,
        subtitle
            ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:6px;">${subtitle}</div>`
            : '<div style="margin-bottom:6px;"></div>',
        `<table style="border-collapse:collapse;width:100%;">`,
        row('MMSI', p.mmsi),
        row('IMO', p.imo),
        row('Callsign', p.callsign),
        row('Status', p.navStatusText),
        row('Speed', p.speedKn),
        row('Course', p.courseDeg),
        row('Heading', p.headingDeg),
        row('Destination', p.destination),
        row('Dimensions', p.dimensions),
        row('Draught', p.draught),
        row('Position', p.position),
        row('Last report', p.lastReport),
        link('MarineTraffic', p.marineTrafficUrl),
        link('VesselFinder', p.vesselFinderUrl),
        `</table></div>`,
    ].join('')
}

// Bind / refresh popups on every vessel marker. Idempotent — safe to call
// after each layer load / time-slider refresh.
function rebindVesselPopups() {
    try {
        const L_ = window.L_
        if (!L_?.layers?.layer) return 0

        // Try to resolve the layer by display name → UUID
        let leafletLayer = null
        const layerKeys = Object.keys(L_.layers.layer)

        // Strategy 1: Look for exact match by display name
        leafletLayer = L_.layers.layer[VESSEL_LAYER_NAME]

        // Strategy 2: If no match, scan for any layer with vessel features (mmsi property)
        if (!leafletLayer || typeof leafletLayer.eachLayer !== 'function') {
            for (const k of layerKeys) {
                const cand = L_.layers.layer[k]
                if (cand && typeof cand.eachLayer === 'function') {
                    let hit = false
                    cand.eachLayer((m) => {
                        if (m?.feature?.properties?.mmsi) hit = true
                    })
                    if (hit) {
                        leafletLayer = cand
                        break
                    }
                }
            }
        }

        if (!leafletLayer || typeof leafletLayer.eachLayer !== 'function') return 0

        let count = 0
        leafletLayer.eachLayer((m) => {
            const f = m?.feature
            if (!f?.properties?.mmsi) return
            const html = buildVesselPopupHTML(f.properties)
            if (typeof m.getPopup === 'function' && m.getPopup())
                m.setPopupContent(html)
            else if (typeof m.bindPopup === 'function')
                m.bindPopup(html, { maxWidth: 340, autoPan: true })
            count += 1
        })

        if (count > 0 && !window.__vesselPopupsLoggedOnce) {
            console.log(`[Vessels] bound rich popups on ${count} markers`)
            window.__vesselPopupsLoggedOnce = true
        }
        return count
    } catch (e) {
        console.warn('[Vessels] rebindVesselPopups error:', e)
        return 0
    }
}

// Fetch and draw vessel track
async function drawVesselTrack(mmsi, hours = 24) {
    try {
        const res = await fetch(
            `/api/vessels/track?mmsi=${encodeURIComponent(mmsi)}&hours=${hours}`
        )
        if (!res.ok) {
            console.warn(`[Vessels] track fetch failed: HTTP ${res.status}`)
            return
        }
        const fc = await res.json()
        const feature = (fc.features || [])[0]
        const coords = feature?.geometry?.coordinates || []
        if (coords.length < 2) {
            console.log(`[Vessels] No track points for MMSI ${mmsi}`)
            return
        }

        // Ensure overlay group exists
        const map = window.mmgisAPI?.map
        if (!map) return

        if (!window.__vesselTrackOverlays) {
            window.__vesselTrackOverlays = window.L.featureGroup().addTo(map)
        }

        // Clear previous tracks
        window.__vesselTrackOverlays.clearLayers()

        // Draw track polyline
        const latlngs = coords.map(([lon, lat]) => [lat, lon])
        window.L.polyline(latlngs, {
            color: '#dc2626',
            weight: 3,
            opacity: 0.9,
            dashArray: '6,4',
        }).addTo(window.__vesselTrackOverlays)

        // Draw current position marker
        window.L.circleMarker(latlngs[latlngs.length - 1], {
            radius: 5,
            color: '#dc2626',
            weight: 2,
            fillColor: '#fecaca',
            fillOpacity: 0.95,
        }).addTo(window.__vesselTrackOverlays)

        // Fit map to track bounds
        map.fitBounds(window.L.latLngBounds(latlngs), { padding: [24, 24] })

        console.log(`[Vessels] Drew track for MMSI ${mmsi}: ${latlngs.length} points`)
    } catch (err) {
        console.warn(`[Vessels] Failed to draw track:`, err)
    }
}

// Auto-draw track on vessel feature click + rich popup on every vessel marker
function installVesselClickTrackHandler() {
    if (typeof window === 'undefined') return
    if (window.__vesselClickTrackInstalled) return

    const tryInstall = () => {
        const map = window.mmgisAPI?.map
        const L_ = window.L_
        if (!map || !L_) return false

        // Click handler to draw track
        map.on('popupopen', (e) => {
            try {
                const layer = e?.popup?._source
                const feature = layer?.feature
                if (feature?.properties?.mmsi) {
                    drawVesselTrack(feature.properties.mmsi, 24)
                }
            } catch (_) {}
        })

        // Bind popups now (in case layer is already on) and on every reload
        rebindVesselPopups()

        try {
            // Subscribe to layer toggle events
            if (L_.subscribeOnLayerToggle) {
                L_.subscribeOnLayerToggle('vesselPopups', (name, off) => {
                    if (name === VESSEL_LAYER_NAME && !off) {
                        setTimeout(rebindVesselPopups, 200)
                    }
                })
            }

            // Subscribe to time layer reload events
            if (L_.subscribeTimeLayerReloadFinish) {
                L_.subscribeTimeLayerReloadFinish('vesselPopups', () => {
                    setTimeout(rebindVesselPopups, 100)
                })
            }
        } catch (_) {}

        // Periodic rebind to handle auto-refresh and time slider changes
        // MMGIS auto-refreshes vector layers every 30s which destroys and
        // recreates markers without popups. This interval ensures popups
        // are always attached within 2 seconds of any layer refresh.
        setInterval(rebindVesselPopups, 2000)

        // Also poll for ~10s to catch late layer creation
        let tries = 0
        const t = setInterval(() => {
            tries += 1
            if (rebindVesselPopups() > 0 || tries > 20) clearInterval(t)
        }, 500)

        window.__vesselClickTrackInstalled = true
        return true
    }

    if (!tryInstall()) {
        // Retry for up to 60 seconds
        let tries = 0
        const t = setInterval(() => {
            tries += 1
            if (tryInstall() || tries > 60) clearInterval(t)
        }, 1000)
    }
}

// Defer the install attempt past module load so it cannot interfere with
// MMGIS bootstrap
if (typeof window !== 'undefined') {
    setTimeout(installVesselClickTrackHandler, 3000)
}

export {
    rebindVesselPopups,
    drawVesselTrack,
    installVesselClickTrackHandler,
    buildVesselPopupHTML,
}
