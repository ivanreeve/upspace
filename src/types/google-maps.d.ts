export {};

declare global {
  type GooglePlacesStatus =
    | 'OK'
    | 'ZERO_RESULTS'
    | 'INVALID_REQUEST'
    | 'OVER_QUERY_LIMIT'
    | 'REQUEST_DENIED'
    | 'UNKNOWN_ERROR'
    | 'NOT_FOUND';

  interface GoogleAutocompletePrediction {
    description: string;
    place_id: string;
    structured_formatting?: {
      main_text: string;
      secondary_text?: string;
    };
  }

  interface GooglePlaceAddressComponent {
    short_name: string;
    long_name: string;
    types: string[];
  }

  interface GooglePlaceLocation {
    lat: () => number;
    lng: () => number;
  }

  interface GoogleLatLngLiteral {
    lat: number;
    lng: number;
  }

  interface GooglePlaceDetails {
    formatted_address?: string;
    geometry?: {
      location?: GooglePlaceLocation;
    };
    address_components?: GooglePlaceAddressComponent[];
  }

  interface GoogleAutocompleteService {
    getPlacePredictions(
      request: {
        input: string;
        componentRestrictions?: {
          country?: string | string[];
        };
        types?: string[];
      },
      callback: (predictions: GoogleAutocompletePrediction[] | null, status: GooglePlacesStatus) => void
    ): void;
  }

  interface GooglePlacesService {
    getDetails(
      request: { placeId: string; fields?: string[]; },
      callback: (result: GooglePlaceDetails | null, status: GooglePlacesStatus) => void
    ): void;
  }

  interface GoogleMapMouseEvent {
    latLng?: GooglePlaceLocation;
  }

  interface GoogleMapsEventListener {
    remove: () => void;
  }

  interface GoogleMapsMap {
    setCenter(position: GoogleLatLngLiteral): void;
    panTo(position: GoogleLatLngLiteral): void;
    setZoom(zoom: number): void;
    addListener(eventName: string, handler: (event: GoogleMapMouseEvent) => void): GoogleMapsEventListener;
  }

  interface GoogleMapsMarker {
    setPosition(position: GoogleLatLngLiteral): void;
    setMap(map: GoogleMapsMap | null): void;
  }

  interface GoogleMapsGlobal {
    Map: new (element: Element, options?: {
      center?: GoogleLatLngLiteral;
      zoom?: number;
      disableDefaultUI?: boolean;
      zoomControl?: boolean;
    }) => GoogleMapsMap;
    Marker: new (options: {
      position?: GoogleLatLngLiteral;
      map?: GoogleMapsMap;
      draggable?: boolean;
    }) => GoogleMapsMarker;
    places?: GoogleMapsPlaces;
  }

  interface GoogleMapsPlaces {
    AutocompleteService: new () => GoogleAutocompleteService;
    PlacesService: new (element: Element | null) => GooglePlacesService;
  }

  interface GoogleMapsNamespace {
    maps?: GoogleMapsGlobal;
  }

  interface Window {
    google?: GoogleMapsNamespace;
  }
}
