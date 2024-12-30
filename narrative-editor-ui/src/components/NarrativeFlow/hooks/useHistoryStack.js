import { useState, useCallback, useEffect } from 'react';
import { saveToDB, loadFromDB, deleteDatabase, closeDB } from '../utils/indexedDB';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const useHistoryStack = (initialState) => {
  const [state, setState] = useState(initialState);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved state from IndexedDB on mount
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const savedData = await loadFromDB();
        if (savedData) {
          setState(savedData.state);
          setPast(savedData.past);
          setFuture(savedData.future);
        }
      } catch (error) {
        console.error('Error loading from IndexedDB:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    loadSavedState();
  }, []);

  // Add cleanup function
  useEffect(() => {
    return () => {
      closeDB();
    };
  }, []);

  // Modified save effect
  useEffect(() => {
    if (!isInitialized) return;

    let isMounted = true;
    const saveState = async (retries = 0) => {
      try {
        if (!isMounted) return;
        
        // Only store the essential data
        const dataToStore = {
          state: {
            ...state,
            chapters: state.chapters.map(chapter => ({
              ...chapter,
              scenes: Object.fromEntries(
                Object.entries(chapter.scenes).map(([id, scene]) => [
                  id,
                  {
                    description: scene.description,
                    location: scene.location,
                    actions: scene.actions,
                    position: scene.position
                  }
                ])
              )
            }))
          },
          past: past.map(item => ({
            ...item,
            chapters: item.chapters.map(chapter => ({
              ...chapter,
              scenes: Object.fromEntries(
                Object.entries(chapter.scenes).map(([id, scene]) => [
                  id,
                  {
                    description: scene.description,
                    location: scene.location,
                    actions: scene.actions,
                    position: scene.position
                  }
                ])
              )
            }))
          })),
          future: future.map(item => ({
            ...item,
            chapters: item.chapters.map(chapter => ({
              ...chapter,
              scenes: Object.fromEntries(
                Object.entries(chapter.scenes).map(([id, scene]) => [
                  id,
                  {
                    description: scene.description,
                    location: scene.location,
                    actions: scene.actions,
                    position: scene.position
                  }
                ])
              )
            }))
          }))
        };

        await saveToDB(dataToStore);
      } catch (error) {
        console.error(`Error saving to IndexedDB (attempt ${retries + 1}):`, error);
        if (isMounted && retries < MAX_RETRIES) {
          await wait(RETRY_DELAY);
          await saveState(retries + 1);
        }
      }
    };

    saveState();

    return () => {
      isMounted = false;
    };
  }, [state, past, future, isInitialized]);

  const pushState = useCallback((newState) => {
    setPast(prev => [...prev, state]);
    setState(newState);
    setFuture([]);
  }, [state]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setPast(newPast);
    setState(previous);
    setFuture(prev => [state, ...prev]);
  }, [past, state]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [...prev, state]);
    setState(next);
    setFuture(newFuture);
  }, [future, state]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    state,
    pushState,
    undo,
    redo,
    clearHistory,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    isInitialized
  };
}; 