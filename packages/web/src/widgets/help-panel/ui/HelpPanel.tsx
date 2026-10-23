import { m } from '../../../shared/paraglide/messages.js';
import { ModalPanel } from '../../../shared/ui';
import styles from './HelpPanel.module.css';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const entries = [
    { term: m.helpTravelTerm(), description: m.helpTravelBody() },
    { term: m.helpMarksTerm(), description: m.helpMarksBody() },
    { term: m.helpColorsTerm(), description: m.helpColorsBody() },
    { term: m.helpDetailLevelTerm(), description: m.helpDetailLevelBody() },
    { term: m.helpDetailsTerm(), description: m.helpDetailsBody() },
    { term: m.helpKeysTerm(), description: m.helpKeysBody() },
  ];
  return (
    <ModalPanel
      isOpen={isOpen}
      onClose={onClose}
      heading={m.helpHeading()}
      closeButtonAriaLabel={m.closeHelpAriaLabel()}
    >
      <dl className={styles.list}>
        {entries.map(({ term, description }) => (
          <div key={term} className={styles.entry}>
            <dt className={styles.term}>{term}</dt>
            <dd className={styles.description}>{description}</dd>
          </div>
        ))}
      </dl>
    </ModalPanel>
  );
}
