import React, { useState } from 'react';
import NarrativeFlowEditor from './components/NarrativeFlowEditor';
import narrative from '../narrative.json';

function App() {
  const [narrativeData, setNarrativeData] = useState(narrative);

  const handleSaveScene = (sceneId, updatedScene) => {
    setNarrativeData(prev => ({
      ...prev,
      chapters: prev.chapters.map(chapter => ({
        ...chapter,
        scenes: {
          ...chapter.scenes,
          [sceneId]: updatedScene
        }
      }))
    }));
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(narrativeData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'narrative.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Narrative Flow Editor</h1>
        <button 
          onClick={handleExport}
          className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded"
        >
          Export JSON
        </button>
      </div>
      <div className="flex-1">
        <NarrativeFlowEditor 
          narrative={narrativeData} 
          onSaveScene={handleSaveScene}
        />
      </div>
    </div>
  );
}

export default App;