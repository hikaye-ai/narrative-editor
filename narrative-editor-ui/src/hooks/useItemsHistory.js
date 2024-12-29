import { useState, useCallback, useEffect } from 'react';

export const useItemsHistory = (initialState, storageKey) => {
  // Initialize state from localStorage if available
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          past: parsed.past || [],
          present: parsed.present || initialState,
          future: parsed.future || []
        };
      } catch (error) {
        console.error('Error parsing saved history:', error);
        return {
          past: [],
          present: initialState,
          future: []
        };
      }
    }
    return {
      past: [],
      present: initialState,
      future: []
    };
  });

  // Save to localStorage whenever history changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(history));
  }, [history, storageKey]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const pushState = useCallback((newState) => {
    setHistory(prev => ({
      past: [...prev.past, prev.present],
      present: newState,
      future: []
    }));
  }, []);

  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory(prev => ({
      past: prev.past.slice(0, -1),
      present: prev.past[prev.past.length - 1],
      future: [prev.present, ...prev.future]
    }));
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory(prev => ({
      past: [...prev.past, prev.present],
      present: prev.future[0],
      future: prev.future.slice(1)
    }));
  }, [canRedo]);

  const clearHistory = useCallback(() => {
    setHistory(prev => ({
      past: [],
      present: prev.present,
      future: []
    }));
  }, []);

  const reset = useCallback(() => {
    setHistory({
      past: [],
      present: initialState,
      future: []
    });
  }, [initialState]);

  return {
    state: history.present,
    pushState,
    undo,
    redo,
    clearHistory,
    reset,
    canUndo,
    canRedo
  };
}; 