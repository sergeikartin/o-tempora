import type { Region } from "@same-sky/shared-types";

// Explicit Wikidata country/state Q-ID -> app Region, built by hand against
// the distinct country Q-IDs actually present in the grouped pool (see
// list-unmapped-countries.ts). Historical polities are mapped to the region
// their territory geographically corresponds to, not a current-day
// successor state's name. Oceania/Australia has no region in the app's
// fixed set (per project-overview.md) — those Q-IDs are deliberately left
// unmapped, resolving to "no region" rather than inventing a ninth region.
export const REGION_CATEGORIES: Record<string, Region> = {
  // europe
  Q222: "europe", // Albania
  Q40: "europe", // Austria
  Q28513: "europe", // Austria-Hungary
  Q131964: "europe", // Austrian Empire
  Q184: "europe", // Belarus
  Q31: "europe", // Belgium
  Q225: "europe", // Bosnia and Herzegovina
  Q1274468: "europe", // Republic of Bosnia and Herzegovina
  Q207162: "europe", // Bourbon Restoration in France
  Q8680: "europe", // British Empire
  Q219: "europe", // Bulgaria
  Q420759: "europe", // Second Bulgarian Empire
  Q12544: "europe", // Byzantine Empire
  Q31929: "europe", // Carolingian Empire
  Q224: "europe", // Croatia
  Q204920: "europe", // Crown of Aragon
  Q217196: "europe", // Crown of Castile
  Q213: "europe", // Czech Republic
  Q33946: "europe", // Czechoslovakia
  Q152750: "europe", // Protectorate of Bohemia and Moravia
  Q42585: "europe", // Kingdom of Bohemia
  Q35: "europe", // Denmark
  Q756617: "europe", // Kingdom of Denmark
  Q16150196: "europe", // Donetsk People's Republic
  Q47261: "europe", // Duchy of Bavaria
  Q693570: "europe", // Duchy of Ferrara
  Q153529: "europe", // Duchy of Milan
  Q170072: "europe", // Dutch Republic
  Q191: "europe", // Estonia
  Q33: "europe", // Finland
  Q142: "europe", // France
  Q146246: "europe", // Francia
  Q70972: "europe", // Kingdom of France
  Q501303: "europe", // Free City of Krakow
  Q58296: "europe", // French First Republic
  Q71092: "europe", // Second French Empire
  Q230: "europe", // Georgia
  Q154667: "europe", // Kingdom of Georgia
  Q16957: "europe", // German Democratic Republic
  Q43287: "europe", // German Empire
  Q1206012: "europe", // German Reich
  Q183: "europe", // Germany
  Q7318: "europe", // Nazi Germany
  Q41304: "europe", // Weimar Republic
  Q154849: "europe", // Grand Duchy of Tuscany
  Q170770: "europe", // Grand Principality of Moscow
  Q83546: "europe", // Grand Principality of Vladimir
  Q41: "europe", // Greece
  Q223: "europe", // Greenland
  Q153136: "europe", // Habsburg monarchy
  Q1031430: "europe", // Habsburg Netherlands
  Q766543: "europe", // Hispanic Monarchy
  Q12548: "europe", // Holy Roman Empire
  Q3355522: "europe", // Hospitaller Malta
  Q28: "europe", // Hungary
  Q171150: "europe", // Kingdom of Hungary
  Q600018: "europe", // Kingdom of Hungary
  Q16056854: "europe", // Kingdom of Hungary
  Q10295972: "europe", // Hunnic Empire
  Q189: "europe", // Iceland
  Q62389: "europe", // Icelandic Commonwealth
  Q27: "europe", // Ireland
  Q215530: "europe", // Kingdom of Ireland
  Q38: "europe", // Italy
  Q172579: "europe", // Kingdom of Italy
  Q838931: "europe", // Kingdom of Italy
  Q148540: "europe", // Republic of Florence
  Q174306: "europe", // Republic of Genoa
  Q1365493: "europe", // Republic of Pisa
  Q4948: "europe", // Republic of Venice
  Q1108445: "europe", // Kievan Rus'
  Q200262: "europe", // Kingdom of Navarre
  Q107299: "europe", // Kingdom of Northumbria
  Q105313: "europe", // Kingdom of Wessex
  Q161885: "europe", // Kingdom of Great Britain
  Q174193: "europe", // United Kingdom of Great Britain and Ireland
  Q179876: "europe", // Kingdom of England
  Q230791: "europe", // Kingdom of Scotland
  Q1649871: "europe", // Kingdom of Poland
  Q45670: "europe", // Kingdom of Portugal
  Q27306: "europe", // Kingdom of Prussia
  Q38872: "europe", // Prussia
  Q153015: "europe", // Kingdom of Saxony
  Q188586: "europe", // Kingdom of Sicily
  Q3399982: "europe", // Kingdom of Spain
  Q29999: "europe", // Kingdom of the Netherlands
  Q15864: "europe", // United Kingdom of the Netherlands
  Q2940142: "europe", // Kingdom of Toledo
  Q178897: "europe", // Latin Empire
  Q211: "europe", // Latvia
  Q37: "europe", // Lithuania
  Q6673921: "europe", // Lotharingia
  Q16746854: "europe", // Luhansk People's Republic
  Q83958: "europe", // Macedonia
  Q13405524: "europe", // Macedonian Empire
  Q233: "europe", // Malta
  Q221: "europe", // North Macedonia
  Q23681: "europe", // Northern Cyprus
  Q229: "europe", // Cyprus
  Q27996474: "europe", // Northern Low Countries
  Q6581823: "europe", // Southern Netherlands
  Q622783: "europe", // Spanish Netherlands
  Q330533: "europe", // Seventeen Provinces
  Q55: "europe", // Netherlands
  Q20: "europe", // Norway
  Q435583: "europe", // Old Swiss Confederacy
  Q39: "europe", // Switzerland
  Q583038: "europe", // Ostrogothic Kingdom
  Q42834: "europe", // Western Roman Empire
  Q1747689: "europe", // Ancient Rome
  Q36: "europe", // Poland
  Q211274: "europe", // Polish People's Republic
  Q45: "europe", // Portugal
  Q1483510: "europe", // Principality of Wales
  Q389004: "europe", // Principality of Wallachia
  Q124653007: "europe", // realm of the United Kingdom
  Q145: "europe", // United Kingdom
  Q31354462: "europe", // Republic of Abkhazia
  Q244165: "europe", // Republic of Artsakh
  Q15925436: "europe", // Republic of Crimea
  Q1247508: "europe", // Romain-Gaul domain of Soissons
  Q218: "europe", // Romania
  Q159: "europe", // Russia
  Q34266: "europe", // Russian Empire
  Q139319: "europe", // Russian Republic
  Q2305208: "europe", // Russian Socialist Federative Soviet Republic
  Q15180: "europe", // Soviet Union
  Q186096: "europe", // Tsardom of Russia
  Q403: "europe", // Serbia
  Q878319: "europe", // Serbian Despotate
  Q214: "europe", // Slovakia
  Q215: "europe", // Slovenia
  Q23427: "europe", // South Ossetia
  Q29: "europe", // Spain
  Q80702: "europe", // Spanish Empire
  Q6123746: "europe", // Spanish Republic at War
  Q34: "europe", // Sweden
  Q215443: "europe", // Swedish Empire
  Q212: "europe", // Ukraine
  Q243610: "europe", // Ukrainian People's Republic
  Q457167: "europe", // West Ukrainian People's Republic
  Q114318324: "europe", // Kherson Oblast
  Q114318415: "europe", // Zaporozhye Oblast
  Q237: "europe", // Vatican City
  Q46370: "europe", // West Francia
  Q227: "europe", // Azerbaijan
  Q131337: "europe", // Azerbaijan Soviet Socialist Republic
  Q399: "europe", // Armenia
  Q244796: "europe", // Achaean League
  Q3606949: "europe", // Agyrion
  Q3607380: "europe", // Akragas
  Q833665: "europe", // Boeotian confederation
  Q11266977: "europe", // Epirus
  Q4420718: "europe", // Syracuse
  Q5690: "europe", // Sparta
  Q844930: "europe", // Classical Athens
  Q1247159: "europe", // Messenia
  Q42295059: "europe", // Mytilene
  Q13580795: "europe", // Samos
  Q636389: "europe", // Archbishopric of Magdeburg
  Q1743884: "europe", // Kition (Cyprus)
  Q170174: "europe", // Papal States

  // east-asia
  Q29520: "east-asia", // China
  Q148: "east-asia", // People's Republic of China
  Q13426199: "east-asia", // Republic of China
  Q17: "east-asia", // Japan
  Q188712: "east-asia", // Empire of Japan
  Q30623: "east-asia", // Manchukuo
  Q9903: "east-asia", // Ming dynasty
  Q7462: "east-asia", // Song dynasty
  Q1065073: "east-asia", // Song
  Q9683: "east-asia", // Tang dynasty
  Q8733: "east-asia", // Qing dynasty
  Q7183: "east-asia", // Qin dynasty
  Q34756: "east-asia", // Qin
  Q837855: "east-asia", // Qi
  Q912068: "east-asia", // Wu
  Q736936: "east-asia", // Lu
  Q227007: "east-asia", // Zhu
  Q35216: "east-asia", // Zhou dynasty
  Q1072949: "east-asia", // Western Han
  Q504769: "east-asia", // Xin dynasty
  Q7313: "east-asia", // Yuan dynasty
  Q711: "east-asia", // Mongolia
  Q12557: "east-asia", // Mongol Empire
  Q212056: "east-asia", // Mongolian People's Republic
  Q423: "east-asia", // North Korea
  Q884: "east-asia", // South Korea
  Q491559: "east-asia", // First Republic of South Korea
  Q484104: "east-asia", // United States Army Military Government in Korea
  Q865: "east-asia", // Taiwan
  Q2444884: "east-asia", // Tibet

  // south-asia (incl. Southeast Asia, uncovered by the fixed 6-region set)
  Q889: "south-asia", // Afghanistan
  Q1415128: "south-asia", // Republic of Afghanistan
  Q902: "south-asia", // Bangladesh
  Q129286: "south-asia", // British Raj
  Q112660052: "south-asia", // British India
  Q668: "south-asia", // India
  Q252: "south-asia", // Indonesia
  Q2320255: "south-asia", // Islamic Emirate of Waziristan
  Q813: "south-asia", // Kyrgyzstan
  Q874: "south-asia", // Turkmenistan
  Q62943: "south-asia", // Maurya empire
  Q836: "south-asia", // Myanmar
  Q843: "south-asia", // Pakistan
  Q928: "south-asia", // Philippines
  Q334: "south-asia", // Singapore
  Q881: "south-asia", // Vietnam
  Q180573: "south-asia", // South Vietnam
  Q185682: "south-asia", // French Indochina
  Q1081620: "south-asia", // Siam
  Q833: "south-asia", // Malaysia
  Q871091: "south-asia", // British Malaya

  // middle-east
  Q12536: "middle-east", // Abbasid Caliphate
  Q389688: "middle-east", // Achaemenid Empire
  Q569107: "middle-east", // Anshan Persia
  Q555994: "middle-east", // Aq Qoyunlu
  Q63135869: "middle-east", // Ayyubid Sultanate
  Q47690: "middle-east", // Babylonia
  Q624887: "middle-east", // Neo-Babylonian Empire
  Q79: "middle-east", // Egypt
  Q11768: "middle-east", // Ancient Egypt
  Q127861: "middle-east", // Khedivate of Egypt
  Q124943: "middle-east", // Kingdom of Egypt
  Q177819: "middle-east", // Old Kingdom of Egypt
  Q3087763: "middle-east", // Republic of Egypt
  Q370173: "middle-east", // Sultanate of Egypt
  Q2320005: "middle-east", // Ptolemaic Kingdom
  Q160307: "middle-east", // Fatimid Caliphate
  Q47611: "middle-east", // Ephesus
  Q5843680: "middle-east", // Halicarnassus
  Q169460: "middle-east", // Miletus
  Q107557833: "middle-east", // Sinope
  Q679305: "middle-east", // Cyme
  Q2022162: "middle-east", // Kingdom of Pergamon
  Q975405: "middle-east", // Sultanate of Rum
  Q249578: "middle-east", // Ghaznavid Empire
  Q169977: "middle-east", // Hejaz
  Q16000109: "middle-east", // Herodian Kingdom of Judea
  Q794: "middle-east", // Iran
  Q18234383: "middle-east", // Safavid Iran
  Q796: "middle-east", // Iraq
  Q3108185: "middle-east", // Ba'athist Iraq
  Q801: "middle-east", // Israel
  Q810: "middle-east", // Jordan
  Q55502: "middle-east", // Kingdom of Jerusalem
  Q822: "middle-east", // Lebanon
  Q193714: "middle-east", // Mandatory Palestine
  Q23792: "middle-east", // Palestine
  Q219060: "middle-east", // Palestine
  Q12560: "middle-east", // Ottoman Empire
  Q846: "middle-east", // Qatar
  Q12490507: "middle-east", // Rashidun Caliphate
  Q12150341: "middle-east", // Samanid Empire
  Q83891: "middle-east", // Sasanian Empire
  Q851: "middle-east", // Saudi Arabia
  Q93180: "middle-east", // Seleucid Empire
  Q3708094: "middle-east", // Seljuk Empire
  Q858: "middle-east", // Syria
  Q484195: "middle-east", // Timurid Empire
  Q43: "middle-east", // Turkey
  Q8575586: "middle-east", // Umayyad Caliphate
  Q805: "middle-east", // Yemen
  Q138573104: "middle-east", // Kingdom of Tyre

  // africa
  Q199688: "africa", // Almohad Caliphate
  Q2429397: "africa", // Ancient Carthage
  Q963: "africa", // Botswana
  Q1011: "africa", // Cape Verde
  Q974: "africa", // Democratic Republic of the Congo
  Q115: "africa", // Ethiopia
  Q207521: "africa", // Ethiopian Empire
  Q907234: "africa", // French protectorate in Morocco
  Q457242: "africa", // Spanish protectorate in Morocco
  Q153963: "africa", // German East Africa
  Q622855: "africa", // Ifriqiya
  Q284568: "africa", // Italian Libya
  Q1016: "africa", // Libya
  Q184536: "africa", // Mali Empire
  Q1045: "africa", // Somalia
  Q258: "africa", // South Africa
  Q1039: "africa", // Sao Tome and Principe
  Q924: "africa", // Tanzania
  Q948: "africa", // Tunisia
  Q1774: "africa", // Zanzibar Islands
  Q729768: "africa", // Zulu Kingdom

  // americas
  Q781: "americas", // Antigua and Barbuda
  Q414: "americas", // Argentina
  Q750: "americas", // Bolivia
  Q155: "americas", // Brazil
  Q258532: "americas", // British America
  Q16: "americas", // Canada
  Q298: "americas", // Chile
  Q739: "americas", // Colombia
  Q81931: "americas", // Confederate States of America
  Q800: "americas", // Costa Rica
  Q804: "americas", // Panama
  Q241: "americas", // Cuba
  Q786: "americas", // Dominican Republic
  Q736: "americas", // Ecuador
  Q769: "americas", // Grenada
  Q96: "americas", // Mexico
  Q811: "americas", // Nicaragua
  Q419: "americas", // Peru
  Q170604: "americas", // New France
  Q861551: "americas", // Saint-Domingue
  Q179997: "americas", // Thirteen Colonies
  Q30: "americas", // United States
  Q77: "americas", // Uruguay
  Q717: "americas", // Venezuela
  Q210551: "americas", // Viceroyalty of the Rio de la Plata
  Q2608489: "americas", // Aztec Empire
  Q26273: "americas", // Sint Maarten
};
