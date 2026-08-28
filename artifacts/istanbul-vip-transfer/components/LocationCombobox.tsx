'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BookingLocationOption as LocationOption } from '@/lib/booking-form-types';

export type { BookingLocationOption as LocationOption } from '@/lib/booking-form-types';

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
  options: LocationOption[];
  error?: boolean;
  excludeId?: string;
  excludeCity?: string;
  onOptionChange?: (option: LocationOption | null) => void;
}

interface PanelPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Location picker.
 *
 * The trigger is a plain <button>, not a text input: tapping it opens a
 * browsable panel without summoning the mobile keyboard. Only the search
 * field *inside* the opened panel is a real text input, and it is not
 * auto-focused on mobile — the keyboard appears only once the visitor taps
 * that field on purpose. On desktop, where there is no on-screen keyboard to
 * guard against, the search field still auto-focuses for fast typing.
 *
 * With no search text, the panel shows the server's full "browse" list
 * (grouped by category, Turkish-alphabetized) instead of staying empty.
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
  options,
  error,
  excludeId,
  excludeCity,
  onOptionChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Desktop only: auto-focus the search field the moment the panel opens, for
  // fast typing. Mobile skips this on purpose so opening the panel never pops
  // the keyboard — the visitor sees the browsable list first.
  useEffect(() => {
    if (open && !isMobile) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, isMobile]);

  // Close on outside click / focus leaving the component.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
      setSearch('');
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const visibleOptions = useMemo(() => {
    const normalize = (text: string) => text
      .toLocaleLowerCase('tr-TR')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    const query = normalize(search.trim());
    return options.filter((option) => {
      if (excludeId && option.id === excludeId) return false;
      if (excludeCity && option.city.localeCompare(excludeCity, 'tr', { sensitivity: 'base' }) === 0) return false;
      if (query && !normalize(`${option.name} ${option.city} ${option.district ?? ''}`).includes(query)) return false;
      return true;
    });
  }, [excludeCity, excludeId, options, search]);

  const selectOption = useCallback((option: LocationOption) => {
    onChange(option.id);
    onOptionChange?.(option);
    setSearch('');
    setOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }, [onChange, onOptionChange]);

  function clearSelection(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onChange('');
    onOptionChange?.(null);
    setSearch('');
    setOpen(false);
  }

  function openPanel() {
    setOpen(true);
  }

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const edgePadding = isMobile ? 12 : 8;
    const gap = 6;
    const belowSpace = viewportBottom - rect.bottom - gap - edgePadding;
    const aboveSpace = rect.top - viewportTop - gap - edgePadding;
    const opensDown = belowSpace >= 220 || belowSpace >= aboveSpace;
    const availableSpace = opensDown ? belowSpace : aboveSpace;
    const maxHeight = Math.max(120, Math.min(420, availableSpace));
    const top = opensDown
      ? rect.bottom + gap
      : Math.max(viewportTop + edgePadding, rect.top - gap - maxHeight);
    const commitPosition = (next: PanelPosition) => {
      setPanelPosition((current) => (
        current
        && Math.abs(current.top - next.top) < 0.5
        && Math.abs(current.left - next.left) < 0.5
        && Math.abs(current.width - next.width) < 0.5
        && Math.abs(current.maxHeight - next.maxHeight) < 0.5
          ? current
          : next
      ));
    };

    if (isMobile) {
      commitPosition({
        top,
        left: 12,
        width: Math.max(0, window.innerWidth - 24),
        maxHeight,
      });
      return;
    }

    const left = Math.min(Math.max(edgePadding, rect.left), Math.max(edgePadding, window.innerWidth - rect.width - edgePadding));
    commitPosition({
      top,
      left,
      width: rect.width,
      maxHeight,
    });
  }, [isMobile]);

  useEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return undefined;
    }

    let frame = 0;
    const trackTrigger = () => {
      updatePanelPosition();
      frame = window.requestAnimationFrame(trackTrigger);
    };
    frame = window.requestAnimationFrame(trackTrigger);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open, updatePanelPosition]);

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearch(event.target.value);
    setActiveIndex(-1);
  }

  function handleInputFocus() {
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
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown' && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, visibleOptions.length - 1));
    } else if (event.key === 'ArrowUp' && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0 && visibleOptions[activeIndex]) {
      event.preventDefault();
      selectOption(visibleOptions[activeIndex]);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${id}-listbox` : undefined}
          onClick={openPanel}
          className="vip-input"
          style={{
            width: '100%',
            textAlign: 'left',
            background: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: selectedOption ? '#172B3A' : '#8395A7',
            paddingRight: value ? '36px' : undefined,
            borderColor: error ? '#DC2626' : undefined,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption?.name || placeholder || labels.selectOrType}
          </span>
        </button>
        {value && (
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

      {open && mounted && panelPosition && createPortal(
        <>
          {/* The backdrop and panel live under body, outside every form panel's
              overflow and stacking context. Fixed coordinates are recalculated
              on scroll, resize, and visual-viewport keyboard changes. */}
          <div
            aria-hidden="true"
            onClick={() => { setOpen(false); setSearch(''); }}
            style={{ position: 'fixed', inset: 0, zIndex: 999, background: isMobile ? 'rgba(16,42,67,0.28)' : 'transparent' }}
          />
          <div
            ref={panelRef}
            data-ivt-location-panel
            className="ivt-location-search-results"
            style={{
              position: 'fixed',
              top: `${panelPosition.top}px`,
              left: `${panelPosition.left}px`,
              width: `${panelPosition.width}px`,
              maxHeight: `${panelPosition.maxHeight}px`,
              zIndex: 1000,
              background: '#FFFFFF',
              border: '1px solid #D9E2EC',
              borderRadius: '12px',
              boxShadow: '0 12px 32px rgba(16,42,67,0.18)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              ['--ivt-keyboard-offset' as string]: `${keyboardOffset}px`,
            }}
          >
            <div style={{ padding: '10px', borderBottom: '1px solid #F0F4F8', flexShrink: 0 }}>
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-label={ariaLabel}
                aria-expanded="true"
                aria-haspopup="listbox"
                aria-autocomplete="list"
                aria-controls={`${id}-listbox`}
                aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
                value={search}
                placeholder={placeholder ?? labels.selectOrType}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="search"
                enterKeyHint="search"
                className="vip-input"
                style={{ width: '100%' }}
              />
            </div>
            <div
              id={`${id}-listbox`}
              role="listbox"
              aria-label={`${ariaLabel} sonuçları`}
              style={{
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
            >
              {visibleOptions.length === 0 ? (
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
          </div>
        </>,
        document.body,
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
