import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { SearchResult } from '../model/useTimelineSearch';
import { SearchBar } from './SearchBar';

afterEach(cleanup);

const results: SearchResult[] = [
  {
    id: 'Q868',
    slug: 'Q868',
    entityType: 'person',
    name: 'Aristotle',
    tagline: 'Greek philosopher',
    fameScore: 90,
    detailLevel: 'mainstream',
  },
  {
    id: 'Q8214',
    slug: 'Q8214',
    entityType: 'conflict',
    name: 'Korean War',
    tagline: 'war on the Korean peninsula',
    fameScore: 85,
    detailLevel: 'mainstream',
  },
];

test('renders no dropdown when the query is empty', () => {
  const { queryByRole } = render(
    <SearchBar
      selectedLevelId="mainstream"
      query=""
      onQueryChange={vi.fn()}
      results={[]}
      onSelectResult={vi.fn()}
    />,
  );
  expect(queryByRole('listbox')).toBeNull();
});

test('shows a "no matches" row when the query has no results', () => {
  const { getByText } = render(
    <SearchBar
      selectedLevelId="mainstream"
      query="zzz"
      onQueryChange={vi.fn()}
      results={[]}
      onSelectResult={vi.fn()}
    />,
  );
  expect(getByText('No matches')).toBeTruthy();
});

test('renders one option per result, labeled with its Lane', () => {
  const { getAllByRole } = render(
    <SearchBar
      selectedLevelId="mainstream"
      query="ar"
      onQueryChange={vi.fn()}
      results={results}
      onSelectResult={vi.fn()}
    />,
  );
  expect(getAllByRole('option')).toHaveLength(2);
});

test('clicking a result calls onSelectResult and clears the query', () => {
  const onSelectResult = vi.fn();
  const onQueryChange = vi.fn();
  const { getAllByRole } = render(
    <SearchBar
      selectedLevelId="mainstream"
      query="ar"
      onQueryChange={onQueryChange}
      results={results}
      onSelectResult={onSelectResult}
    />,
  );

  fireEvent.click(
    getAllByRole('option')[1]?.querySelector('button') as HTMLElement,
  );

  expect(onSelectResult).toHaveBeenCalledWith(results[1]);
  expect(onQueryChange).toHaveBeenCalledWith('');
});

test('ArrowDown then Enter selects the first result', () => {
  const onSelectResult = vi.fn();
  const { getByRole } = render(
    <SearchBar
      selectedLevelId="mainstream"
      query="ar"
      onQueryChange={vi.fn()}
      results={results}
      onSelectResult={onSelectResult}
    />,
  );

  const input = getByRole('combobox');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });

  expect(onSelectResult).toHaveBeenCalledWith(results[0]);
});

test('Escape clears the query without selecting anything', () => {
  const onQueryChange = vi.fn();
  const onSelectResult = vi.fn();
  const { getByRole } = render(
    <SearchBar
      selectedLevelId="mainstream"
      query="ar"
      onQueryChange={onQueryChange}
      results={results}
      onSelectResult={onSelectResult}
    />,
  );

  fireEvent.keyDown(getByRole('combobox'), { key: 'Escape' });

  expect(onQueryChange).toHaveBeenCalledWith('');
  expect(onSelectResult).not.toHaveBeenCalled();
});

test('bolds the matched substring within a result name', () => {
  const { getByText } = render(
    <SearchBar
      selectedLevelId="mainstream"
      query="ar"
      onQueryChange={vi.fn()}
      results={results}
      onSelectResult={vi.fn()}
    />,
  );
  const strong = getByText('Ar', { selector: 'strong' });
  expect(strong).toBeTruthy();
});
