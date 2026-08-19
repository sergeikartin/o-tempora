import { REGION_LABELS } from '../../../shared/config';
import { REGIONS, type Region } from '../../../shared/types';
import { FilterPillList } from '../../../shared/ui';

interface RegionFiltersProps {
  selectedRegions: Region[];
  onToggleRegion: (region: Region) => void;
}

// One shared Region filter control (not one per lane) narrowing People,
// Conflicts, and Milestones together (grill-with-docs session 2026-08-12).
// Multi-select OR; no regions active means unfiltered — see CONTEXT.md's
// Region entry.
export function RegionFilters({
  selectedRegions,
  onToggleRegion,
}: RegionFiltersProps) {
  return (
    <FilterPillList
      values={REGIONS}
      selected={selectedRegions}
      onToggle={onToggleRegion}
      labelOf={(region) => REGION_LABELS[region]}
      layout="wrap"
    />
  );
}
