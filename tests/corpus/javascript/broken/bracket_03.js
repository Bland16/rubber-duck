// covers: a module with import and export; object and array literals across lines
import { nanoid } from 'nanoid';

export const initialState = {
  ducks: [],
  selectedId: null,
  filter: 'all',
};

export function reducer(state = initialState, action) {
  switch (action.type) {
    case 'duck/added': {
      const duck = { id: nanoid(), name: action.name, squeaks: 0 };
      return { ...state, ducks: [...state.ducks, duck], selectedId: duck.id };
    }
    case 'duck/squeaked':
      return {
        ...state,
        ducks: state.ducks.map((d) =>
          d.id === action.id ? { ...d, squeaks: d.squeaks + 1 } : d
        ),
      };
    case 'duck/removed':
      return {
        ...state,
        ducks: state.ducks.filter((d) => d.id !== action.id,
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    default:
      return state;
  }
}

export const selectLoudest = (state) =>
  state.ducks.reduce((best, d) => (best && best.squeaks >= d.squeaks ? best : d), null);
