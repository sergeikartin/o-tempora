import { useEffect, useRef } from 'react';
import { DETAIL_LEVELS } from '../../../shared/config';
import type { ProfileAnchor } from '../../../shared/lib/entity';
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
  color: string;
  connections: readonly ResolvedConnection[];
  // Accented and scrolled into view on arrival; ignored when it names nothing
  // in this Profile.
  anchor?: ProfileAnchor;
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

function SourceLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <a
      className={styles.sourceLink}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {m.profileSourceLink()}
    </a>
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

export function ProfileView({
  profile,
  color,
  connections,
  anchor,
  onOpenConnection,
}: ProfileViewProps) {
  const anchoredRef = useRef<HTMLLIElement>(null);
  const isAnchored = (kind: ProfileAnchor['kind'], index: number) =>
    anchor?.kind === kind && anchor.index === index + 1;

  useEffect(() => {
    if (!anchor) return;
    const prefersReducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    anchoredRef.current?.scrollIntoView?.({
      block: 'center',
      behavior: prefersReducedMotion ? 'instant' : 'smooth',
    });
  }, [anchor]);

  return (
    <div className={styles.profile}>
      <p className={styles.overview}>
        <RichText text={profile.overview} />
      </p>

      {profile.keyMoments.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{m.profileKeyMomentsHeading()}</h3>
          <ol className={styles.moments}>
            {profile.keyMoments.map((moment, index) => (
              <li
                key={moment.date + moment.title}
                ref={isAnchored('moment', index) ? anchoredRef : undefined}
                className={styles.moment}
                data-anchored={isAnchored('moment', index) || undefined}
              >
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
                <SourceLink url={moment.sourceUrl} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {profile.deepFacts.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{m.profileDeepFactsHeading()}</h3>
          <ul className={styles.facts}>
            {profile.deepFacts.map((fact, index) => (
              <li
                key={fact.text}
                ref={isAnchored('fact', index) ? anchoredRef : undefined}
                className={styles.fact}
                data-anchored={isAnchored('fact', index) || undefined}
              >
                {fact.isLegend && (
                  <span className={styles.legendBadge}>
                    {m.profileLegendBadge()}
                  </span>
                )}
                <p className={styles.factText}>
                  <RichText text={fact.text} />
                </p>
                <SourceLink url={fact.sourceUrl} />
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
                        {m.entityAppearsAtLevel({
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
