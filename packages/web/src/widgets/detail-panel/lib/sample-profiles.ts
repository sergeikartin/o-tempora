import type { Profile } from './profile';

// Hand-written sample Profiles for the panel prototype, keyed by entity slug.
// Not pipeline output; replaced by the shipped Profile data.
export const SAMPLE_PROFILES: Readonly<Record<string, Profile>> = {
  'isaac-newton': {
    overview:
      'Isaac Newton was an English mathematician and natural philosopher who worked out the laws of motion and universal gravitation and, alongside Leibniz, invented calculus. His Principia showed that one set of rules governs a falling apple and the orbit of the Moon. He later ran the Royal Mint and presided over the Royal Society.',
    keyMoments: [
      {
        date: '1665–1666',
        title: 'Two years at home',
        text: 'When **Cambridge closed during the Great Plague**, Newton went home to Woolsthorpe in Lincolnshire. In those months he later said he found the **early form of calculus**, began his work on **light**, and first turned his thoughts to **gravity**. The apple story comes from his own recollections decades afterwards.',
      },
      {
        date: '1672',
        title: 'White light is a mixture',
        text: 'A reflecting telescope he had built won Newton election to the Royal Society, and his first paper there used two prisms to show that **white light is made of every colour**, which the prism sorts rather than stains. **Robert Hooke** attacked it, and the two were enemies for the rest of Hooke’s life.',
      },
      {
        date: '1687',
        title: 'The Principia',
        text: 'Urged on by Edmond Halley, Newton published **Philosophiæ Naturalis Principia Mathematica**, setting out the **three laws of motion** and **universal gravitation**. The same mathematics explained Kepler’s planetary laws and the tides. Halley paid for the printing himself, because the Royal Society had spent its money on a book about fish.',
      },
      {
        date: '1696–1727',
        title: 'London and the Mint',
        text: 'Newton left Cambridge to become warden, then master, of the **Royal Mint** during the **Great Recoinage**, and from 1703 was **president of the Royal Society**. He treated counterfeiting as a personal enemy and **sent the coiner William Chaloner to the gallows in 1699**.',
      },
    ],
    deepFacts: [
      {
        text: 'The fight with Leibniz over who invented calculus grew so bitter that in 1712 the Royal Society appointed a committee to judge it. Newton, its president, wrote the committee’s report himself, anonymously, and then wrote an anonymous review praising it.',
        isLegend: false,
      },
      {
        text: 'A large share of Newton’s surviving papers deal with alchemy and theology rather than physics. When the economist John Maynard Keynes bought some of them at auction in 1936, he came to call Newton “the last of the magicians”, not the first of the age of reason.',
        isLegend: false,
      },
      {
        text: 'No apple hit Newton on the head. The nearest source is William Stukeley’s account of a conversation in 1726, in which Newton recalls only watching an apple fall straight down in a garden and wondering why it did not go sideways or up.',
        isLegend: true,
      },
    ],
    connections: [
      {
        slug: 'gottfried-wilhelm-leibniz',
        reason:
          'Invented calculus independently; their priority dispute split British and continental mathematicians for a generation.',
      },
      {
        slug: 'johannes-kepler',
        reason:
          'His three laws of planetary motion were what the Principia’s gravity was shown to explain.',
      },
      {
        slug: 'galileo-galilei',
        reason:
          'Died in the year Newton was born; Newton’s laws of motion build on his work on falling bodies and inertia.',
      },
      {
        slug: 'edmond-halley',
        reason:
          'Pressed Newton to write the Principia and paid for its printing in 1687.',
      },
      {
        slug: 'robert-hooke',
        reason:
          'Quarrelled with Newton over light and over who first saw that gravity weakens with the square of distance.',
      },
      {
        slug: 'philosophi-naturalis-principia-mathematica',
        reason:
          'The 1687 book that set out the laws of motion and universal gravitation.',
      },
      {
        slug: 'scientific-revolution',
        reason: 'The Principia is often taken as the movement’s culmination.',
      },
    ],
  },
  'galileo-galilei': {
    overview:
      'Galileo Galilei was an Italian astronomer, physicist and engineer from Pisa. Turning one of the first telescopes on the sky, he found moons around Jupiter and mountains on the Moon, and argued for a Sun-centred universe, which brought him before the Roman Inquisition. He spent his last years under house arrest near Florence, still writing the book that founded the physics of motion.',
    keyMoments: [
      {
        date: '1609–1610',
        title: 'A telescope pointed at the sky',
        text: 'Hearing of a Dutch spyglass, Galileo built his own and improved it to about **twenty times magnification**. In January 1610 he saw **four moons circling Jupiter**, and rushed out **The Starry Messenger** that March. He named the moons for the Medici family, and it won him a post at their court in Florence.',
      },
      {
        date: '1616',
        title: 'A warning from Rome',
        text: 'The Church’s Congregation of the Index declared the Sun-centred system **false and contrary to Scripture** and suspended Copernicus’s book until it was corrected. Cardinal Bellarmine told Galileo **not to hold or defend the idea**, though he could still treat it as a mathematical supposition.',
      },
      {
        date: '1632–1633',
        title: 'The Dialogue and the trial',
        text: 'Galileo published the **Dialogue Concerning the Two Chief World Systems**, a conversation that plainly favoured Copernicus. Summoned to Rome, he was found **“vehemently suspect of heresy”** in 1633, forced to recant, and confined to house arrest for life. Many readers saw the pope’s own favourite argument in the mouth of Simplicio, the book’s slow-witted defender of the old view.',
      },
      {
        date: '1638',
        title: 'Two New Sciences',
        text: 'Banned from publishing in Italy, Galileo had his last book printed in **Leiden**. **Two New Sciences** laid out the mathematics of **falling bodies** and the **strength of materials**, and he dictated much of it **after going blind**.',
      },
    ],
    deepFacts: [
      {
        text: 'His eldest daughter Virginia entered a convent and took the name Sister Maria Celeste. About a hundred and twenty of her letters to her father survive, full of requests for sweets and lemons and news of the household. His letters to her do not.',
        isLegend: false,
      },
      {
        text: 'When his body was moved to a grand tomb in Santa Croce in 1737, admirers removed three fingers, a tooth and a vertebra. The middle finger of his right hand is now displayed in a glass case at the Museo Galileo in Florence, pointing at the sky.',
        isLegend: false,
      },
      {
        text: 'The story goes that in 1583, as a student in Pisa Cathedral, Galileo timed a swinging lamp against his own pulse and noticed that each swing took the same time however wide. It comes from the biography his pupil Vincenzo Viviani wrote decades later.',
        isLegend: true,
      },
    ],
    connections: [
      {
        slug: 'nicolaus-copernicus',
        reason:
          'His Sun-centred system is what the Dialogue defends, and what the Church condemned.',
      },
      {
        slug: 'johannes-kepler',
        reason:
          'Backed the discovery of Jupiter’s moons in print in 1610, when few astronomers would.',
      },
      {
        slug: 'isaac-newton',
        reason:
          'Built the laws of motion on Galileo’s work on falling bodies and inertia.',
      },
      {
        slug: 'galileo-affair',
        reason: 'The 1633 trial and condemnation that followed the Dialogue.',
      },
      {
        slug: 'copernican-heliocentrism',
        reason: 'The theory he was condemned for defending.',
      },
      {
        slug: 'scientific-revolution',
        reason:
          'His telescope and his mathematics of motion are two of its foundations.',
      },
    ],
  },
  'nicolaus-copernicus': {
    overview:
      'Nicolaus Copernicus was a Renaissance astronomer and church administrator from Toruń, in Royal Prussia, who proposed that the Earth and the other planets orbit the Sun. He worked it out over decades in private while serving the cathedral chapter at Frombork, and printed it only in the year he died.',
    keyMoments: [
      {
        date: 'c. 1514',
        title: 'A sketch for friends',
        text: 'Copernicus circulated a short manuscript, the **Commentariolus**, outlining a **Sun-centred system** in seven plain assumptions and leaving the mathematics out. It was copied among a few scholars and **never printed in his lifetime**.',
      },
      {
        date: '1539–1541',
        title: 'A young mathematician at the door',
        text: 'The Wittenberg mathematician **Georg Joachim Rheticus** travelled to Frombork to learn of the new system, stayed for two years, and in 1540 published a **first public account** of it. That pushed the ageing Copernicus to let the full book go to the printer.',
      },
      {
        date: '1543',
        title: 'On the Revolutions',
        text: '**De revolutionibus orbium coelestium** was printed in Nuremberg, setting out the Sun-centred model with full mathematics. The theologian Andreas Osiander added an **unsigned preface** calling it a mere calculating device, so many early readers thought Copernicus had said so himself.',
      },
    ],
    deepFacts: [
      {
        text: 'Long before his astronomy was settled, Copernicus wrote on money. In 1526 he argued that coins debased by cheap metal drive good coins out of circulation, a version of what is now called Gresham’s law, and that printing too much money raises prices.',
        isLegend: false,
      },
      {
        text: 'His grave was lost until a skull was found near an altar in Frombork Cathedral in 2005. It was identified in 2008 by matching its DNA to hairs found in a book he had owned, and in 2010 he was reburied there beneath a black granite stone showing the Sun-centred system.',
        isLegend: false,
      },
      {
        text: 'The story says a printed copy of De revolutionibus was put into his hands on 24 May 1543, the day he died, after he had lost consciousness. The tale comes from later accounts and has never been confirmed.',
        isLegend: true,
      },
    ],
    connections: [
      {
        slug: 'galileo-galilei',
        reason:
          'Took up his Sun-centred system and defended it, at the cost of his freedom.',
      },
      {
        slug: 'johannes-kepler',
        reason: 'Replaced the circles of the Copernican system with ellipses.',
      },
      {
        slug: 'tycho-brahe',
        reason:
          'Admired the mathematics but rejected a moving Earth, and proposed a rival compromise system.',
      },
      {
        slug: 'copernican-heliocentrism',
        reason: 'The theory itself, set out in De revolutionibus.',
      },
      {
        slug: 'scientific-revolution',
        reason:
          'Many historians date its start to the book’s printing in 1543.',
      },
    ],
  },
};
