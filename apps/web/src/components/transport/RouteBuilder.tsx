'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { PlacesAutocomplete } from './PlacesAutocomplete';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  GripVertical,
  School,
  MapPin,
  Navigation2,
  X,
  Route as RouteIcon,
  Clock,
  Pencil,
} from 'lucide-react';
import { useGoogleMapsLoader } from './useGoogleMaps';
import type { MapLocation, MapStop } from './types';

interface RouteBuilderProps {
  apiKey?: string;
  startLocation: MapLocation | null;
  stops: MapStop[];
  onStartLocationChange: (loc: MapLocation | null) => void;
  onStopsChange: (stops: MapStop[]) => void;
  onRouteChange?: (polyline: string, distanceMeters: number, durationSeconds: number) => void;
  height?: string;
}

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const MAP_OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  clickableIcons: false,
  zoomControl: true,
  gestureHandling: 'greedy',
};

function formatDistance(m?: number) {
  if (!m) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function formatDuration(s?: number) {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function makeMarkerIcon(color: string, size = 36): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 36 44">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="${color}"/>
      <circle cx="18" cy="18" r="13" fill="white"/>
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size + 8),
    anchor: new google.maps.Point(size / 2, size + 8),
    labelOrigin: new google.maps.Point(size / 2, 18),
  };
}

export function RouteBuilder({
  apiKey,
  startLocation,
  stops,
  onStartLocationChange,
  onStopsChange,
  onRouteChange,
  height = '600px',
}: RouteBuilderProps) {
  const { isLoaded, loadError, hasApiKey } = useGoogleMapsLoader(apiKey);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeStats, setRouteStats] = useState<{ distance: number; duration: number } | null>(null);
  const [activeStopIdx, setActiveStopIdx] = useState<number | null>(null);

  const [startSearch, setStartSearch] = useState(startLocation?.name || '');
  const [addStopSearch, setAddStopSearch] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [rowSearch, setRowSearch] = useState<Record<number, string>>({});

  useEffect(() => {
    setStartSearch(startLocation?.name || '');
  }, [startLocation?.name]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Memoized icons (need google.maps available, so only compute after load)
  const startIcon = useMemo(() => (isLoaded ? makeMarkerIcon('#059669') : undefined), [isLoaded]);
  const stopIcon = useMemo(() => (isLoaded ? makeMarkerIcon('#2563eb') : undefined), [isLoaded]);
  const stopIconActive = useMemo(
    () => (isLoaded ? makeMarkerIcon('#1e40af', 44) : undefined),
    [isLoaded]
  );

  // Fit bounds to show all points
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const pts: { lat: number; lng: number }[] = [];
    if (startLocation) pts.push(startLocation.location);
    stops.forEach((s) => pts.push(s.location));
    if (pts.length === 0) return;
    if (pts.length === 1) {
      mapRef.current.setCenter(pts[0]);
      mapRef.current.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    pts.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 80);
  }, [startLocation, stops, isLoaded]);

  // Compute directions polyline + stats
  useEffect(() => {
    if (!isLoaded || !startLocation || stops.length === 0) {
      setDirections(null);
      setRouteStats(null);
      return;
    }
    const service = new google.maps.DirectionsService();
    const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
    const waypoints = ordered.slice(0, -1).map((s) => ({
      location: new google.maps.LatLng(s.location.lat, s.location.lng),
      stopover: true,
    }));
    const destination = ordered[ordered.length - 1].location;

    service.route(
      {
        origin: startLocation.location,
        destination,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          setDirections(result);
          const route = result.routes[0];
          const distance = route.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
          const duration = route.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
          setRouteStats({ distance, duration });
          onRouteChange?.(route.overview_polyline || '', distance, duration);
        } else {
          setDirections(null);
          setRouteStats(null);
        }
      }
    );
  }, [startLocation, stops, isLoaded, onRouteChange]);

  const handleStartPicked = (loc: MapLocation) => {
    onStartLocationChange(loc);
    setStartSearch(loc.name);
  };

  const handleAddStopPicked = (loc: MapLocation) => {
    const newStop: MapStop = {
      ...loc,
      sequence: stops.length,
    };
    onStopsChange([...stops, newStop]);
    setAddStopSearch('');
  };

  const handleStopEditPicked = (idx: number, loc: MapLocation) => {
    const updated = [...stops];
    updated[idx] = { ...updated[idx], ...loc };
    onStopsChange(updated);
    setEditingIdx(null);
  };

  const removeStop = (idx: number) => {
    const updated = stops.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sequence: i }));
    onStopsChange(updated);
    if (activeStopIdx === idx) setActiveStopIdx(null);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const updated = [...stops];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onStopsChange(updated.map((s, i) => ({ ...s, sequence: i })));
    setActiveStopIdx(null);
  };

  const focusOnStop = (idx: number) => {
    const stop = stops[idx];
    if (!mapRef.current || !stop) return;
    mapRef.current.panTo(stop.location);
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 14, 14));
    setActiveStopIdx(idx);
  };

  const focusOnStart = () => {
    if (!mapRef.current || !startLocation) return;
    mapRef.current.panTo(startLocation.location);
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 14, 14));
    setActiveStopIdx(null);
  };

  const mapCenter = useMemo(() => {
    if (startLocation) return startLocation.location;
    if (stops.length > 0) return stops[0].location;
    return DEFAULT_CENTER;
  }, [startLocation, stops]);

  if (!hasApiKey) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-2">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">Google Maps API key not configured</p>
          <p className="text-xs text-muted-foreground">
            Configure a key in Transport → Settings or set NEXT_PUBLIC_GOOGLE_PLACES_API_KEY.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-sm text-destructive">Failed to load Google Maps.</p>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[380px_1fr] border rounded-lg overflow-hidden bg-card"
      style={{ height }}
    >
      {/* Left panel (directions style) */}
      <div className="flex flex-col overflow-hidden border-r bg-background min-h-0">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2 shrink-0">
          <RouteIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Route</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            {stops.length} stop{stops.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Start */}
          <div className="p-4 space-y-2 border-b">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-600 text-white text-xs font-bold shrink-0">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Start (School)
                </p>
              </div>
              {startLocation && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={focusOnStart}
                  title="Center on map"
                >
                  <Navigation2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <PlacesAutocomplete
              value={startSearch}
              onValueChange={setStartSearch}
              onPick={handleStartPicked}
              placeholder="Search school / origin"
              leadingIcon={<School className="h-3.5 w-3.5 text-muted-foreground" />}
              inputClassName="h-9 text-sm"
              trailingSlot={
                startSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStartSearch('');
                      onStartLocationChange(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Clear"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null
              }
            />
            {startLocation?.address && (
              <p className="text-xs text-muted-foreground pl-8 truncate">{startLocation.address}</p>
            )}
          </div>

          {/* Stops */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Stops
              </p>
              {stops.length > 1 && <p className="text-xs text-muted-foreground">Drag to reorder</p>}
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="stops">
                {(provided) => (
                  <ul ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {stops.map((stop, idx) => (
                      <Draggable
                        key={stop._id || `${stop.location.lat}-${stop.location.lng}-${idx}`}
                        draggableId={
                          stop._id || `draft-${idx}-${stop.location.lat}-${stop.location.lng}`
                        }
                        index={idx}
                      >
                        {(dragProvided, snapshot) => (
                          <li
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              'group rounded-md border bg-card transition-all',
                              snapshot.isDragging && 'shadow-lg ring-2 ring-primary',
                              activeStopIdx === idx
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <div className="flex items-center gap-2 p-2">
                              <div
                                {...dragProvided.dragHandleProps}
                                className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
                                title="Drag to reorder"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <button
                                type="button"
                                onClick={() => focusOnStop(idx)}
                                className={cn(
                                  'flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0 transition-transform hover:scale-110',
                                  'bg-primary text-primary-foreground'
                                )}
                                title="Center on map"
                              >
                                {idx + 1}
                              </button>
                              {editingIdx === idx ? (
                                <div className="flex-1">
                                  <PlacesAutocomplete
                                    autoFocus
                                    value={rowSearch[idx] ?? ''}
                                    onValueChange={(v) => setRowSearch({ ...rowSearch, [idx]: v })}
                                    onPick={(loc) => handleStopEditPicked(idx, loc)}
                                    onEscape={() => setEditingIdx(null)}
                                    onBlur={() => setEditingIdx(null)}
                                    placeholder="Search a place"
                                    inputClassName="h-8 text-sm"
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => focusOnStop(idx)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <p className="text-sm font-medium truncate">{stop.name}</p>
                                  {stop.address && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {stop.address}
                                    </p>
                                  )}
                                </button>
                              )}
                              <div
                                className={cn(
                                  'flex items-center gap-0.5 shrink-0 transition-opacity',
                                  editingIdx === idx
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                )}
                              >
                                {editingIdx !== idx && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setEditingIdx(idx);
                                      setRowSearch({ ...rowSearch, [idx]: '' });
                                    }}
                                    title="Replace stop"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => removeStop(idx)}
                                  title="Remove stop"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>

            {/* Add stop */}
            <div className="mt-3">
              <PlacesAutocomplete
                value={addStopSearch}
                onValueChange={setAddStopSearch}
                onPick={handleAddStopPicked}
                placeholder={stops.length === 0 ? 'Add the first stop' : 'Add another stop'}
                leadingIcon={<Plus className="h-3.5 w-3.5 text-primary" />}
                inputClassName="h-9 text-sm border-dashed focus-visible:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-2 pl-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Pick from the dropdown, or drag pins on the map to adjust.
              </p>
            </div>
          </div>
        </div>

        {routeStats && (
          <div className="border-t bg-muted/30 px-4 py-3 flex items-center gap-4 text-xs shrink-0">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <RouteIcon className="h-3.5 w-3.5 text-primary" />
              {formatDistance(routeStats.distance)}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(routeStats.duration)}
            </span>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={mapCenter}
          zoom={12}
          onLoad={onMapLoad}
          options={MAP_OPTIONS}
        >
          {startLocation && startIcon && (
            <Marker
              position={startLocation.location}
              icon={startIcon}
              label={{
                text: 'A',
                color: '#059669',
                fontSize: '13px',
                fontWeight: '700',
              }}
              draggable
              onDragEnd={(e) => {
                if (!e.latLng) return;
                onStartLocationChange({
                  ...startLocation,
                  location: { lat: e.latLng.lat(), lng: e.latLng.lng() },
                });
              }}
              onClick={focusOnStart}
              zIndex={1000}
              title={startLocation.name}
            />
          )}

          {stops.map((stop, idx) =>
            stopIcon && stopIconActive ? (
              <Marker
                key={stop._id || `${stop.location.lat}-${stop.location.lng}-${idx}`}
                position={stop.location}
                icon={activeStopIdx === idx ? stopIconActive : stopIcon}
                label={{
                  text: String(idx + 1),
                  color: activeStopIdx === idx ? '#1e40af' : '#2563eb',
                  fontSize: '13px',
                  fontWeight: '700',
                }}
                draggable
                onDragEnd={(e) => {
                  if (!e.latLng) return;
                  const updated = [...stops];
                  updated[idx] = {
                    ...updated[idx],
                    location: { lat: e.latLng.lat(), lng: e.latLng.lng() },
                  };
                  onStopsChange(updated);
                }}
                onClick={() => focusOnStop(idx)}
                zIndex={activeStopIdx === idx ? 999 : 500 - idx}
                title={stop.name}
              />
            ) : null
          )}

          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: {
                  strokeColor: '#3b82f6',
                  strokeOpacity: 0.85,
                  strokeWeight: 5,
                },
              }}
            />
          )}
        </GoogleMap>

        {/* Empty state overlay */}
        {!startLocation && stops.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 pointer-events-none">
            <div className="bg-card border rounded-lg px-4 py-3 shadow-md pointer-events-auto max-w-xs">
              <p className="text-sm font-medium flex items-center gap-2 mb-1">
                <School className="h-4 w-4 text-emerald-600" />
                Start by searching your school
              </p>
              <p className="text-xs text-muted-foreground">
                Type in the left panel to search. Then add stops along the route.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
