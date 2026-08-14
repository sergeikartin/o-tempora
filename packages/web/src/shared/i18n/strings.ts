import { LANG } from './lang';

// Every piece of UI chrome copy that isn't a taxonomy label (those live
// bilingually alongside their own Record<Key, string> map in shared/config
// — see e.g. occupation-domain-colors.ts's DOMAIN_LABELS — so the taxonomy
// key set stays the single source of truth in one place). An initial,
// checked-in translation pass, not machine-translated at build or runtime
// (russian-localization spec) — reviewable and correctable like any other
// checked-in content.
interface Strings {
  siteTitle: string;
  filtersAriaLabel: string;
  dataDepthHeading: string;
  dataDepthAriaLabel: string;
  regionHeading: string;
  peopleHeading: string;
  conflictsMilestonesHeading: string;
  filterByLabel: (label: string) => string;
  zoomOutAriaLabel: string;
  zoomInAriaLabel: string;
  minimapAriaLabel: string;
  closeAriaLabel: string;
  detailsAriaLabel: (name: string) => string;
  readOnWikipedia: string;
  // The sibling deployment's own language autonym (its name in itself,
  // e.g. "Русский" shown on the English build, "English" shown on the
  // Russian build) — same convention interlanguage links commonly use, so
  // paired with SWITCH_LANGUAGE_HREF (shared/i18n/lang.ts) to link to the
  // sibling build's default view.
  switchLanguageLabel: string;
}

const EN: Strings = {
  siteTitle: 'World History Timeline',
  filtersAriaLabel: 'Filters',
  dataDepthHeading: 'Data Depth',
  dataDepthAriaLabel: 'Data Depth',
  regionHeading: 'Region',
  peopleHeading: 'People',
  conflictsMilestonesHeading: 'Conflicts & Milestones',
  filterByLabel: (label) => `Filter by ${label}`,
  zoomOutAriaLabel: 'Zoom out',
  zoomInAriaLabel: 'Zoom in',
  minimapAriaLabel: 'Timeline density minimap',
  closeAriaLabel: 'Close',
  detailsAriaLabel: (name) => `${name} details`,
  readOnWikipedia: 'Read on Wikipedia →',
  switchLanguageLabel: 'Русский',
};

const RU: Strings = {
  siteTitle: 'Хронология всемирной истории',
  filtersAriaLabel: 'Фильтры',
  dataDepthHeading: 'Глубина данных',
  dataDepthAriaLabel: 'Глубина данных',
  regionHeading: 'Регион',
  peopleHeading: 'Люди',
  conflictsMilestonesHeading: 'Конфликты и вехи',
  filterByLabel: (label) => `Фильтр: ${label}`,
  zoomOutAriaLabel: 'Уменьшить масштаб',
  zoomInAriaLabel: 'Увеличить масштаб',
  minimapAriaLabel: 'Мини-карта плотности хронологии',
  closeAriaLabel: 'Закрыть',
  detailsAriaLabel: (name) => `Подробнее: ${name}`,
  readOnWikipedia: 'Читать в Википедии →',
  switchLanguageLabel: 'English',
};

export const STRINGS: Strings = LANG === 'ru' ? RU : EN;
