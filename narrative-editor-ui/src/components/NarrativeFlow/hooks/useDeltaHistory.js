import { useState, useCallback, useEffect } from 'react';
import { saveChange, getChanges, saveNarrative } from '../utils/indexedDB';

export const useDeltaHistory = (initialNarrative) => {
  const [currentState, setCurrentState] = useState(initialNarrative);
  const [changes, setChanges] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);

  // Save initial narrative and load changes on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Save initial narrative if we have one
        if (initialNarrative) {
          await saveNarrative({
            id: 'default',
            ...initialNarrative
          });
        }

        const savedChanges = await getChanges();
        if (savedChanges && savedChanges.length > 0) {
          setChanges(savedChanges);
          setCurrentIndex(savedChanges.length - 1);
          
          // Apply all changes to get current state
          const finalState = savedChanges.reduce((state, change) => 
            applyChange(state, change), initialNarrative);
          setCurrentState(finalState);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing history:', error);
        // Even if there's an error, we should show the initial narrative
        setIsLoading(false);
      }
    };

    init();
  }, [initialNarrative]);

  const applyChange = useCallback((state, change) => {
    const newState = { ...state };
    const chapter = newState.chapters[0];

    switch (change.type) {
      case 'SCENE_FIELD_UPDATE':
        chapter.scenes[change.sceneId] = {
          ...chapter.scenes[change.sceneId],
          [change.data.field]: change.data.newValue
        };
        break;

      case 'SCENE_CREATE':
        chapter.scenes[change.sceneId] = change.data.newValue;
        break;

      case 'SCENE_DELETE':
        delete chapter.scenes[change.sceneId];
        break;

      case 'ACTION_CREATE':
      case 'ACTION_UPDATE':
        if (!chapter.scenes[change.sceneId].actions) {
          chapter.scenes[change.sceneId].actions = {};
        }
        chapter.scenes[change.sceneId].actions[change.data.actionId] = change.data.newValue;
        break;

      case 'ACTION_DELETE':
        delete chapter.scenes[change.sceneId].actions[change.data.actionId];
        break;
    }

    return newState;
  }, []);

  const revertChange = useCallback((state, change) => {
    const newState = { ...state };
    const chapter = newState.chapters[0];

    switch (change.type) {
      case 'SCENE_FIELD_UPDATE':
        chapter.scenes[change.sceneId] = {
          ...chapter.scenes[change.sceneId],
          [change.data.field]: change.data.oldValue
        };
        break;

      case 'SCENE_CREATE':
        delete chapter.scenes[change.sceneId];
        break;

      case 'SCENE_DELETE':
        chapter.scenes[change.sceneId] = change.data.oldValue;
        break;

      case 'ACTION_CREATE':
        delete chapter.scenes[change.sceneId].actions[change.data.actionId];
        break;

      case 'ACTION_UPDATE':
        chapter.scenes[change.sceneId].actions[change.data.actionId] = change.data.oldValue;
        break;

      case 'ACTION_DELETE':
        chapter.scenes[change.sceneId].actions[change.data.actionId] = change.data.oldValue;
        break;
    }

    return newState;
  }, []);

  const pushChange = useCallback(async (change) => {
    try {
      await saveChange(change);
      setChanges(prevChanges => {
        // Remove any future changes if we're not at the end
        const newChanges = prevChanges.slice(0, currentIndex + 1);
        return [...newChanges, change];
      });
      setCurrentState(prevState => applyChange(prevState, change));
      setCurrentIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error saving change:', error);
    }
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex >= 0) {
      const change = changes[currentIndex];
      setCurrentState(prevState => revertChange(prevState, change));
      setCurrentIndex(prev => prev - 1);
      return true;
    }
    return false;
  }, [changes, currentIndex, revertChange]);

  const redo = useCallback(() => {
    if (currentIndex < changes.length - 1) {
      const change = changes[currentIndex + 1];
      setCurrentState(prevState => applyChange(prevState, change));
      setCurrentIndex(prev => prev + 1);
      return true;
    }
    return false;
  }, [changes, currentIndex, applyChange]);

  return {
    state: currentState,
    pushChange,
    undo,
    redo,
    canUndo: currentIndex >= 0,
    canRedo: currentIndex < changes.length - 1,
    isLoading
  };
}; 