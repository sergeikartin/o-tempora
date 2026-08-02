import type { Category } from "@same-sky/shared-types";

// Explicit Wikidata occupation Q-ID -> app Category, built by hand against
// the distinct occupation Q-IDs actually present in the grouped people pool
// (see list-unmapped-occupations.ts). Necessarily lossy — Wikidata has far
// more specific occupation values than the app's 8 fixed categories.
export const OCCUPATION_CATEGORIES: Record<string, Category> = {
  // science
  Q4773904: "science", // anthropologist
  Q11063: "science", // astronomer
  Q155647: "science", // astrologer
  Q15954519: "science", // alchemist
  Q10872101: "science", // anatomist
  Q806798: "science", // banker
  Q2374149: "science", // botanist
  Q593644: "science", // chemist
  Q15442776: "science", // cryptographer
  Q16390131: "science", // cryptologist
  Q1350189: "science", // Egyptologist
  Q188094: "science", // economist
  Q901402: "science", // geographer
  Q18524037: "science", // Indologist
  Q170790: "science", // mathematician
  Q18805: "science", // naturalist
  Q88208585: "science", // natural philosopher
  Q2004963: "science", // numismatist
  Q105186: "science", // pharmacist
  Q1251349: "science", // personal physician
  Q39631: "science", // physician
  Q551835: "science", // physician writer
  Q169470: "science", // physicist
  Q2055046: "science", // physiologist
  Q211346: "science", // psychiatrist
  Q212980: "science", // psychologist
  Q2920595: "science", // sexologist
  Q20826540: "science", // scholar
  Q901: "science", // scientist
  Q15319501: "science", // social scientist
  Q2306091: "science", // sociologist
  Q1238570: "science", // political scientist
  Q3133901: "science", // herbalist
  Q2518689: "science", // healer
  Q774306: "science", // surgeon
  Q350979: "science", // zoologist
  Q14467526: "science", // linguist
  Q17598791: "science", // latinist
  Q13418253: "science", // philologist

  // politics
  Q2994387: "politics", // adviser
  Q166382: "politics", // Amir
  Q2478141: "politics", // aristocrat
  Q48352: "politics", // head of state
  Q65997: "politics", // caliph -- kept political too, see religion note below (removed, see religion)
  Q207978: "politics", // consul
  Q212238: "politics", // civil servant
  Q1511216: "politics", // courtier
  Q193391: "politics", // diplomat
  Q39018: "politics", // emperor
  Q179294: "politics", // eunuch
  Q132050: "politics", // governor
  Q609016: "politics", // hofmeister
  Q16533: "politics", // judge
  Q185351: "politics", // jurist
  Q6345855: "politics", // kadi
  Q181888: "politics", // khan
  Q12097: "politics", // king
  Q715222: "politics", // lady-in-waiting
  Q1251441: "politics", // leader
  Q16012028: "politics", // legal scholar
  Q4175034: "politics", // legislator
  Q40348: "politics", // lawyer
  Q1886285: "politics", // Mansa
  Q116: "politics", // monarch
  Q148057: "politics", // national hero
  Q599151: "politics", // official
  Q12859263: "politics", // orator
  Q37110: "politics", // pharaoh
  Q23760244: "politics", // philosopher of law
  Q15994177: "politics", // political theorist
  Q82955: "politics", // politician
  Q719039: "politics", // queen consort
  Q19643: "politics", // queen regnant
  Q477406: "politics", // regent
  Q124985058: "politics", // reformer
  Q16611574: "politics", // social reformer
  Q1097498: "politics", // ruler
  Q11573099: "politics", // royalty
  Q372436: "politics", // statesperson
  Q43292: "politics", // sultan
  Q2304859: "politics", // sovereign
  Q1259323: "politics", // traditional leader or chief
  Q361809: "politics", // rhetorician
  Q14866863: "politics", // international law scholar
  Q217029: "politics", // qadi
  Q3570351: "politics", // Dayan

  // art
  Q483501: "art", // artist
  Q3391743: "art", // visual artist
  Q1028181: "art", // painter
  Q1281618: "art", // sculptor
  Q36834: "art", // composer
  Q639669: "art", // musician
  Q177220: "art", // singer
  Q36180: "art", // writer
  Q49757: "art", // poet
  Q6625963: "art", // novelist
  Q214917: "art", // playwright
  Q482980: "art", // author
  Q644687: "art", // illustrator
  Q329439: "art", // engraver
  Q11569986: "art", // printmaker
  Q13365770: "art", // copper engraver
  Q47005195: "art", // wood engraver
  Q10862983: "art", // etcher
  Q3658608: "art", // caricaturist
  Q3303330: "art", // calligrapher
  Q1734662: "art", // cartographer
  Q42973: "art", // architect
  Q2079935: "art", // architectural drafter
  Q17391659: "art", // architectural theoretician
  Q158852: "art", // conductor
  Q765778: "art", // organist
  Q1076502: "art", // choir director
  Q215793: "art", // chapelmaster
  Q16031530: "art", // music theorist
  Q16145150: "art", // music educator
  Q14915627: "art", // musicologist
  Q822146: "art", // lyricist
  Q753110: "art", // songwriter
  Q8178443: "art", // librettist
  Q487596: "art", // dramaturge
  Q3387717: "art", // theatre director
  Q11613590: "art", // theatre designer
  Q1925963: "art", // graphic artist
  Q5322166: "art", // designer
  Q998628: "art", // illuminator
  Q22669155: "art", // fresco painter
  Q984276: "art", // court painter
  Q1229025: "art", // typographer
  Q3606216: "art", // aphorist
  Q11774202: "art", // essayist
  Q11774156: "art", // memoirist
  Q18814623: "art", // autobiographer
  Q864380: "art", // biographer
  Q18939491: "art", // diarist
  Q3330547: "art", // chronicler
  Q11914886: "art", // comedy writer
  Q22073916: "art", // tragedy writer
  Q15949613: "art", // short story writer
  Q12144794: "art", // prose writer
  Q9334029: "art", // satirist
  Q12406482: "art", // humorist
  Q3064032: "art", // fabulist
  Q24387326: "art", // mythographer
  Q16868675: "art", // elegist
  Q936371: "art", // rhapsode
  Q26237228: "art", // epigrammatist
  Q69423232: "art", // film screenwriter
  Q333634: "art", // translator
  Q15472169: "art", // patron of the arts

  // philosophy
  Q4964182: "philosophy", // philosopher
  Q5403434: "philosophy", // ethicist
  Q14565331: "philosophy", // logician
  Q10527030: "philosophy", // humanist
  Q58968: "philosophy", // intellectual
  Q270141: "philosophy", // polymath
  Q21550346: "philosophy", // aesthetician
  Q3750514: "philosophy", // sophist
  Q37226: "philosophy", // teacher
  Q1231865: "philosophy", // pedagogue
  Q1622272: "philosophy", // university teacher
  Q182436: "philosophy", // librarian
  Q635734: "philosophy", // archivist
  Q201788: "philosophy", // historian
  Q1792450: "philosophy", // art historian
  Q1743122: "philosophy", // church historian
  Q29514511: "philosophy", // compiler
  Q17391638: "philosophy", // art theorist

  // war
  Q47064: "war", // military personnel
  Q189290: "war", // military officer
  Q11545923: "war", // military commander
  Q1402561: "war", // military leader
  Q12806039: "war", // military theorist
  Q151197: "war", // military engineer
  Q10669499: "war", // naval officer
  Q38239859: "war", // army officer
  Q4991371: "war", // soldier
  Q1250916: "war", // warrior
  Q178197: "war", // mercenary
  Q482999: "war", // gladiator
  Q3683504: "war", // Conqueror
  Q30242234: "war", // freedom fighter
  Q4070283: "war", // artillerist
  Q102083: "war", // knight
  Q1678054: "war", // Miles Christianus
  Q1365214: "war", // dragonslayer
  Q725434: "war", // imperator

  // invention
  Q205375: "invention", // inventor
  Q81096: "invention", // engineer
  Q327029: "invention", // mechanic
  Q1639825: "invention", // blacksmith
  Q154549: "invention", // carpenter
  Q437512: "invention", // weaver
  Q211423: "invention", // goldsmith
  Q1340643: "invention", // master builder
  Q7695510: "invention", // tektōn
  Q1294787: "invention", // artisan
  Q289612: "invention", // general contractor
  Q40881196: "invention", // book printer
  Q1585575: "invention", // master of calculations
  Q1463475: "invention", // mintmaster

  // exploration
  Q11900058: "exploration", // explorer
  Q254651: "exploration", // navigator
  Q45199: "exploration", // sailor
  Q12038843: "exploration", // seafarer
  Q12356615: "exploration", // traveler
  Q1937330: "exploration", // world traveler
  Q9149093: "exploration", // mountaineer
  Q1344452: "exploration", // discoverer

  // religion
  Q1646408: "religion", // abbess
  Q1146843: "religion", // anchorite
  Q3409374: "religion", // ancient Roman priest
  Q3409375: "religion", // Anglican priest
  Q619553: "religion", // apologist
  Q43412: "religion", // apostle
  Q49476: "religion", // archbishop
  Q854997: "religion", // Buddhist monk
  Q24262584: "religion", // Bible translator
  Q19829990: "religion", // biblical scholar
  Q29182: "religion", // bishop
  Q1104153: "religion", // canon
  Q1237385: "religion", // canon
  Q611644: "religion", // Catholic bishop
  Q105200214: "religion", // Catholic clergyman
  Q25393460: "religion", // Catholic deacon
  Q250867: "religion", // Catholic priest
  Q98833890: "religion", // Catholic theologian
  Q130751312: "religion", // Christian reformer
  Q182603: "religion", // Church Fathers
  Q2259532: "religion", // cleric
  Q3262402: "religion", // cloistered nun
  Q188711: "religion", // companions of the Prophet
  Q161944: "religion", // deacon
  Q192499: "religion", // Doctor of the Church
  Q1234713: "religion", // theologian
  Q42603: "religion", // priest
  Q116865146: "religion", // Taoist
  Q432386: "religion", // preacher
  Q2142783: "religion", // founder of religion
  Q15995642: "religion", // religious leader
  Q29352392: "religion", // spiritual teacher
  Q105085644: "religion", // ecclesiastical writer (no en label; de/no/gl labels confirm)
  Q42857: "religion", // prophet
  Q51626: "religion", // messiah
  Q133485: "religion", // rabbi
  Q352507: "religion", // pastor
  Q152002: "religion", // pastor
  Q1349880: "religion", // thaumaturge
  Q219477: "religion", // missionary
  Q733786: "religion", // monk
  Q13424456: "religion", // hymnwriter
  Q17166634: "religion", // hagiographer
  Q948657: "religion", // titular bishop
  Q125482: "religion", // imam
  Q1172458: "religion", // muhaddith
  Q1999841: "religion", // Islamic jurist
  Q6090396: "religion", // Qur'anic exegete
  Q47740: "religion", // Muslim
  Q1469535: "religion", // Latin Catholic priest
  Q831474: "religion", // presbyter
  Q191808: "religion", // nun
  Q12328016: "religion", // mystic
  Q2892720: "religion", // Sufi
  Q12270170: "religion", // mutakallim
  Q97722145: "religion", // Latin Catholic monk
  Q171692: "religion", // patriarch
  Q2566598: "religion", // religious (member of a religious order)
  Q955464: "religion", // parson
  Q484260: "religion", // guru
  Q189459: "religion", // ulema
  Q55631411: "religion", // religious sister
  Q542704: "religion", // pilgrim
  Q2138822: "religion", // regular cleric
  Q2450226: "religion", // founder of Catholic religious community
  Q24262594: "religion", // religious writer
  Q105200154: "religion", // Roman Catholic cleric
  Q7834465: "religion", // transitional deacon
  Q763779: "religion", // Protestant reformer
  Q4381978: "religion", // Lady Margaret's Professor of Divinity

  // No "commerce" category exists in the app's fixed set; merchant/trade
  // occupations are grouped under invention (industry/craft) as the closest
  // fit — a judgment call, not a real Wikidata signal, same spirit as the
  // "historical event" catch-all noted in event-type-categories.ts.
  Q43845: "invention", // businessperson
  Q29051324: "invention", // wholesale merchant
  Q215536: "invention", // merchant
  Q916292: "invention", // scribe (copying as a craft)

  // journalism/publishing/drafting have no clean category home either;
  // grouped under art as the nearest fit (written/visual craft).
  Q1930187: "art", // journalist
  Q124634459: "art", // journal editor
  Q15296811: "art", // draftsperson
  Q107212688: "art", // exlibrist
  Q115793211: "art", // independent publisher
  Q1708232: "art", // medalist (medal engraver)

  Q4479442: "politics", // founder (of a state/dynasty, generic sense)
  Q12866868: "politics", // Mechurchletukhutsesi (medieval Georgian royal treasurer)
  Q71049101: "philosophy", // bohemicist (scholar of Bohemian/Czech studies)

  // No "sport" category exists either; historical athlete entries on
  // Wikidata are overwhelmingly ancient-Greek competitors in martial
  // events (wrestling, pankration, javelin) — grouped under war as the
  // nearest fit, a judgment call like the ones above.
  Q2066131: "war", // athlete
};
