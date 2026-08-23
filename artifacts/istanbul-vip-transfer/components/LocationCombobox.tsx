'use client';

import { useState, useRef, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LocationOption {
  id: string;
  name: string;
  slug: string;
  type: 'AIRPORT' | 'DISTRICT' | 'REGION' | 'HOTEL_ZONE' | 'CUSTOM' | 'PROVINCE';
  scope: 'LOCAL' | 'INTERCITY' | 'BOTH';
  city: string;
  district: string | null;
}

interface LocationGroup {
  id: string;
  label: string;
  options: LocationOption[];
  collapsible?: boolean;
}

interface LocationLabels {
  airport: string;
  province: string;
  district: string;
  region: string;
  hotelZone: string;
  other: string;
  loading: string;
  selectOrType: string;
  noResults: string;
  clearSelection: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTurkish(str: string): string {
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

const turkishCollator = new Intl.Collator('tr-TR', { sensitivity: 'base' });

function sortOptions(options: LocationOption[]): LocationOption[] {
  return [...options].sort((left, right) => {
    const leftIsCenter = normalizeTurkish(left.name) === 'merkez';
    const rightIsCenter = normalizeTurkish(right.name) === 'merkez';
    if (leftIsCenter !== rightIsCenter) return leftIsCenter ? -1 : 1;
    return turkishCollator.compare(left.name, right.name);
  });
}

function groupLocations(options: LocationOption[], labels: LocationLabels, searching: boolean): LocationGroup[] {
  if (searching) {
    return [{ id: 'search-results', label: 'Sonuçlar', options: sortOptions(options) }];
  }

  const airports = sortOptions(options.filter((option) => option.type === 'AIRPORT'));
  const istanbul = sortOptions(options.filter((option) => (
    option.type !== 'AIRPORT' && normalizeTurkish(option.city) === 'istanbul'
  )));
  const provinceMap = new Map<string, LocationOption[]>();
  for (const option of options) {
    if (option.type === 'AIRPORT' || normalizeTurkish(option.city) === 'istanbul') continue;
    const current = provinceMap.get(option.city) ?? [];
    current.push(option);
    provinceMap.set(option.city, current);
  }
  const provinces = Array.from(provinceMap.entries())
    .sort(([left], [right]) => turkishCollator.compare(left, right))
    .map(([city, cityOptions]) => ({
      id: `province-${normalizeTurkish(city)}`,
      label: city,
      options: sortOptions(cityOptions),
      collapsible: true,
    }));

  return [
    ...(airports.length ? [{ id: 'airports', label: labels.airport, options: airports }] : []),
    ...(istanbul.length ? [{ id: 'istanbul', label: 'İstanbul', options: istanbul }] : []),
    ...provinces,
  ];
}

function formatOptionLabel(option: LocationOption): string {
  if (option.type === 'AIRPORT') return option.name;
  return option.city ? `${option.name} (${option.city})` : option.name;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Connects the custom input to its visible form label. */
  id: string;
  /** Accessible name, matching the visible form label. */
  ariaLabel: string;
  /** Which endpoint filter to use */
  for: 'pickup' | 'dropoff';
  /** Optional scope: 'local' for Istanbul/city, 'intercity' for provinces */
  scope?: 'local' | 'intercity';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Translated "Loading…" text shown while options are being fetched.
   *  Prevents the Turkish default from appearing in non-TR SSR output. */
  loadingText?: string;
  /** Fully localized labels for the picker UI. */
  labels: LocationLabels;
  error?: boolean;
  /** Exclude a stable location ID (e.g. already-selected origin). */
  excludeId?: string;
  /** Lets the parent keep readable labels for WhatsApp while form values stay stable IDs. */
  onOptionChange?: (option: LocationOption | null) => void;
}

export default function LocationCombobox({
  id,
  ariaLabel,
  for: forProp,
  scope,
  value,
  onChange,
  placeholder,
  loadingText,
  labels,
  error,
  excludeId,
  onOptionChange,
}: Props) {
  const [allOptions, setAllOptions] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch on mount
  useEffect(() => {
    const url = new URL('/data/locations', window.location.origin);
    url.searchParams.set('for', forProp);
    if (scope) url.searchParams.set('scope', scope);

    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => {
        setAllOptions(d.locations ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [forProp, scope]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter options
  const filtered = allOptions.filter((o) => {
    if (excludeId && o.id === excludeId) return false;
    if (!search) return true;
    const query = normalizeTurkish(search);
    return normalizeTurkish(o.name).includes(query)
      || normalizeTurkish(o.city).includes(query)
      || normalizeTurkish(o.district ?? '').includes(query);
  });

  const groups = groupLocations(filtered, labels, Boolean(search));
  const flat = groups.flatMap((group) => (
    group.collapsible && !expandedGroups.has(group.id) ? [] : group.options
  ));

  function handleSelect(opt: LocationOption) {
    onChange(opt.id);
    onOptionChange?.(opt);
    setSearch('');
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    onOptionChange?.(null);
    setSearch('');
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setOpen(true);
    setActiveIdx(-1);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0 && flat[activeIdx]) {
      e.preventDefault();
      handleSelect(flat[activeIdx]);
    }
  }

  const selectedOption = allOptions.find((option) => option.id === value);
  const displayValue = open ? search : (selectedOption ? formatOptionLabel(selectedOption) : '');

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          id={id}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={open ? `${id}-listbox` : undefined}
           aria-activedescendant={activeIdx >= 0 ? `${id}-option-${activeIdx}` : undefined}
          value={displayValue}
          placeholder={loading ? (loadingText ?? labels.loading) : (placeholder ?? labels.selectOrType)}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="vip-input"
          style={{
            width: '100%',
            paddingRight: value && !open ? '32px' : undefined,
            borderColor: error ? '#DC2626' : undefined,
          }}
        />
        {value && !open && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={labels.clearSelection}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#718596',
              fontSize: '18px',
              lineHeight: 1,
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            border: '1px solid #D9E2EC',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(16,42,67,0.13)',
            zIndex: 200,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {groups.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: '#718596',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {loading ? (loadingText ?? labels.loading) : labels.noResults}
            </div>
          ) : (
            groups.map((group) => {
              const expanded = !group.collapsible || expandedGroups.has(group.id);
              return (
              <div key={group.id}>
                {group.collapsible ? (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setExpandedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(group.id)) next.delete(group.id);
                      else next.add(group.id);
                      return next;
                    })}
                    style={{
                      width: '100%',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '9px 14px 6px',
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#C99A32',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      background: '#FAFBFC',
                      borderBottom: '1px solid #F0F4F8',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {group.label}<span aria-hidden="true">{expanded ? '−' : '+'}</span>
                  </button>
                ) : (
                <div
                  style={{
                    padding: '8px 14px 4px',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#C99A32',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    background: '#FAFBFC',
                    borderBottom: '1px solid #F0F4F8',
                    position: 'sticky',
                    top: 0,
                  }}
                >
                  {group.label}
                </div>
                )}
                {expanded && group.options.map((opt) => {
                  const idx = flat.indexOf(opt);
                  const isActive = idx === activeIdx;
                  const isSelected = value === opt.id;
                  return (
                    <div
                      key={opt.id}
                      id={`${id}-option-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        background: isActive ? '#EEF3F9' : isSelected ? '#EBF4FF' : 'transparent',
                        color: isSelected ? '#1D5FD1' : '#172B3A',
                        fontSize: '13px',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: isSelected ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {isSelected && (
                        <span style={{ color: '#1D5FD1', flexShrink: 0, fontSize: '12px' }}>✓</span>
                      )}
                      <span>{opt.name}</span>
                      {opt.city && (
                        <span style={{ marginLeft: 'auto', color: '#718596', fontSize: '11px', fontWeight: 400 }}>
                          ({opt.city})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
