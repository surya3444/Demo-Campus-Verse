'use client';

import { useState, useEffect, useMemo } from 'react';
import { Country, State, City } from 'country-state-city';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface LocationSelectorProps {
  value: {
    country?: string;
    state?: string;
    city?: string;
  };
  onChange: (location: { country?: string; state?: string; city?: string }) => void;
  showCountry?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'grid';
}

export function LocationSelector({
  value,
  onChange,
  showCountry = true,
  required = false,
  disabled = false,
  className,
  layout = 'grid',
}: LocationSelectorProps) {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('IN');
  const [selectedStateCode, setSelectedStateCode] = useState<string>('');

  // Get all countries
  const countries = useMemo(() => Country.getAllCountries(), []);

  // Get states for selected country
  const states = useMemo(() => {
    if (!selectedCountryCode) return [];
    return State.getStatesOfCountry(selectedCountryCode);
  }, [selectedCountryCode]);

  // Get cities for selected state
  const cities = useMemo(() => {
    if (!selectedCountryCode || !selectedStateCode) return [];
    return City.getCitiesOfState(selectedCountryCode, selectedStateCode);
  }, [selectedCountryCode, selectedStateCode]);

  // Initialize from value prop
  useEffect(() => {
    if (value.country) {
      const country = countries.find((c) => c.name.toLowerCase() === value.country?.toLowerCase());
      if (country) {
        setSelectedCountryCode(country.isoCode);

        if (value.state) {
          const statesOfCountry = State.getStatesOfCountry(country.isoCode);
          const state = statesOfCountry.find(
            (s) => s.name.toLowerCase() === value.state?.toLowerCase()
          );
          if (state) {
            setSelectedStateCode(state.isoCode);
          }
        }
      }
    }
  }, [value.country, value.state, countries]);

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find((c) => c.isoCode === countryCode);
    setSelectedCountryCode(countryCode);
    setSelectedStateCode('');
    onChange({
      country: country?.name || '',
      state: '',
      city: '',
    });
  };

  const handleStateChange = (stateCode: string) => {
    const state = states.find((s) => s.isoCode === stateCode);
    setSelectedStateCode(stateCode);
    onChange({
      ...value,
      state: state?.name || '',
      city: '',
    });
  };

  const handleCityChange = (cityName: string) => {
    onChange({
      ...value,
      city: cityName,
    });
  };

  const gridClass =
    layout === 'grid'
      ? showCountry
        ? 'grid grid-cols-3 gap-3'
        : 'grid grid-cols-2 gap-3'
      : layout === 'horizontal'
        ? 'flex gap-3'
        : 'space-y-3';

  return (
    <div className={cn(gridClass, className)}>
      {/* Country Selector */}
      {showCountry && (
        <div className="space-y-1.5">
          <Label className="text-sm">
            Country {required && <span className="text-destructive">*</span>}
          </Label>
          <Select
            value={selectedCountryCode}
            onValueChange={handleCountryChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {countries.map((country) => (
                <SelectItem key={country.isoCode} value={country.isoCode}>
                  <span className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span>{country.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* State Selector */}
      <div className="space-y-1.5">
        <Label className="text-sm">
          State {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={selectedStateCode}
          onValueChange={handleStateChange}
          disabled={disabled || !selectedCountryCode}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {states.length === 0 ? (
              <SelectItem value="_none" disabled>
                No states available
              </SelectItem>
            ) : (
              states.map((state) => (
                <SelectItem key={state.isoCode} value={state.isoCode}>
                  {state.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* City Selector */}
      <div className="space-y-1.5">
        <Label className="text-sm">
          City {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={value.city || ''}
          onValueChange={handleCityChange}
          disabled={disabled || !selectedStateCode}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select city" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {cities.length === 0 ? (
              <SelectItem value="_none" disabled>
                {selectedStateCode ? 'No cities available' : 'Select a state first'}
              </SelectItem>
            ) : (
              cities.map((city, index) => (
                <SelectItem key={`${city.name}-${index}`} value={city.name}>
                  {city.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Simpler version for just state and city (when country is always India)
interface StateCitySelectorProps {
  value: {
    state?: string;
    city?: string;
  };
  onChange: (location: { state?: string; city?: string }) => void;
  countryCode?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function StateCitySelector({
  value,
  onChange,
  countryCode = 'IN',
  required = false,
  disabled = false,
  className,
}: StateCitySelectorProps) {
  const [selectedStateCode, setSelectedStateCode] = useState<string>('');

  // Get states for the country
  const states = useMemo(() => {
    return State.getStatesOfCountry(countryCode);
  }, [countryCode]);

  // Get cities for selected state
  const cities = useMemo(() => {
    if (!selectedStateCode) return [];
    return City.getCitiesOfState(countryCode, selectedStateCode);
  }, [countryCode, selectedStateCode]);

  // Initialize from value prop
  useEffect(() => {
    if (value.state) {
      const state = states.find((s) => s.name.toLowerCase() === value.state?.toLowerCase());
      if (state) {
        setSelectedStateCode(state.isoCode);
      }
    }
  }, [value.state, states]);

  const handleStateChange = (stateCode: string) => {
    const state = states.find((s) => s.isoCode === stateCode);
    setSelectedStateCode(stateCode);
    onChange({
      state: state?.name || '',
      city: '',
    });
  };

  const handleCityChange = (cityName: string) => {
    onChange({
      ...value,
      city: cityName,
    });
  };

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {/* State Selector */}
      <div className="space-y-1.5">
        <Label className="text-sm">
          State {required && <span className="text-destructive">*</span>}
        </Label>
        <Select value={selectedStateCode} onValueChange={handleStateChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {states.map((state) => (
              <SelectItem key={state.isoCode} value={state.isoCode}>
                {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* City Selector */}
      <div className="space-y-1.5">
        <Label className="text-sm">
          City {required && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={value.city || ''}
          onValueChange={handleCityChange}
          disabled={disabled || !selectedStateCode}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select city" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {cities.length === 0 ? (
              <SelectItem value="_none" disabled>
                {selectedStateCode ? 'No cities available' : 'Select a state first'}
              </SelectItem>
            ) : (
              cities.map((city, index) => (
                <SelectItem key={`${city.name}-${index}`} value={city.name}>
                  {city.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
