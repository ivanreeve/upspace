import { create } from 'zustand';

import {
  AreaInput,
  AreaRecord,
  INITIAL_SPACES,
  SpaceInput,
  SpaceRecord
} from '@/data/spaces';

type SpacesState = {
  spaces: SpaceRecord[];
  createSpace: (payload: SpaceInput) => string;
  updateSpace: (spaceId: string, payload: SpaceInput) => void;
  createArea: (spaceId: string, payload: AreaInput) => void;
};

const cloneSpaceInput = (payload: SpaceInput): SpaceInput => ({ ...payload, });

const cloneAreaInput = (payload: AreaInput): AreaInput => ({ ...payload, });

export const useSpacesStore = create<SpacesState>((set) => ({
  spaces: INITIAL_SPACES,
  createSpace: (payload) => {
    const id = crypto.randomUUID();
    const newSpace: SpaceRecord = {
      ...cloneSpaceInput(payload),
      id,
      status: 'Draft',
      created_at: new Date().toISOString(),
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
}));

export const getSpaceById = (spaceId: string) => {
  return useSpacesStore.getState().spaces.find((space) => space.id === spaceId);
};

export const resetSpacesStore = () => {
  useSpacesStore.setState({ spaces: JSON.parse(JSON.stringify(INITIAL_SPACES)) as SpaceRecord[], });
};
