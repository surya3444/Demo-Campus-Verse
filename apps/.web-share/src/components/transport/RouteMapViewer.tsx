'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { useGoogleMapsLoader } from './useGoogleMaps';
import type { MapLocation, MapStop } from './types';

interface RouteMapViewerProps {
  apiKey?: string;
  startLocation: MapLocation | null;
  stops: MapStop[];
  height?: string;
}

const MAP_OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  clickableIcons: false,
  disableDefaultUI: false,
};

export function RouteMapViewer({
  apiKey,
  startLocation,
  stops,
  height = '400px',
}: RouteMapViewerProps) {
  const { isLoaded, loadError, hasApiKey } = useGoogleMapsLoader(apiKey);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const points: { lat: number; lng: number }[] = [];
    if (startLocation) points.push(startLocation.location);
    stops.forEach((s) => points.push(s.location));
    if (points.length === 0) return;
    if (points.length === 1) {
      mapRef.current.setCenter(points[0]);
      mapRef.current.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 64);
  }, [startLocation, stops, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !startLocation || stops.length === 0) {
      setDirections(null);
      return;
    }

    const service = new google.maps.DirectionsService();
    const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
    const waypoints = ordered.slice(0, -1).map((s) => ({
      location: new google.maps.LatLng(s.location.lat, s.location.lng),
      stopover: true,
    }));
    service.route(
      {
        origin: startLocation.location,
        destination: ordered[ordered.length - 1].location,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) setDirections(result);
        else setDirections(null);
      }
    );
  }, [startLocation, stops, isLoaded]);

  if (!hasApiKey) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Google Maps API key not configured. Add one in Transport → Settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadError || !isLoaded) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {loadError ? 'Failed to load map.' : 'Loading map…'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md overflow-hidden border">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height }}
        center={startLocation?.location || { lat: 20.5937, lng: 78.9629 }}
        zoom={12}
        onLoad={onMapLoad}
        options={MAP_OPTIONS}
      >
        {startLocation && (
          <Marker
            position={startLocation.location}
            label={{ text: 'S', color: 'white', fontSize: '12px', fontWeight: 'bold' }}
          />
        )}
        {stops.map((stop, idx) => (
          <Marker
            key={stop._id || `${stop.location.lat}-${idx}`}
            position={stop.location}
            label={{
              text: String(idx + 1),
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          />
        ))}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#3b82f6',
                strokeOpacity: 0.8,
                strokeWeight: 5,
              },
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
