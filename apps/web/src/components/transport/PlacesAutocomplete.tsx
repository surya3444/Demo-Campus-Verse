'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { MapLocation } from './types';

export interface PlacesAutocompleteProps {
  value: string;
  onValueChange: (v: string) => void;
  onPick: (loc: MapLocation) => void;
  disabled?: boolean;
  enabled?: boolean;
  placeholder?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  inputClassName?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onEscape?: () => void;
}

export interface PlacesAutocompleteHandle {
  clear: () => void;
  focus: () => void;
}

export const PlacesAutocomplete = forwardRef<PlacesAutocompleteHandle, PlacesAutocompleteProps>(
  function PlacesAutocomplete(
    {
      value,
      onValueChange,
      onPick,
      disabled,
      enabled = true,
      placeholder,
      leadingIcon,
      trailingSlot,
      inputClassName,
      autoFocus,
      onBlur,
      onEscape,
    },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const [open, setOpen] = useState(false);

    const {
      ready,
      value: query,
      setValue: setQuery,
      suggestions: { status, data },
      clearSuggestions,
    } = usePlacesAutocomplete({
      debounce: 250,
      requestOptions: {},
      initOnMount: enabled,
    });

    // Keep external value and internal query in sync so callers can reset.
    useEffect(() => {
      if (value !== query) setQuery(value, false);
    }, [value]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        setQuery('', false);
        clearSuggestions();
        setOpen(false);
      },
      focus: () => inputRef.current?.focus(),
    }));

    const hasResults = status === 'OK' && data.length > 0;

    const handlePick = async (idx: number) => {
      const suggestion = data[idx];
      if (!suggestion) return;
      const description = suggestion.description;
      setQuery(description, false);
      onValueChange(description);
      clearSuggestions();
      setOpen(false);
      try {
        const results = await getGeocode({ placeId: suggestion.place_id });
        const { lat, lng } = await getLatLng(results[0]);
        const mainText = suggestion.structured_formatting?.main_text;
        onPick({
          name: mainText || description,
          address: suggestion.structured_formatting?.secondary_text
            ? `${mainText}, ${suggestion.structured_formatting.secondary_text}`
            : description,
          placeId: suggestion.place_id,
          location: { lat, lng },
        });
      } catch {
        /* geocode failed — caller will stay on the current location */
      }
    };

    return (
      <div className="relative">
        {leadingIcon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            {leadingIcon}
          </div>
        )}
        <Input
          ref={inputRef}
          value={query}
          disabled={disabled || !ready}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            onValueChange(v);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Allow click on suggestion list to register first.
            window.setTimeout(() => {
              setOpen(false);
              onBlur?.();
            }, 150);
          }}
          onKeyDown={(e) => {
            if (!hasResults) {
              if (e.key === 'Escape') onEscape?.();
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, data.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              handlePick(activeIdx);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              clearSuggestions();
              setOpen(false);
              onEscape?.();
            }
          }}
          className={cn(leadingIcon && 'pl-8', inputClassName)}
        />
        {trailingSlot && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailingSlot}</div>
        )}

        {open && hasResults && (
          <ul
            role="listbox"
            className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
          >
            {data.map((s, i) => {
              const main = s.structured_formatting?.main_text || s.description;
              const secondary = s.structured_formatting?.secondary_text;
              return (
                <li key={s.place_id} role="option" aria-selected={i === activeIdx}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick(i);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors',
                      i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                    )}
                  >
                    <p className="font-medium truncate">{main}</p>
                    {secondary && (
                      <p className="text-xs text-muted-foreground truncate">{secondary}</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
);
