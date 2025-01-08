import React, { useState } from 'react';
import NarrativeFlowEditor from './components/NarrativeFlow/NarrativeFlowEditor';
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
    // Create a clean copy of the narrative data without circular references
    const cleanNarrative = {
      ...narrativeData,
      chapters: narrativeData.chapters.map(chapter => ({
        id: chapter.id,
        scenes: Object.fromEntries(
          Object.entries(chapter.scenes).map(([id, scene]) => [
            id,
            {
              description: scene.description,
              location: scene.location,
              actions: Object.fromEntries(
                Object.entries(scene.actions || {}).map(([actionId, action]) => [
                  actionId,
                  {
                    next_scene: action.next_scene,
                    dice_check: action.dice_check,
                    dice_bypass_items: action.dice_bypass_items,
                    oxygen_change: action.oxygen_change,
                    health_change: action.health_change,
                    penalties: {
                      oxygen_loss: action.penalties?.oxygen_loss || 0,
                      health_loss: action.penalties?.health_loss || 0
                    },
                    rewards: {
                      items: action.rewards?.items || [],
                      oxygen_gain: action.rewards?.oxygen_gain || 0,
                      health_gain: action.rewards?.health_gain || 0,
                      xp_gain: action.rewards?.xp_gain || 0,
                      achievements: action.rewards?.achievements || []
                    }
                  }
                ])
              )
            }
          ])
        )
      }))
    };

    try {
      const dataStr = JSON.stringify(cleanNarrative, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'narrative.json';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting narrative:', error);
      alert('Failed to export narrative. See console for details.');
    }
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