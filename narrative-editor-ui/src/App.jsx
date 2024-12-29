import React, { useState, useEffect } from 'react';
import NarrativeFlowEditor from './components/NarrativeFlowEditor';
import ItemsEditor from './components/ItemsEditor';
import FileUploader from './components/FileUploader';

const DEFAULT_NARRATIVE = {
  items: {},
  chapters: [{
    chapter_id: 1,
    title: "New Chapter",
    location: "",
    initial_oxygen: 100,
    initial_health: 100,
    scenes: {}
  }]
};

function App() {
  const [narrative, setNarrative] = useState(() => {
    const saved = localStorage.getItem('narrative');
    return saved ? JSON.parse(saved) : DEFAULT_NARRATIVE;
  });
  
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'narrative';
  });

  useEffect(() => {
    localStorage.setItem('narrative', JSON.stringify(narrative));
  }, [narrative]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const handleSaveScene = (sceneId, updatedScene) => {
    setNarrative(currentNarrative => ({
      ...currentNarrative,
      lastModified: Date.now(),
      chapters: currentNarrative.chapters.map(chapter => ({
        ...chapter,
        scenes: {
          ...chapter.scenes,
          [sceneId]: {
            ...chapter.scenes[sceneId],
            ...updatedScene,
          },
        },
      })),
    }));

    try {
      localStorage.setItem('narrative', JSON.stringify(narrative));
    } catch (error) {
      console.warn('Failed to save narrative:', error);
    }
  };

  const handleSaveItems = (updatedItems) => {
    setNarrative(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const handleFileLoad = (loadedNarrative) => {
    if (!loadedNarrative || !loadedNarrative.chapters) {
      console.error('Invalid narrative format:', loadedNarrative);
      alert('Invalid narrative file format');
      return;
    }

    // First clear all history
    localStorage.removeItem('narrative');
    localStorage.removeItem('items-history');
    localStorage.removeItem('narrative-history');

    // Then set the new narrative in localStorage
    localStorage.setItem('narrative', JSON.stringify(loadedNarrative));
    
    // Initialize history with the loaded narrative
    const initialHistory = {
      past: [],
      present: {
        scenes: loadedNarrative.chapters[0].scenes,
        collapsedNodes: new Set(),
        viewport: { x: 0, y: 0, zoom: 0.75 }
      },
      future: []
    };

    // Save initial history state
    localStorage.setItem('narrative-history', JSON.stringify({
      past: [],
      present: {
        scenes: loadedNarrative.chapters[0].scenes,
        collapsedNodes: [],  // Empty array for serialization
        viewport: { x: 0, y: 0, zoom: 0.75 }
      },
      future: []
    }));

    // Initialize items history
    localStorage.setItem('items-history', JSON.stringify({
      past: [],
      present: loadedNarrative.items,
      future: []
    }));

    // Finally update the state
    setNarrative(loadedNarrative);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-100 p-4 border-b">
        <div className="flex justify-between items-center">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('narrative')}
              className={`px-4 py-2 rounded ${
                activeTab === 'narrative' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white hover:bg-gray-100'
              }`}
            >
              Narrative Editor
            </button>
            <button
              onClick={() => setActiveTab('items')}
              className={`px-4 py-2 rounded ${
                activeTab === 'items' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white hover:bg-gray-100'
              }`}
            >
              Items Editor
            </button>
          </div>
          <FileUploader 
            onFileLoad={handleFileLoad}
            narrative={narrative}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'narrative' ? (
          <NarrativeFlowEditor 
            narrative={narrative} 
            onSaveScene={handleSaveScene} 
          />
        ) : (
          <ItemsEditor 
            items={narrative.items} 
            onSaveItems={handleSaveItems} 
          />
        )}
      </div>
    </div>
  );
}

export default App;