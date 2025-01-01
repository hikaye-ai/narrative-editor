import { saveToDB, loadFromDB, CHANGE_TYPES } from './indexedDB';

export const createChange = (type, payload) => ({
  type,
  payload
});

export const applyChange = (state, change) => {
  switch (change.type) {
    case CHANGE_TYPES.FIELD_UPDATE: {
      const { nodeId, field, value } = change.payload;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...state.nodes[nodeId],
            [field]: value
          }
        }
      };
    }

    case CHANGE_TYPES.NODE_CREATE: {
      const { node } = change.payload;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [node.id]: {
            description: node.description,
            location: node.location,
            actions: node.actions,
            position: node.position
          }
        }
      };
    }

    case CHANGE_TYPES.NODE_DELETE: {
      const { nodeId } = change.payload;
      const { [nodeId]: deleted, ...remainingNodes } = state.nodes;
      return {
        ...state,
        nodes: remainingNodes
      };
    }

    case CHANGE_TYPES.ACTION_CREATE: {
      const { nodeId, action } = change.payload;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...state.nodes[nodeId],
            actions: [...(state.nodes[nodeId].actions || []), action]
          }
        }
      };
    }

    case CHANGE_TYPES.ACTION_DELETE: {
      const { nodeId, actionIndex } = change.payload;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...state.nodes[nodeId],
            actions: state.nodes[nodeId].actions.filter((_, index) => index !== actionIndex)
          }
        }
      };
    }

    default:
      return state;
  }
};

export const reconstructState = async (initialState) => {
  const changes = await loadFromDB();
  return changes.reduce((state, change) => applyChange(state, change), initialState);
};

export const saveChange = async (change) => {
  await saveToDB(change);
}; 