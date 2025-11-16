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

  interface GoogleMapsPlaces {
    AutocompleteService: new () => GoogleAutocompleteService;
    PlacesService: new (element: Element | null) => GooglePlacesService;
  }

  interface GoogleMapsNamespace {
    maps?: {
      places?: GoogleMapsPlaces;
    };
  }

  interface Window {
    google?: GoogleMapsNamespace;
  }
}
