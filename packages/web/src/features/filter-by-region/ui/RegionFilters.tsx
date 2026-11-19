import { REGION_LABELS } from '../../../shared/config';
import { REGIONS, type Region } from '../../../shared/types';
import { FilterPillList } from '../../../shared/ui';

interface RegionFiltersProps {
  selectedRegions: Region[];
  onToggleRegion: (region: Region) => void;
}

// One Region filter narrowing People, Conflicts, and Milestones together.
// Multi-select OR; none active means unfiltered (GLOSSARY.md's Region).
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
