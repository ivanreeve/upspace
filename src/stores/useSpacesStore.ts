import { create } from 'zustand';

import {
  AreaInput,
  AreaRecord,
  cloneWeeklyAvailability,
  INITIAL_SPACES,
  SpaceInput,
  SpaceRecord,
  SpaceStatus
} from '@/data/spaces';

type CreateSpaceOptions = {
  spaceId?: string;
  status?: SpaceStatus;
  createdAt?: string;
};

type SpacesState = {
  spaces: SpaceRecord[];
  createSpace: (payload: SpaceInput, options?: CreateSpaceOptions) => string;
  updateSpace: (spaceId: string, payload: SpaceInput) => void;
  createArea: (spaceId: string, payload: AreaInput) => void;
  updateArea: (spaceId: string, areaId: string, payload: AreaInput) => void;
};

const cloneSpaceInput = (payload: SpaceInput): SpaceInput => ({
  ...payload,
  amenities: [...payload.amenities],
  availability: cloneWeeklyAvailability(payload.availability),
});

const cloneAreaInput = (payload: AreaInput): AreaInput => ({ ...payload, });

export const useSpacesStore = create<SpacesState>((set) => ({
  spaces: INITIAL_SPACES,
  createSpace: (payload, options) => {
    const id = options?.spaceId ?? crypto.randomUUID();
    const createdAt = options?.createdAt ?? new Date().toISOString();
    const status = options?.status ?? 'Draft';
    const newSpace: SpaceRecord = {
      ...cloneSpaceInput(payload),
      id,
      status,
      created_at: createdAt,
      areas: [],
    };

    set((state) => ({ spaces: [...state.spaces, newSpace], }));

    return id;
  },
  updateSpace: (spaceId, payload) => {
    set((state) => ({
      spaces: state.spaces.map((space) =>
        space.id === spaceId
          ? {
              ...space,
              ...cloneSpaceInput(payload),
            }
          : space
      ),
    }));
  },
  createArea: (spaceId, payload) => {
    const newArea: AreaRecord = {
      ...cloneAreaInput(payload),
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      spaces: state.spaces.map((space) =>
        space.id === spaceId
          ? {
              ...space,
              areas: [...space.areas, newArea],
            }
          : space
      ),
    }));
  },
  updateArea: (spaceId, areaId, payload) => {
    set((state) => ({
      spaces: state.spaces.map((space) =>
        space.id === spaceId
          ? {
              ...space,
              areas: space.areas.map((area) =>
                area.id === areaId
                  ? {
                      ...area,
                      ...cloneAreaInput(payload),
                    }
                  : area
              ),
            }
          : space
      ),
    }));
  },
}));

export const getSpaceById = (spaceId: string) => {
  return useSpacesStore.getState().spaces.find((space) => space.id === spaceId);
};

export const resetSpacesStore = () => {
  useSpacesStore.setState({ spaces: JSON.parse(JSON.stringify(INITIAL_SPACES)) as SpaceRecord[], });
};
