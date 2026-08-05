import type { UnRegion } from "@same-sky/shared-types";

// Pantheon `bplace_country`/`dplace_country` value -> UnRegion. Built from
// a one-time call to Pantheon's live /country endpoint
// (https://api.pantheon.world/country, public, no auth, PostgREST-based),
// hardcoded here so no live dependency exists at Fetch time — same pattern
// region-categories.ts already uses for Wikidata Q-IDs
// (.scratch/alt-data-sources/issues/13-region-taxonomy-mapping.md).
//
// The person CSV's country names don't always match the /country
// endpoint's canonical names exactly (verified against all 241 distinct
// bplace_country/dplace_country values in the actual 2025 dataset — only 4
// mismatches, listed as extra keys pointing at the same region below:
// "Bahamas, The"/"The Bahamas", "Czech Republic"/"Czechia",
// "Federated States of Micronesia"/"Micronesia", "Swaziland"/"Eswatini").
// 20 small territories (American Samoa, Antarctica, Gibraltar, etc.) have
// no UN region assigned by the API at all and are deliberately left
// unmapped, resolving to "no region" — same graceful-degradation pattern
// region-categories.ts already uses for Oceania.
export const UN_REGION_CATEGORIES: Record<string, UnRegion> = {
  // australia-and-new-zealand
  Australia: "australia-and-new-zealand",
  "New Zealand": "australia-and-new-zealand",

  // caribbean
  "Antigua and Barbuda": "caribbean",
  Aruba: "caribbean",
  "Bahamas, The": "caribbean",
  Barbados: "caribbean",
  Cuba: "caribbean",
  Curaçao: "caribbean",
  Dominica: "caribbean",
  "Dominican Republic": "caribbean",
  Grenada: "caribbean",
  Guadeloupe: "caribbean",
  Haiti: "caribbean",
  Jamaica: "caribbean",
  Martinique: "caribbean",
  Montserrat: "caribbean",
  "Puerto Rico": "caribbean",
  "Saint Kitts and Nevis": "caribbean",
  "Saint Lucia": "caribbean",
  "Saint Vincent and the Grenadines": "caribbean",
  "The Bahamas": "caribbean",
  "Trinidad and Tobago": "caribbean",
  "U.S. Virgin Islands": "caribbean",

  // central-america
  Belize: "central-america",
  "Costa Rica": "central-america",
  "El Salvador": "central-america",
  Guatemala: "central-america",
  Honduras: "central-america",
  Mexico: "central-america",
  Nicaragua: "central-america",
  Panama: "central-america",

  // central-asia
  Kazakhstan: "central-asia",
  Kyrgyzstan: "central-asia",
  Tajikistan: "central-asia",
  Turkmenistan: "central-asia",
  Uzbekistan: "central-asia",

  // eastern-africa
  Burundi: "eastern-africa",
  Comoros: "eastern-africa",
  Djibouti: "eastern-africa",
  Eritrea: "eastern-africa",
  Ethiopia: "eastern-africa",
  Kenya: "eastern-africa",
  Madagascar: "eastern-africa",
  Malawi: "eastern-africa",
  Mauritius: "eastern-africa",
  Mozambique: "eastern-africa",
  Rwanda: "eastern-africa",
  Réunion: "eastern-africa",
  Seychelles: "eastern-africa",
  Somalia: "eastern-africa",
  "South Sudan": "eastern-africa",
  Tanzania: "eastern-africa",
  Uganda: "eastern-africa",
  Zambia: "eastern-africa",
  Zimbabwe: "eastern-africa",

  // eastern-asia
  China: "eastern-asia",
  "Hong Kong": "eastern-asia",
  Japan: "eastern-asia",
  Mongolia: "eastern-asia",
  "North Korea": "eastern-asia",
  "South Korea": "eastern-asia",
  Taiwan: "eastern-asia",

  // eastern-europe
  Belarus: "eastern-europe",
  Bulgaria: "eastern-europe",
  "Czech Republic": "eastern-europe",
  Czechia: "eastern-europe",
  Hungary: "eastern-europe",
  Moldova: "eastern-europe",
  Poland: "eastern-europe",
  Romania: "eastern-europe",
  Russia: "eastern-europe",
  Slovakia: "eastern-europe",
  Ukraine: "eastern-europe",

  // melanesia
  Fiji: "melanesia",
  "New Caledonia": "melanesia",
  "Papua New Guinea": "melanesia",
  "Solomon Islands": "melanesia",
  Vanuatu: "melanesia",

  // micronesia
  "Federated States of Micronesia": "micronesia",
  Guam: "micronesia",
  Kiribati: "micronesia",
  "Marshall Islands": "micronesia",
  Micronesia: "micronesia",
  Nauru: "micronesia",
  Palau: "micronesia",

  // middle-africa
  Angola: "middle-africa",
  Cameroon: "middle-africa",
  "Central African Republic": "middle-africa",
  Chad: "middle-africa",
  "Democratic Republic of the Congo": "middle-africa",
  "Equatorial Guinea": "middle-africa",
  Gabon: "middle-africa",
  "Republic of the Congo": "middle-africa",
  "São Tomé and Príncipe": "middle-africa",

  // northern-africa
  Algeria: "northern-africa",
  Egypt: "northern-africa",
  Libya: "northern-africa",
  Morocco: "northern-africa",
  Sudan: "northern-africa",
  Tunisia: "northern-africa",

  // northern-america
  Bermuda: "northern-america",
  Canada: "northern-america",
  Greenland: "northern-america",
  "United States": "northern-america",

  // northern-europe
  Denmark: "northern-europe",
  Estonia: "northern-europe",
  "Faroe Islands": "northern-europe",
  Finland: "northern-europe",
  Guernsey: "northern-europe",
  Iceland: "northern-europe",
  Ireland: "northern-europe",
  "Isle of Man": "northern-europe",
  Jersey: "northern-europe",
  Latvia: "northern-europe",
  Lithuania: "northern-europe",
  Norway: "northern-europe",
  Sweden: "northern-europe",
  "United Kingdom": "northern-europe",

  // polynesia
  "Cook Islands": "polynesia",
  "French Polynesia": "polynesia",
  Niue: "polynesia",
  Samoa: "polynesia",
  Tonga: "polynesia",
  Tuvalu: "polynesia",

  // south-america
  Argentina: "south-america",
  Bolivia: "south-america",
  Brazil: "south-america",
  Chile: "south-america",
  Colombia: "south-america",
  Ecuador: "south-america",
  "French Guiana": "south-america",
  Guyana: "south-america",
  Paraguay: "south-america",
  Peru: "south-america",
  Suriname: "south-america",
  Uruguay: "south-america",
  Venezuela: "south-america",

  // south-eastern-asia
  Brunei: "south-eastern-asia",
  Cambodia: "south-eastern-asia",
  Indonesia: "south-eastern-asia",
  Laos: "south-eastern-asia",
  Malaysia: "south-eastern-asia",
  "Myanmar (Burma)": "south-eastern-asia",
  Philippines: "south-eastern-asia",
  Singapore: "south-eastern-asia",
  Thailand: "south-eastern-asia",
  "Timor-Leste": "south-eastern-asia",
  Vietnam: "south-eastern-asia",

  // southern-africa
  Botswana: "southern-africa",
  Eswatini: "southern-africa",
  Lesotho: "southern-africa",
  Namibia: "southern-africa",
  "South Africa": "southern-africa",
  Swaziland: "southern-africa",

  // southern-asia
  Afghanistan: "southern-asia",
  Bangladesh: "southern-asia",
  Bhutan: "southern-asia",
  India: "southern-asia",
  Iran: "southern-asia",
  Maldives: "southern-asia",
  Nepal: "southern-asia",
  Pakistan: "southern-asia",
  "Sri Lanka": "southern-asia",

  // southern-europe
  Albania: "southern-europe",
  Andorra: "southern-europe",
  "Bosnia and Herzegovina": "southern-europe",
  Croatia: "southern-europe",
  Greece: "southern-europe",
  Italy: "southern-europe",
  Kosovo: "southern-europe",
  Malta: "southern-europe",
  Montenegro: "southern-europe",
  "North Macedonia": "southern-europe",
  Portugal: "southern-europe",
  "San Marino": "southern-europe",
  Serbia: "southern-europe",
  Slovenia: "southern-europe",
  Spain: "southern-europe",
  "Vatican City": "southern-europe",

  // western-africa
  Benin: "western-africa",
  "Burkina Faso": "western-africa",
  "Cabo Verde": "western-africa",
  "Côte d'Ivoire": "western-africa",
  Ghana: "western-africa",
  Guinea: "western-africa",
  "Guinea-Bissau": "western-africa",
  Liberia: "western-africa",
  Mali: "western-africa",
  Mauritania: "western-africa",
  Niger: "western-africa",
  Nigeria: "western-africa",
  Senegal: "western-africa",
  "Sierra Leone": "western-africa",
  "The Gambia": "western-africa",
  Togo: "western-africa",

  // western-asia
  Armenia: "western-asia",
  Azerbaijan: "western-asia",
  Bahrain: "western-asia",
  Cyprus: "western-asia",
  Georgia: "western-asia",
  Iraq: "western-asia",
  Israel: "western-asia",
  Jordan: "western-asia",
  Kuwait: "western-asia",
  Lebanon: "western-asia",
  Oman: "western-asia",
  Palestine: "western-asia",
  Qatar: "western-asia",
  "Saudi Arabia": "western-asia",
  Syria: "western-asia",
  Türkiye: "western-asia",
  "United Arab Emirates": "western-asia",
  Yemen: "western-asia",

  // western-europe
  Austria: "western-europe",
  Belgium: "western-europe",
  France: "western-europe",
  Germany: "western-europe",
  Liechtenstein: "western-europe",
  Luxembourg: "western-europe",
  Monaco: "western-europe",
  Netherlands: "western-europe",
  Switzerland: "western-europe",
};
