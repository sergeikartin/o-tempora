import { DETAIL_LEVELS } from '../../../shared/config';
import { m } from '../../../shared/paraglide/messages.js';
import {
  isSpanDate,
  type ProfileBody,
  parseBoldRuns,
  type ResolvedConnection,
} from '../lib/profile';
import styles from './ProfileView.module.css';

interface ProfileViewProps {
  profile: ProfileBody;
  // Lane color of the entity, for the Key Moment marks.
  color: string;
  connections: readonly ResolvedConnection[];
  onOpenConnection: (slug: string) => void;
}

function RichText({ text }: { text: string }) {
  return parseBoldRuns(text).map((run, index) =>
    run.isBold ? (
      // The runs are positional and never reorder.
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of a string
      <strong key={index}>{run.text}</strong>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of a string
      <span key={index}>{run.text}</span>
    ),
  );
}

// The four Detail Level pips of the Top Bar switch, filled up to the level the
// target first appears at.
function LevelPips({ levelIndex }: { levelIndex: number }) {
  return (
    <span className={styles.pips} aria-hidden="true">
      {DETAIL_LEVELS.map((level, index) => (
        <span
          key={level.id}
          className={index <= levelIndex ? styles.pipReached : styles.pip}
        />
      ))}
    </span>
  );
}

// The Profile sections that replace the Description in the detail panel:
// overview, Key Moments, Deep Facts and Connections.
export function ProfileView({
  profile,
  color,
  connections,
  onOpenConnection,
}: ProfileViewProps) {
  return (
    <div className={styles.profile}>
      <p className={styles.overview}>
        <RichText text={profile.overview} />
      </p>

      {profile.keyMoments.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{m.profileKeyMomentsHeading()}</h3>
          <ol className={styles.moments}>
            {profile.keyMoments.map((moment) => (
              <li key={moment.date + moment.title} className={styles.moment}>
                <span
                  className={
                    isSpanDate(moment.date) ? styles.spanMark : styles.pointMark
                  }
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <p className={styles.momentDate}>{moment.date}</p>
                <h4 className={styles.momentTitle}>{moment.title}</h4>
                <p className={styles.momentText}>
                  <RichText text={moment.text} />
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {profile.deepFacts.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{m.profileDeepFactsHeading()}</h3>
          <ul className={styles.facts}>
            {profile.deepFacts.map((fact) => (
              <li key={fact.text} className={styles.fact}>
                {fact.isLegend && (
                  <span className={styles.legendBadge}>
                    {m.profileLegendBadge()}
                  </span>
                )}
                <p className={styles.factText}>
                  <RichText text={fact.text} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {connections.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{m.profileConnectionsHeading()}</h3>
          <ul className={styles.connections}>
            {connections.map((connection) => (
              <li key={connection.slug}>
                <button
                  type="button"
                  className={styles.connection}
                  onClick={() => onOpenConnection(connection.slug)}
                >
                  <span
                    className={styles.swatch}
                    style={{ background: connection.color }}
                    aria-hidden="true"
                  />
                  <span className={styles.connectionText}>
                    <span className={styles.connectionHead}>
                      <span className={styles.connectionName}>
                        {connection.name}
                      </span>
                    </span>
                    <span className={styles.connectionReason}>
                      {connection.reason}
                    </span>
                    {!connection.isShown && (
                      <span className={styles.levelMarker}>
                        <LevelPips levelIndex={connection.levelIndex} />
                        {m.profileAppearsAt({
                          level:
                            DETAIL_LEVELS[connection.levelIndex]?.label ?? '',
                        })}
                      </span>
                    )}
                  </span>
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
