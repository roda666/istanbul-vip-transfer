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
  type: string;
  label: string;
  options: LocationOption[];
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

const TYPE_ORDER = ['AIRPORT', 'PROVINCE', 'DISTRICT', 'REGION', 'HOTEL_ZONE', 'CUSTOM'];

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

function groupLocations(options: LocationOption[], labels: LocationLabels): LocationGroup[] {
  const typeLabels: Record<string, string> = {
    AIRPORT: labels.airport,
    PROVINCE: labels.province,
    DISTRICT: labels.district,
    REGION: labels.region,
    HOTEL_ZONE: labels.hotelZone,
    CUSTOM: labels.other,
  };
  const map = new Map<string, LocationOption[]>();
  for (const type of TYPE_ORDER) map.set(type, []);
  for (const opt of options) {
    if (!map.has(opt.type)) map.set(opt.type, []);
    map.get(opt.type)!.push(opt);
  }
  return Array.from(map.entries())
    .filter(([, opts]) => opts.length > 0)
    .map(([type, opts]) => ({
      type,
      label: typeLabels[type] ?? type,
      options: opts,
    }));
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
  /** Exclude a specific location name (e.g. already-selected origin) */
  excludeName?: string;
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
  excludeName,
}: Props) {
  const [allOptions, setAllOptions] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);

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
    if (excludeName && o.name === excludeName) return false;
    if (!search) return true;
    return normalizeTurkish(o.name).includes(normalizeTurkish(search));
  });

  const groups = groupLocations(filtered, labels);
  const flat = groups.flatMap((g) => g.options);

  function handleSelect(opt: LocationOption) {
    onChange(opt.name);
    setSearch('');
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
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

  const displayValue = open ? search : value;

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
            groups.map((group) => (
              <div key={group.type}>
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
                {group.options.map((opt) => {
                  const idx = flat.indexOf(opt);
                  const isActive = idx === activeIdx;
                  const isSelected = value === opt.name;
                  return (
                    <div
                      key={opt.id}
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
                      {opt.name}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
