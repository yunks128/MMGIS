/**
 * Maritime Identification Digits (MID) -> { iso2, country }.
 *
 * MID is the first 3 digits of a 9-digit MMSI and identifies the vessel's
 * flag state. Source: ITU MID list (https://www.itu.int/en/ITU-R/terrestrial/fmd/Pages/mid.aspx).
 *
 * Curated subset focused on Arctic-relevant flags + common shipping nations.
 * Unknowns return { iso2: '??', country: 'Unknown' }.
 */

const MID = {
  // Arctic-bordering & high-traffic Northern nations
  219: { iso2: "DK", country: "Denmark" },
  220: { iso2: "DK", country: "Denmark" },
  230: { iso2: "FI", country: "Finland" },
  231: { iso2: "FO", country: "Faroe Islands" },
  232: { iso2: "GB", country: "United Kingdom" },
  233: { iso2: "GB", country: "United Kingdom" },
  234: { iso2: "GB", country: "United Kingdom" },
  235: { iso2: "GB", country: "United Kingdom" },
  236: { iso2: "GI", country: "Gibraltar" },
  237: { iso2: "GR", country: "Greece" },
  238: { iso2: "HR", country: "Croatia" },
  239: { iso2: "GR", country: "Greece" },
  240: { iso2: "GR", country: "Greece" },
  241: { iso2: "GR", country: "Greece" },
  242: { iso2: "MA", country: "Morocco" },
  243: { iso2: "HU", country: "Hungary" },
  244: { iso2: "NL", country: "Netherlands" },
  245: { iso2: "NL", country: "Netherlands" },
  246: { iso2: "NL", country: "Netherlands" },
  247: { iso2: "IT", country: "Italy" },
  248: { iso2: "MT", country: "Malta" },
  249: { iso2: "MT", country: "Malta" },
  250: { iso2: "IE", country: "Ireland" },
  251: { iso2: "IS", country: "Iceland" },
  252: { iso2: "LI", country: "Liechtenstein" },
  253: { iso2: "LU", country: "Luxembourg" },
  254: { iso2: "MC", country: "Monaco" },
  255: { iso2: "PT", country: "Portugal" },
  256: { iso2: "MT", country: "Malta" },
  257: { iso2: "NO", country: "Norway" },
  258: { iso2: "NO", country: "Norway" },
  259: { iso2: "NO", country: "Norway" },
  261: { iso2: "PL", country: "Poland" },
  262: { iso2: "ME", country: "Montenegro" },
  263: { iso2: "PT", country: "Portugal" },
  264: { iso2: "RO", country: "Romania" },
  265: { iso2: "SE", country: "Sweden" },
  266: { iso2: "SE", country: "Sweden" },
  267: { iso2: "SK", country: "Slovakia" },
  268: { iso2: "SM", country: "San Marino" },
  269: { iso2: "CH", country: "Switzerland" },
  270: { iso2: "CZ", country: "Czechia" },
  271: { iso2: "TR", country: "Türkiye" },
  272: { iso2: "UA", country: "Ukraine" },
  273: { iso2: "RU", country: "Russia" },
  274: { iso2: "MK", country: "North Macedonia" },
  275: { iso2: "LV", country: "Latvia" },
  276: { iso2: "EE", country: "Estonia" },
  277: { iso2: "LT", country: "Lithuania" },
  278: { iso2: "SI", country: "Slovenia" },
  279: { iso2: "RS", country: "Serbia" },

  // West Africa / Mediterranean / Mid-East (common flags-of-convenience)
  201: { iso2: "AL", country: "Albania" },
  202: { iso2: "AD", country: "Andorra" },
  203: { iso2: "AT", country: "Austria" },
  204: { iso2: "AZ", country: "Azores" },
  205: { iso2: "BE", country: "Belgium" },
  206: { iso2: "BY", country: "Belarus" },
  207: { iso2: "BG", country: "Bulgaria" },
  208: { iso2: "VA", country: "Vatican" },
  209: { iso2: "CY", country: "Cyprus" },
  210: { iso2: "CY", country: "Cyprus" },
  211: { iso2: "DE", country: "Germany" },
  212: { iso2: "CY", country: "Cyprus" },
  213: { iso2: "GE", country: "Georgia" },
  214: { iso2: "MD", country: "Moldova" },
  215: { iso2: "MT", country: "Malta" },
  216: { iso2: "AM", country: "Armenia" },
  218: { iso2: "DE", country: "Germany" },
  226: { iso2: "FR", country: "France" },
  227: { iso2: "FR", country: "France" },
  228: { iso2: "FR", country: "France" },
  229: { iso2: "MT", country: "Malta" },

  // North America
  338: { iso2: "US", country: "United States" },
  366: { iso2: "US", country: "United States" },
  367: { iso2: "US", country: "United States" },
  368: { iso2: "US", country: "United States" },
  369: { iso2: "US", country: "United States" },
  316: { iso2: "CA", country: "Canada" },
  303: { iso2: "US", country: "Alaska (US)" },
  345: { iso2: "MX", country: "Mexico" },

  // Asia / Pacific high-traffic
  412: { iso2: "CN", country: "China" },
  413: { iso2: "CN", country: "China" },
  414: { iso2: "CN", country: "China" },
  416: { iso2: "TW", country: "Taiwan" },
  431: { iso2: "JP", country: "Japan" },
  432: { iso2: "JP", country: "Japan" },
  440: { iso2: "KR", country: "South Korea" },
  441: { iso2: "KR", country: "South Korea" },
  445: { iso2: "KP", country: "North Korea" },
  457: { iso2: "MN", country: "Mongolia" },
  477: { iso2: "HK", country: "Hong Kong" },
  525: { iso2: "ID", country: "Indonesia" },
  563: { iso2: "SG", country: "Singapore" },
  564: { iso2: "SG", country: "Singapore" },
  565: { iso2: "SG", country: "Singapore" },
  566: { iso2: "SG", country: "Singapore" },
  574: { iso2: "VN", country: "Vietnam" },

  // Common flags of convenience
  351: { iso2: "PA", country: "Panama" },
  352: { iso2: "PA", country: "Panama" },
  353: { iso2: "PA", country: "Panama" },
  354: { iso2: "PA", country: "Panama" },
  355: { iso2: "PA", country: "Panama" },
  356: { iso2: "PA", country: "Panama" },
  357: { iso2: "PA", country: "Panama" },
  370: { iso2: "PA", country: "Panama" },
  371: { iso2: "PA", country: "Panama" },
  372: { iso2: "PA", country: "Panama" },
  373: { iso2: "PA", country: "Panama" },
  374: { iso2: "PA", country: "Panama" },
  636: { iso2: "LR", country: "Liberia" },
  637: { iso2: "LR", country: "Liberia" },
  538: { iso2: "MH", country: "Marshall Islands" },
  311: { iso2: "BS", country: "Bahamas" },
  312: { iso2: "BZ", country: "Belize" },
  319: { iso2: "KY", country: "Cayman Islands" },
  548: { iso2: "PH", country: "Philippines" },

  // Other selected
  273: { iso2: "RU", country: "Russia" }, // duplicate guard
  775: { iso2: "VE", country: "Venezuela" },
  710: { iso2: "BR", country: "Brazil" },
  701: { iso2: "AR", country: "Argentina" },
  725: { iso2: "CL", country: "Chile" },
  503: { iso2: "AU", country: "Australia" },
  512: { iso2: "NZ", country: "New Zealand" },
};

/**
 * Decode an MMSI string/number to a flag.
 * Special MMSI ranges (SAR aircraft 111…, AIS-SART 970…, base stations 00…) are flagged.
 */
function decodeMmsi(mmsi) {
  const s = String(mmsi || "");
  if (s.length !== 9) return { iso2: "??", country: "Invalid MMSI", category: "invalid" };
  if (s.startsWith("00")) return { iso2: "??", country: "Coastal station", category: "station" };
  if (s.startsWith("111")) return { iso2: "??", country: "SAR aircraft", category: "sar-aircraft" };
  if (s.startsWith("970")) return { iso2: "??", country: "AIS-SART (distress)", category: "sart" };
  if (s.startsWith("972")) return { iso2: "??", country: "MOB beacon", category: "mob" };
  if (s.startsWith("974")) return { iso2: "??", country: "EPIRB-AIS beacon", category: "epirb" };
  if (s.startsWith("99")) return { iso2: "??", country: "Aid to navigation", category: "aton" };

  const mid = parseInt(s.slice(0, 3), 10);
  const entry = MID[mid];
  if (!entry) return { iso2: "??", country: `Unknown (MID ${mid})`, category: "vessel" };
  return { ...entry, category: "vessel" };
}

module.exports = { decodeMmsi, MID };
