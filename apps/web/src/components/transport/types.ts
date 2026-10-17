export interface MapLocation {
  name: string;
  address?: string;
  placeId?: string;
  location: { lat: number; lng: number };
}

export interface MapStop extends MapLocation {
  _id?: string;
  sequence: number;
}

export interface BusStopFull extends MapStop {
  pickupTime?: string;
  dropTime?: string;
  fare?: number;
}
