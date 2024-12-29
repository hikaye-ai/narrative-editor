import { useState, useCallback, useEffect } from 'react';

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 0.75 };

export const useHistoryStack = (initialState, storageKey) => {
  console.log('useHistoryStack init:', { storageKey, initialState });
  
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    console.log('useHistoryStack saved data:', { saved, storageKey });
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('useHistoryStack parsed data:', parsed);
        return {
          past: parsed.past || [],
          present: {
            scenes: parsed.present?.scenes || initialState.chapters[0].scenes,
            viewport: parsed.present?.viewport || DEFAULT_VIEWPORT
          },
          future: parsed.future || []
        };
      } catch (error) {
        console.error('Error parsing saved history:', error);
        return {
          past: [],
          present: {
            scenes: initialState.chapters[0].scenes,
            viewport: DEFAULT_VIEWPORT
          },
          future: []
        };
      }
    }

    return {
      past: [],
      present: {
        scenes: initialState.chapters[0].scenes,
        viewport: DEFAULT_VIEWPORT
      },
      future: []
    };
  });

  useEffect(() => {
    console.log('useHistoryStack saving to localStorage:', { storageKey });
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }, [history, storageKey]);

  const pushState = useCallback((newState, _collapsedNodes, viewport) => {
    console.log('Pushing new state:', {
      scenes: newState.chapters[0].scenes,
      viewport
    });
    
    setHistory(prev => ({
      past: [...prev.past, prev.present],
      present: {
        scenes: newState.chapters[0].scenes,
        viewport: viewport || prev.present.viewport
      },
      future: []
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      
      const newPresent = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: newPresent,
        future: [prev.present, ...prev.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      
      const newPresent = prev.future[0];
      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: prev.future.slice(1)
      };
    });
  }, []);

  return {
    state: {
      ...initialState,
      chapters: [{
        ...initialState.chapters[0],
        scenes: history.present.scenes
      }]
    },
    viewport: history.present.viewport,
    pushState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clearHistory: useCallback(() => {
      setHistory(prev => ({
        past: [],
        present: prev.present,
        future: []
      }));
    }, [])
  };
}; 