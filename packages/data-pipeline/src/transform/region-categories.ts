import type { Region } from "@same-sky/shared-types";

// Explicit Wikidata country/state Q-ID -> app Region (the UN M49 22-value
// sub-region scheme, shared with People's Pantheon-sourced tags — see
// un-region-categories.ts). Built by hand against the distinct country
// Q-IDs actually present in the grouped pool (see list-unmapped-countries.ts).
// Historical polities are mapped to the sub-region their territory
// geographically corresponds to today, not a current-day successor state's
// name — e.g. the Byzantine Empire resolves to southern-europe (its
// Greek/Balkan core) rather than western-asia (modern Turkey, where its
// capital Constantinople sits), preserving the historical-polity awareness
// this table exists for. Where an entry's modern-day territory maps
// cleanly onto one of un-region-categories.ts's Pantheon country names,
// that table's value is reused directly, so the two taxonomies agree.
export const REGION_CATEGORIES: Record<string, Region> = {
  // australia-and-new-zealand
  Q408: "australia-and-new-zealand", // Australia
  Q664: "australia-and-new-zealand", // New Zealand

  // caribbean
  Q781: "caribbean", // Antigua and Barbuda
  Q21203: "caribbean", // Aruba
  Q241: "caribbean", // Cuba
  Q25279: "caribbean", // Curaçao
  Q786: "caribbean", // Dominican Republic
  Q769: "caribbean", // Grenada
  Q766: "caribbean", // Jamaica
  Q861551: "caribbean", // Saint-Domingue
  Q760: "caribbean", // Saint Lucia
  Q757: "caribbean", // Saint Vincent and the Grenadines
  Q26273: "caribbean", // Sint Maarten
  Q754: "caribbean", // Trinidad and Tobago

  // central-america
  Q2608489: "central-america", // Aztec Empire
  Q800: "central-america", // Costa Rica
  Q792: "central-america", // El Salvador
  Q774: "central-america", // Guatemala
  Q783: "central-america", // Honduras
  Q96: "central-america", // Mexico
  Q811: "central-america", // Nicaragua
  Q804: "central-america", // Panama

  // central-asia
  Q232: "central-asia", // Kazakhstan
  Q813: "central-asia", // Kyrgyzstan
  Q12150341: "central-asia", // Samanid Empire
  Q484195: "central-asia", // Timurid Empire
  Q874: "central-asia", // Turkmenistan

  // eastern-africa
  Q115: "eastern-africa", // Ethiopia
  Q207521: "eastern-africa", // Ethiopian Empire
  Q153963: "eastern-africa", // German East Africa
  Q114: "eastern-africa", // Kenya
  Q1037: "eastern-africa", // Rwanda
  Q1045: "eastern-africa", // Somalia
  Q924: "eastern-africa", // Tanzania
  Q1774: "eastern-africa", // Zanzibar Islands

  // eastern-asia
  Q29520: "eastern-asia", // China
  Q148: "eastern-asia", // People's Republic of China
  Q13426199: "eastern-asia", // Republic of China
  Q17: "eastern-asia", // Japan
  Q188712: "eastern-asia", // Empire of Japan
  Q14773: "eastern-asia", // Macau
  Q30623: "eastern-asia", // Manchukuo
  Q9903: "eastern-asia", // Ming dynasty
  Q7462: "eastern-asia", // Song dynasty
  Q1065073: "eastern-asia", // Song
  Q9683: "eastern-asia", // Tang dynasty
  Q8733: "eastern-asia", // Qing dynasty
  Q7183: "eastern-asia", // Qin dynasty
  Q34756: "eastern-asia", // Qin
  Q837855: "eastern-asia", // Qi
  Q912068: "eastern-asia", // Wu
  Q736936: "eastern-asia", // Lu
  Q227007: "eastern-asia", // Zhu
  Q35216: "eastern-asia", // Zhou dynasty
  Q1072949: "eastern-asia", // Western Han
  Q504769: "eastern-asia", // Xin dynasty
  Q7313: "eastern-asia", // Yuan dynasty
  Q711: "eastern-asia", // Mongolia
  Q12557: "eastern-asia", // Mongol Empire
  Q212056: "eastern-asia", // Mongolian People's Republic
  Q423: "eastern-asia", // North Korea
  Q884: "eastern-asia", // South Korea
  Q491559: "eastern-asia", // First Republic of South Korea
  Q484104: "eastern-asia", // United States Army Military Government in Korea
  Q865: "eastern-asia", // Taiwan
  Q2444884: "eastern-asia", // Tibet

  // eastern-europe
  Q184: "eastern-europe", // Belarus
  Q219: "eastern-europe", // Bulgaria
  Q420759: "eastern-europe", // Second Bulgarian Empire
  Q213: "eastern-europe", // Czech Republic
  Q33946: "eastern-europe", // Czechoslovakia
  Q152750: "eastern-europe", // Protectorate of Bohemia and Moravia
  Q42585: "eastern-europe", // Kingdom of Bohemia
  Q16150196: "eastern-europe", // Donetsk People's Republic
  Q501303: "eastern-europe", // Free City of Krakow
  Q170770: "eastern-europe", // Grand Principality of Moscow
  Q83546: "eastern-europe", // Grand Principality of Vladimir
  Q28: "eastern-europe", // Hungary
  Q171150: "eastern-europe", // Kingdom of Hungary
  Q600018: "eastern-europe", // Kingdom of Hungary
  Q16056854: "eastern-europe", // Kingdom of Hungary
  Q10295972: "eastern-europe", // Hunnic Empire
  Q1108445: "eastern-europe", // Kievan Rus'
  Q1649871: "eastern-europe", // Kingdom of Poland
  Q16746854: "eastern-europe", // Luhansk People's Republic
  Q217: "eastern-europe", // Moldova
  Q36: "eastern-europe", // Poland
  Q211274: "eastern-europe", // Polish People's Republic
  Q389004: "eastern-europe", // Principality of Wallachia
  Q15925436: "eastern-europe", // Republic of Crimea
  Q218: "eastern-europe", // Romania
  Q159: "eastern-europe", // Russia
  Q34266: "eastern-europe", // Russian Empire
  Q139319: "eastern-europe", // Russian Republic
  Q2305208: "eastern-europe", // Russian Socialist Federative Soviet Republic
  Q15180: "eastern-europe", // Soviet Union
  Q186096: "eastern-europe", // Tsardom of Russia
  Q214: "eastern-europe", // Slovakia
  Q212: "eastern-europe", // Ukraine
  Q243610: "eastern-europe", // Ukrainian People's Republic
  Q457167: "eastern-europe", // West Ukrainian People's Republic
  Q114318324: "eastern-europe", // Kherson Oblast
  Q114318415: "eastern-europe", // Zaporozhye Oblast

  // middle-africa
  Q974: "middle-africa", // Democratic Republic of the Congo
  Q1009: "middle-africa", // Cameroon
  Q1039: "middle-africa", // Sao Tome and Principe

  // northern-africa
  Q199688: "northern-africa", // Almohad Caliphate
  Q2429397: "northern-africa", // Ancient Carthage
  Q79: "northern-africa", // Egypt
  Q11768: "northern-africa", // Ancient Egypt
  Q127861: "northern-africa", // Khedivate of Egypt
  Q124943: "northern-africa", // Kingdom of Egypt
  Q177819: "northern-africa", // Old Kingdom of Egypt
  Q3087763: "northern-africa", // Republic of Egypt
  Q370173: "northern-africa", // Sultanate of Egypt
  Q2320005: "northern-africa", // Ptolemaic Kingdom
  Q160307: "northern-africa", // Fatimid Caliphate
  Q63135869: "northern-africa", // Ayyubid Sultanate
  Q907234: "northern-africa", // French protectorate in Morocco
  Q457242: "northern-africa", // Spanish protectorate in Morocco
  Q622855: "northern-africa", // Ifriqiya
  Q284568: "northern-africa", // Italian Libya
  Q1016: "northern-africa", // Libya
  Q1028: "northern-africa", // Morocco
  Q1049: "northern-africa", // Sudan
  Q948: "northern-africa", // Tunisia
  Q262: "northern-africa", // Algeria

  // northern-america
  Q258532: "northern-america", // British America
  Q16: "northern-america", // Canada
  Q81931: "northern-america", // Confederate States of America
  Q223: "northern-america", // Greenland
  Q170604: "northern-america", // New France
  Q179997: "northern-america", // Thirteen Colonies
  Q30: "northern-america", // United States

  // northern-europe
  Q8680: "northern-europe", // British Empire
  Q35: "northern-europe", // Denmark
  Q756617: "northern-europe", // Kingdom of Denmark
  Q191: "northern-europe", // Estonia
  Q33: "northern-europe", // Finland
  Q189: "northern-europe", // Iceland
  Q62389: "northern-europe", // Icelandic Commonwealth
  Q27: "northern-europe", // Ireland
  Q215530: "northern-europe", // Kingdom of Ireland
  Q107299: "northern-europe", // Kingdom of Northumbria
  Q105313: "northern-europe", // Kingdom of Wessex
  Q161885: "northern-europe", // Kingdom of Great Britain
  Q174193: "northern-europe", // United Kingdom of Great Britain and Ireland
  Q179876: "northern-europe", // Kingdom of England
  Q230791: "northern-europe", // Kingdom of Scotland
  Q1483510: "northern-europe", // Principality of Wales
  Q124653007: "northern-europe", // realm of the United Kingdom
  Q145: "northern-europe", // United Kingdom
  Q211: "northern-europe", // Latvia
  Q37: "northern-europe", // Lithuania
  Q20: "northern-europe", // Norway
  Q34: "northern-europe", // Sweden
  Q215443: "northern-europe", // Swedish Empire

  // south-america
  Q414: "south-america", // Argentina
  Q750: "south-america", // Bolivia
  Q155: "south-america", // Brazil
  Q298: "south-america", // Chile
  Q739: "south-america", // Colombia
  Q736: "south-america", // Ecuador
  Q734: "south-america", // Guyana
  Q733: "south-america", // Paraguay
  Q419: "south-america", // Peru
  Q730: "south-america", // Suriname
  Q77: "south-america", // Uruguay
  Q717: "south-america", // Venezuela
  Q210551: "south-america", // Viceroyalty of the Rio de la Plata

  // south-eastern-asia
  Q921: "south-eastern-asia", // Brunei
  Q424: "south-eastern-asia", // Cambodia
  Q188161: "south-eastern-asia", // Dutch East Indies
  Q185682: "south-eastern-asia", // French Indochina
  Q252: "south-eastern-asia", // Indonesia
  Q833: "south-eastern-asia", // Malaysia
  Q871091: "south-eastern-asia", // British Malaya
  Q836: "south-eastern-asia", // Myanmar
  Q928: "south-eastern-asia", // Philippines
  Q334: "south-eastern-asia", // Singapore
  Q1081620: "south-eastern-asia", // Siam
  Q869: "south-eastern-asia", // Thailand
  Q574: "south-eastern-asia", // Timor-Leste
  Q881: "south-eastern-asia", // Vietnam
  Q180573: "south-eastern-asia", // South Vietnam

  // southern-africa
  Q963: "southern-africa", // Botswana
  Q1050: "southern-africa", // Eswatini
  Q258: "southern-africa", // South Africa
  Q729768: "southern-africa", // Zulu Kingdom

  // southern-asia
  Q889: "southern-asia", // Afghanistan
  Q1415128: "southern-asia", // Republic of Afghanistan
  Q389688: "southern-asia", // Achaemenid Empire
  Q569107: "southern-asia", // Anshan Persia
  Q555994: "southern-asia", // Aq Qoyunlu
  Q902: "southern-asia", // Bangladesh
  Q917: "southern-asia", // Bhutan
  Q129286: "southern-asia", // British Raj
  Q112660052: "southern-asia", // British India
  Q249578: "southern-asia", // Ghaznavid Empire
  Q668: "southern-asia", // India
  Q794: "southern-asia", // Iran
  Q18234383: "southern-asia", // Safavid Iran
  Q826: "southern-asia", // Maldives
  Q62943: "southern-asia", // Maurya empire
  Q837: "southern-asia", // Nepal
  Q843: "southern-asia", // Pakistan
  Q83891: "southern-asia", // Sasanian Empire
  Q3708094: "southern-asia", // Seljuk Empire
  Q854: "southern-asia", // Sri Lanka
  Q2320255: "southern-asia", // Islamic Emirate of Waziristan

  // southern-europe
  Q222: "southern-europe", // Albania
  Q228: "southern-europe", // Andorra
  Q225: "southern-europe", // Bosnia and Herzegovina
  Q1274468: "southern-europe", // Republic of Bosnia and Herzegovina
  Q12544: "southern-europe", // Byzantine Empire
  Q224: "southern-europe", // Croatia
  Q204920: "southern-europe", // Crown of Aragon
  Q217196: "southern-europe", // Crown of Castile
  Q693570: "southern-europe", // Duchy of Ferrara
  Q153529: "southern-europe", // Duchy of Milan
  Q238445: "southern-europe", // Emirate of Granada
  Q154849: "southern-europe", // Grand Duchy of Tuscany
  Q41: "southern-europe", // Greece
  Q209065: "southern-europe", // Kingdom of Greece
  Q766543: "southern-europe", // Hispanic Monarchy
  Q3355522: "southern-europe", // Hospitaller Malta
  Q38: "southern-europe", // Italy
  Q172579: "southern-europe", // Kingdom of Italy
  Q838931: "southern-europe", // Kingdom of Italy
  Q148540: "southern-europe", // Republic of Florence
  Q174306: "southern-europe", // Republic of Genoa
  Q1365493: "southern-europe", // Republic of Pisa
  Q4948: "southern-europe", // Republic of Venice
  Q1246: "southern-europe", // Kosovo
  Q200262: "southern-europe", // Kingdom of Navarre
  Q45670: "southern-europe", // Kingdom of Portugal
  Q188586: "southern-europe", // Kingdom of Sicily
  Q3399982: "southern-europe", // Kingdom of Spain
  Q2940142: "southern-europe", // Kingdom of Toledo
  Q178897: "southern-europe", // Latin Empire
  Q83958: "southern-europe", // Macedonia
  Q13405524: "southern-europe", // Macedonian Empire
  Q233: "southern-europe", // Malta
  Q221: "southern-europe", // North Macedonia
  Q583038: "southern-europe", // Ostrogothic Kingdom
  Q42834: "southern-europe", // Western Roman Empire
  Q1747689: "southern-europe", // Ancient Rome
  Q2277: "southern-europe", // Roman Empire
  Q45: "southern-europe", // Portugal
  Q238: "southern-europe", // San Marino
  Q403: "southern-europe", // Serbia
  Q878319: "southern-europe", // Serbian Despotate
  Q215: "southern-europe", // Slovenia
  Q29: "southern-europe", // Spain
  Q80702: "southern-europe", // Spanish Empire
  Q6123746: "southern-europe", // Spanish Republic at War
  Q237: "southern-europe", // Vatican City
  Q244796: "southern-europe", // Achaean League
  Q3606949: "southern-europe", // Agyrion
  Q3607380: "southern-europe", // Akragas
  Q833665: "southern-europe", // Boeotian confederation
  Q11266977: "southern-europe", // Epirus
  Q4420718: "southern-europe", // Syracuse
  Q5690: "southern-europe", // Sparta
  Q844930: "southern-europe", // Classical Athens
  Q1247159: "southern-europe", // Messenia
  Q42295059: "southern-europe", // Mytilene
  Q13580795: "southern-europe", // Samos
  Q170174: "southern-europe", // Papal States

  // western-africa
  Q1011: "western-africa", // Cape Verde
  Q1006: "western-africa", // Guinea
  Q184536: "western-africa", // Mali Empire
  Q1025: "western-africa", // Mauritania
  Q1033: "western-africa", // Nigeria
  Q1041: "western-africa", // Senegal
  Q945: "western-africa", // Togo

  // western-asia
  Q31354462: "western-asia", // Republic of Abkhazia
  Q244165: "western-asia", // Republic of Artsakh
  Q227: "western-asia", // Azerbaijan
  Q131337: "western-asia", // Azerbaijan Soviet Socialist Republic
  Q399: "western-asia", // Armenia
  Q12536: "western-asia", // Abbasid Caliphate
  Q47690: "western-asia", // Babylonia
  Q624887: "western-asia", // Neo-Babylonian Empire
  Q723587: "western-asia", // Third Dynasty of Ur
  Q398: "western-asia", // Bahrain
  Q679305: "western-asia", // Cyme
  Q229: "western-asia", // Cyprus
  Q23681: "western-asia", // Northern Cyprus
  Q1743884: "western-asia", // Kition (Cyprus)
  Q230: "western-asia", // Georgia
  Q154667: "western-asia", // Kingdom of Georgia
  Q47611: "western-asia", // Ephesus
  Q5843680: "western-asia", // Halicarnassus
  Q169460: "western-asia", // Miletus
  Q107557833: "western-asia", // Sinope
  Q2022162: "western-asia", // Kingdom of Pergamon
  Q975405: "western-asia", // Sultanate of Rum
  Q169977: "western-asia", // Hejaz
  Q16000109: "western-asia", // Herodian Kingdom of Judea
  Q796: "western-asia", // Iraq
  Q3108185: "western-asia", // Ba'athist Iraq
  Q801: "western-asia", // Israel
  Q810: "western-asia", // Jordan
  Q55502: "western-asia", // Kingdom of Jerusalem
  Q817: "western-asia", // Kuwait
  Q822: "western-asia", // Lebanon
  Q842: "western-asia", // Oman
  Q193714: "western-asia", // Mandatory Palestine
  Q23792: "western-asia", // Palestine
  Q219060: "western-asia", // Palestine
  Q12560: "western-asia", // Ottoman Empire
  Q846: "western-asia", // Qatar
  Q12490507: "western-asia", // Rashidun Caliphate
  Q851: "western-asia", // Saudi Arabia
  Q93180: "western-asia", // Seleucid Empire
  Q23427: "western-asia", // South Ossetia
  Q858: "western-asia", // Syria
  Q43: "western-asia", // Turkey
  Q8575586: "western-asia", // Umayyad Caliphate
  Q878: "western-asia", // United Arab Emirates
  Q805: "western-asia", // Yemen
  Q138573104: "western-asia", // Kingdom of Tyre

  // western-europe
  Q40: "western-europe", // Austria
  Q28513: "western-europe", // Austria-Hungary
  Q131964: "western-europe", // Austrian Empire
  Q31: "western-europe", // Belgium
  Q207162: "western-europe", // Bourbon Restoration in France
  Q31929: "western-europe", // Carolingian Empire
  Q47261: "western-europe", // Duchy of Bavaria
  Q170072: "western-europe", // Dutch Republic
  Q142: "western-europe", // France
  Q146246: "western-europe", // Francia
  Q70972: "western-europe", // Kingdom of France
  Q58296: "western-europe", // French First Republic
  Q71092: "western-europe", // Second French Empire
  Q16957: "western-europe", // German Democratic Republic
  Q43287: "western-europe", // German Empire
  Q1206012: "western-europe", // German Reich
  Q183: "western-europe", // Germany
  Q7318: "western-europe", // Nazi Germany
  Q41304: "western-europe", // Weimar Republic
  Q153136: "western-europe", // Habsburg monarchy
  Q1031430: "western-europe", // Habsburg Netherlands
  Q12548: "western-europe", // Holy Roman Empire
  Q347: "western-europe", // Liechtenstein
  Q6673921: "western-europe", // Lotharingia
  Q32: "western-europe", // Luxembourg
  Q235: "western-europe", // Monaco
  Q27996474: "western-europe", // Northern Low Countries
  Q6581823: "western-europe", // Southern Netherlands
  Q622783: "western-europe", // Spanish Netherlands
  Q330533: "western-europe", // Seventeen Provinces
  Q55: "western-europe", // Netherlands
  Q29999: "western-europe", // Kingdom of the Netherlands
  Q15864: "western-europe", // United Kingdom of the Netherlands
  Q435583: "western-europe", // Old Swiss Confederacy
  Q39: "western-europe", // Switzerland
  Q27306: "western-europe", // Kingdom of Prussia
  Q38872: "western-europe", // Prussia
  Q153015: "western-europe", // Kingdom of Saxony
  Q1247508: "western-europe", // Romain-Gaul domain of Soissons
  Q46370: "western-europe", // West Francia
  Q636389: "western-europe", // Archbishopric of Magdeburg
};
