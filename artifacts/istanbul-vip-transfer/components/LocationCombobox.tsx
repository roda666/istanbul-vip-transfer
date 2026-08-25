'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface LocationOption {
  id: string;
  name: string;
  slug: string;
  type: 'AIRPORT' | 'DISTRICT' | 'REGION' | 'HOTEL_ZONE' | 'CUSTOM' | 'PROVINCE';
  scope: 'LOCAL' | 'INTERCITY' | 'BOTH';
  city: string;
  district: string | null;
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

interface Props {
  id: string;
  ariaLabel: string;
  for: 'pickup' | 'dropoff';
  scope?: 'local' | 'intercity';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loadingText?: string;
  labels: LocationLabels;
  error?: boolean;
  excludeId?: string;
  onOptionChange?: (option: LocationOption | null) => void;
}

const turkishCollator = new Intl.Collator('tr-TR', { sensitivity: 'base' });

function sortOptions(options: LocationOption[]): LocationOption[] {
  return [...options].sort((left, right) => turkishCollator.compare(left.name, right.name));
}

/**
 * Search-only location picker. It intentionally never downloads the whole
 * catalog on page load: results arrive from the server after the user types.
 * On mobile, its result sheet is fixed above the visual viewport keyboard.
 */
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
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<LocationOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!value) setSelectedOption(null);
  }, [value]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const updateMobile = () => {
      setIsMobile(
        media.matches
        || window.innerWidth <= 767
        || (window.visualViewport?.width ?? Number.POSITIVE_INFINITY) <= 767,
      );
    };
    updateMobile();
    media.addEventListener('change', updateMobile);

    const viewport = window.visualViewport;
    const updateViewport = () => {
      if (!viewport) return;
      // Browsers either resize the layout viewport or overlay the keyboard.
      // This formula handles both cases and keeps the result sheet visible.
      setKeyboardOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    updateViewport();

    return () => {
      media.removeEventListener('change', updateMobile);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  useEffect(() => {
    const query = search.trim();
    requestRef.current?.abort();

    if (!query) {
      setOptions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL('/data/locations', window.location.origin);
        url.searchParams.set('for', forProp);
        url.searchParams.set('q', query);
        if (scope) url.searchParams.set('scope', scope);
        const response = await fetch(url.toString(), { signal: controller.signal });
        const data = response.ok ? await response.json() as { locations?: LocationOption[] } : null;
        if (!controller.signal.aborted) {
          setOptions(sortOptions((data?.locations ?? []).filter((option) => option.id !== excludeId)));
          setActiveIndex(-1);
        }
      } catch {
        if (!controller.signal.aborted) setOptions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [excludeId, forProp, scope, search]);

  const visibleOptions = useMemo(() => (
    options.filter((option) => {
      if (!excludeId || option.id !== excludeId) return true;
      return false;
    })
  ), [excludeId, options]);

  const hasSearch = Boolean(search.trim());
  const showResults = open && hasSearch;

  const selectOption = useCallback((option: LocationOption) => {
    onChange(option.id);
    onOptionChange?.(option);
    setSelectedOption(option);
    setSearch('');
    setOptions([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }, [onChange, onOptionChange]);

  function clearSelection(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    onChange('');
    onOptionChange?.(null);
    setSelectedOption(null);
    setSearch('');
    setOptions([]);
    setOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearch(event.target.value);
    setOpen(Boolean(event.target.value.trim()));
    setActiveIndex(-1);
  }

  function handleFocus() {
    if (search.trim()) setOpen(true);
    if (isMobile) {
      window.setTimeout(() => {
        inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 150);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setSearch('');
      return;
    }
    if (event.key === 'ArrowDown' && visibleOptions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, visibleOptions.length - 1));
    } else if (event.key === 'ArrowUp' && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0 && visibleOptions[activeIndex]) {
      event.preventDefault();
      selectOption(visibleOptions[activeIndex]);
    }
  }

  const displayValue = open ? search : (selectedOption?.name ?? '');
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: `${keyboardOffset + 12}px`,
        maxHeight: 'min(46dvh, 360px)',
        zIndex: 1000,
      }
    : {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 'calc(100% + 6px)',
        maxHeight: '300px',
        zIndex: 200,
      };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={showResults}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={showResults ? `${id}-listbox` : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          value={displayValue}
          placeholder={placeholder ?? labels.selectOrType}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="search"
          enterKeyHint="search"
          className="vip-input"
          style={{
            width: '100%',
            paddingRight: value && !open ? '36px' : undefined,
            borderColor: error ? '#DC2626' : undefined,
          }}
        />
        {value && !open && (
          <button
            type="button"
            onClick={clearSelection}
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
              fontSize: '20px',
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

      {showResults && (
        <div
          id={`${id}-listbox`}
          className="ivt-location-search-results"
          role="listbox"
          aria-label={`${ariaLabel} sonuçları`}
          style={{
            ...panelStyle,
            background: '#FFFFFF',
            border: '1px solid #D9E2EC',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(16,42,67,0.18)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            ['--ivt-keyboard-offset' as string]: `${keyboardOffset}px`,
          }}
        >
          {loading ? (
            <div style={emptyStateStyle}>{loadingText ?? labels.loading}</div>
          ) : visibleOptions.length === 0 ? (
            <div style={emptyStateStyle}>{labels.noResults}</div>
          ) : (
            visibleOptions.map((option, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={option.id}
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={value === option.id}
                  onClick={() => selectOption(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: index === visibleOptions.length - 1 ? 'none' : '1px solid #F0F4F8',
                    padding: '13px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: active || value === option.id ? '#EEF3F9' : '#FFFFFF',
                    color: value === option.id ? '#1D5FD1' : '#172B3A',
                    fontSize: '15px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: value === option.id ? 600 : 500,
                    minHeight: '48px',
                  }}
                >
                  {option.name}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const emptyStateStyle: React.CSSProperties = {
  padding: '20px 16px',
  textAlign: 'center',
  color: '#718596',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
};