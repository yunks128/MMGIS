UPDATE configs 
SET config = '{
  "msv": {
    "mission": "frozon",
    "site": "",
    "masterdb": false,
    "view": ["-150", "75", "4"],
    "radius": {"major": 6371008, "minor": 6371008},
    "mapscale": ""
  },
  "projection": {
    "custom": false,
    "epsg": "",
    "proj": "4326",
    "globeproj": "webmercator",
    "xmlpath": "",
    "bounds": ["-180", "60", "180", "90"],
    "origin": ["", ""],
    "reszoomlevel": "",
    "resunitsperpixel": ""
  },
  "look": {
    "pagename": "Frozon Arctic Research",
    "minimalist": false,
    "topbar": true,
    "toolbar": true,
    "scalebar": true,
    "coordinates": true,
    "zoomcontrol": false,
    "graticule": true,
    "miscellaneous": true,
    "bodycolor": "",
    "topbarcolor": "",
    "toolbarcolor": "",
    "mapcolor": "",
    "swap": true,
    "copylink": true,
    "screenshot": true,
    "fullscreen": true,
    "help": true,
    "logourl": "",
    "helpurl": ""
  },
  "panelSettings": {},
  "panels": {"viewer": true, "map": true, "globe": true},
  "time": {"enabled": true},
  "tools": [
    {"name": "Layers", "icon": "layers", "js": "LayersTool"},
    {"name": "Legend", "icon": "format-list-bulleted-type", "js": "LegendTool"},
    {"name": "Info", "icon": "information-variant", "js": "InfoTool"},
    {
      "on": true,
      "name": "AgentChat",
      "icon": "robot-outline",
      "js": "AgentChatTool",
      "separatedTool": true,
      "variables": {
        "justification": "left"
      }
    }
  ],
  "layers": [
    {
      "name": "OSM_Basemap",
      "uuid": "439c88fe-91ee-40a4-b59b-fc90c10586aa",
      "sublayers": [],
      "type": "tile",
      "visibility": true,
      "sourceType": "url",
      "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      "tileformat": "wmts",
      "controlled": true,
      "initialOpacity": 1,
      "minZoom": 2,
      "maxNativeZoom": 19,
      "maxZoom": 19,
      "boundingBox": [-180, -85, 180, 85],
      "style": {
        "brightness": 1,
        "contrast": 1,
        "saturation": 1,
        "blend": "none",
        "className": ""
      }
    },
    {
      "name": "Areas_of_Interest",
      "uuid": "b3c4d5e6-7f8g-9h0i-1j2k-345678901fed",
      "sublayers": [],
      "type": "vector",
      "visibility": true,
      "sourceType": "url",
      "url": "Layers/Frozon_Areas_of_Interest.geojson",
      "controlled": false,
      "initialOpacity": 1,
      "style": {
        "color": "#ff6b35",
        "fillColor": "#ff6b35",
        "fillOpacity": 0.3,
        "weight": 3,
        "className": ""
      }
    },
    {
      "name": "Polar_Countries",
      "uuid": "c4d5e6f7-8g9h-0i1j-2k3l-456789012gfe",
      "sublayers": [],
      "type": "vector",
      "visibility": true,
      "sourceType": "url",
      "url": "Layers/Frozon_PolarCountries.geojson",
      "controlled": false,
      "initialOpacity": 0.5,
      "style": {
        "color": "#64748b",
        "fillColor": "#64748b",
        "fillOpacity": 0.15,
        "weight": 2,
        "className": ""
      }
    },
    {
      "name": "SWOT_Freeboard_530",
      "uuid": "f1e2d3c4-5a6b-7c8d-9e0f-123456789abc",
      "sublayers": [],
      "type": "tile",
      "visibility": false,
      "sourceType": "url",
      "url": "http://localhost:8883/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?url=/Missions/frozon/Layers/Freeboard/SWOT_L2_LR_NPFRB_024_530_20241201T002652_20241201T011735_PIC2_01_freeboard_COG.tif",
      "tileformat": "wmts",
      "controlled": true,
      "initialOpacity": 0.8,
      "minZoom": 1,
      "maxNativeZoom": 7,
      "maxZoom": 7,
      "boundingBox": [98.41, 59.47, -178.46, 79.92],
      "style": {
        "brightness": 1,
        "contrast": 1,
        "saturation": 1,
        "blend": "none",
        "className": "swot_freeboard_530"
      }
    },
    {
      "name": "SWOT_SSHA_530",
      "uuid": "a2b3c4d5-6e7f-8g9h-0i1j-234567890def",
      "sublayers": [],
      "type": "tile",
      "visibility": false,
      "sourceType": "url",
      "url": "http://localhost:8883/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?url=/Missions/frozon/Layers/Freeboard/SWOT_L2_LR_NPFRB_024_530_20241201T002652_20241201T011735_PIC2_01_ssha_COG.tif",
      "tileformat": "wmts",
      "controlled": true,
      "initialOpacity": 0.8,
      "minZoom": 1,
      "maxNativeZoom": 7,
      "maxZoom": 7,
      "boundingBox": [98.41, 59.47, -178.46, 79.92],
      "style": {
        "brightness": 1,
        "contrast": 1,
        "saturation": 1,
        "blend": "none",
        "className": "swot_ssha_530"
      }
    },
    {
      "name": "SWOT_Norm_Sig0_530",
      "uuid": "b1c2d3e4-5f6g-7h8i-9j0k-345678901abc",
      "sublayers": [],
      "type": "tile",
      "visibility": false,
      "sourceType": "url",
      "url": "http://localhost:8883/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?url=/Missions/frozon/Layers/Freeboard/SWOT_L2_LR_NPFRB_024_530_20241201T002652_20241201T011735_PIC2_01_norm_sig0_COG.tif",
      "tileformat": "wmts",
      "controlled": true,
      "initialOpacity": 0.8,
      "minZoom": 1,
      "maxNativeZoom": 7,
      "maxZoom": 7,
      "boundingBox": [98.41, 59.47, -178.46, 79.92],
      "style": {
        "brightness": 1,
        "contrast": 1,
        "saturation": 1,
        "blend": "none",
        "className": "swot_norm_sig0_530"
      }
    },
    {
      "name": "SWOT_Freeboard_535",
      "uuid": "c2d3e4f5-6g7h-8i9j-0k1l-456789012bcd",
      "sublayers": [],
      "type": "tile",
      "visibility": false,
      "sourceType": "url",
      "url": "http://localhost:8883/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?url=/Missions/frozon/Layers/Freeboard/SWOT_L2_LR_NPFRB_024_535_20241201T044322_20241201T053449_PIC2_01_freeboard_COG.tif",
      "tileformat": "wmts",
      "controlled": true,
      "initialOpacity": 0.8,
      "minZoom": 1,
      "maxNativeZoom": 7,
      "maxZoom": 7,
      "boundingBox": [98.41, 59.47, -178.46, 79.92],
      "style": {
        "brightness": 1,
        "contrast": 1,
        "saturation": 1,
        "blend": "none",
        "className": "swot_freeboard_535"
      }
    },
    {
      "name": "SWOT_SSHA_535",
      "uuid": "d3e4f5g6-7h8i-9j0k-1l2m-567890123cde",
      "sublayers": [],
      "type": "tile",
      "visibility": false,
      "sourceType": "url",
      "url": "http://localhost:8883/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?url=/Missions/frozon/Layers/Freeboard/SWOT_L2_LR_NPFRB_024_535_20241201T044322_20241201T053449_PIC2_01_ssha_COG.tif",
      "tileformat": "wmts",
      "controlled": true,
      "initialOpacity": 0.8,
      "minZoom": 1,
      "maxNativeZoom": 7,
      "maxZoom": 7,
      "boundingBox": [98.41, 59.47, -178.46, 79.92],
      "style": {
        "brightness": 1,
        "contrast": 1,
        "saturation": 1,
        "blend": "none",
        "className": "swot_ssha_535"
      }
    },
    {
      "name": "SWOT_Norm_Sig0_535",
      "uuid": "e4f5g6h7-8i9j-0k1l-2m3n-678901234def",
      "sublayers": [],
      "type": "tile",
      "visibility": false,
      "sourceType": "url",
      "url": "http://localhost:8883/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?url=/Missions/frozon/Layers/Freeboard/SWOT_L2_LR_NPFRB_024_535_20241201T044322_20241201T053449_PIC2_01_norm_sig0_COG.tif",
      "tileformat": "wmts",
      "controlled": true,
      "initialOpacity": 0.8,
      "minZoom": 1,
      "maxNativeZoom": 7,
      "maxZoom": 7,
      "boundingBox": [98.41, 59.47, -178.46, 79.92],
      "style": {
        "brightness": 1,
        "contrast": 1,
        "saturation": 1,
        "blend": "none",
        "className": "swot_norm_sig0_535"
      }
    }
  ]
}',
version = version + 1
WHERE mission = 'frozon' AND id = (SELECT MAX(id) FROM configs WHERE mission = 'frozon');