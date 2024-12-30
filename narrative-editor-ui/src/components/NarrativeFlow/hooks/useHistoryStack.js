import { useState, useCallback, useEffect } from 'react';

export const useHistoryStack = (initialState, maxHistory = 100) => {
  const [current, setCurrent] = useState(() => {
    try {
      const saved = localStorage.getItem('narrativeEditorCurrent');
      return saved ? parseInt(saved, 10) : 0;
    } catch (error) {
      console.error('Error loading current state:', error);
      return 0;
    }
  });
  
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('narrativeEditorHistory');
      return saved ? JSON.parse(saved) : [initialState];
    } catch (error) {
      console.error('Error loading history:', error);
      return [initialState];
    }
  });
  
  const canUndo = current > 0;
  const canRedo = current < history.length - 1;
  
  useEffect(() => {
    try {
      localStorage.setItem('narrativeEditorHistory', JSON.stringify(history));
      localStorage.setItem('narrativeEditorCurrent', current.toString());
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [history, current]);
  
  const pushState = useCallback((newState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, current + 1);
      newHistory.push(newState);
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setCurrent(prev => Math.min(prev + 1, maxHistory - 1));
  }, [current, maxHistory]);

  const undo = useCallback(() => {
    if (canUndo) {
      setCurrent(prev => prev - 1);
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setCurrent(prev => prev + 1);
    }
  }, [canRedo]);

  const clearHistory = useCallback(() => {
    setHistory(prev => [prev[current]]);
    setCurrent(0);
    
    localStorage.removeItem('narrativeEditorHistory');
    localStorage.removeItem('narrativeEditorCurrent');
  }, [current]);

  return {
    state: history[current],
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory
  };
}; 