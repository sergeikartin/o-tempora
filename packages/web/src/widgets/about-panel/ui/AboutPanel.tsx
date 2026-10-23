import { CODE_LICENSE_URL, DATA_LICENSE_URL } from '../../../shared/config';
import { m } from '../../../shared/paraglide/messages.js';
import { ModalPanel } from '../../../shared/ui';
import styles from './AboutPanel.module.css';

interface AboutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Citations stay in their original (untranslated) form across locales, same
// convention as the DOI/author string in LICENSE-DATA.md.
const PANTHEON_CITATION =
  'Yu, A. Z., et al. (2016). Pantheon 1.0, a manually verified dataset of globally famous biographies. Scientific Data 2:150075.';

export function AboutPanel({ isOpen, onClose }: AboutPanelProps) {
  return (
    <ModalPanel
      isOpen={isOpen}
      onClose={onClose}
      heading={m.aboutHeading()}
      closeButtonAriaLabel={m.closeAboutAriaLabel()}
    >
      <p className={styles.description}>{m.aboutDescription()}</p>
      <p className={styles.body}>{m.aboutMadeBy()}</p>

      <h3 className={styles.sectionHeading}>{m.aboutCodeHeading()}</h3>
      <p className={styles.body}>{m.aboutCodeBody()}</p>
      <a
        className={styles.link}
        href={CODE_LICENSE_URL}
        target="_blank"
        rel="noreferrer"
      >
        {m.aboutViewOnGithub()}
      </a>

      <h3 className={styles.sectionHeading}>{m.aboutDataHeading()}</h3>
      <p className={styles.body}>{m.aboutDataPeopleBody()}</p>
      <p className={styles.citation}>{PANTHEON_CITATION}</p>
      <p className={styles.body}>{m.aboutDataEventsBody()}</p>
      <a
        className={styles.link}
        href={DATA_LICENSE_URL}
        target="_blank"
        rel="noreferrer"
      >
        {m.aboutViewDataLicense()}
      </a>
    </ModalPanel>
  );
}
