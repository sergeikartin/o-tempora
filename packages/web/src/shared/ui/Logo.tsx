import styles from './Logo.module.css';

export function Logo() {
  return (
    <span className={styles.logo}>
      <svg
        className={styles.mark}
        viewBox="0 0 1024 1024"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="512" cy="524" r="330" fill="var(--color-focus-ring)" />
        <circle cx="512" cy="524" r="306" fill="var(--color-accent-selected)" />
        <g fill="var(--color-bg-base)">
          <rect x="362" y="409" width="260" height="62" rx="31" />
          <rect x="402" y="493" width="300" height="62" rx="31" />
          <rect x="362" y="577" width="170" height="62" rx="31" />
        </g>
      </svg>
      <span className={styles.wordmark}>O Tempora</span>
    </span>
  );
}
