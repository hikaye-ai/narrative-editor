import React, { useState } from 'react';

const DICE_CHECK_OPTIONS = [
  { value: null, label: 'None' },
  { value: 'STR', label: 'STR' },
  { value: 'SOC', label: 'SOC' },
  { value: 'TECH', label: 'TECH' },
];

const SceneEditor = ({ scene, onSave, onClose }) => {
  const [editedScene, setEditedScene] = useState(scene);
  const [newActionName, setNewActionName] = useState('');

  // Get all available scene names from the parent component
  const availableScenes = Object.keys(scene.actions).reduce((scenes, action) => {
    const nextScene = scene.actions[action].next_scene;
    if (nextScene && !scenes.includes(nextScene)) {
      scenes.push(nextScene);
    }
    return scenes;
  }, []);

  const handleSceneChange = (field, value) => {
    setEditedScene(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleActionChange = (actionName, field, value) => {
    setEditedScene(prev => ({
      ...prev,
      actions: {
        ...prev.actions,
        [actionName]: {
          ...prev.actions[actionName],
          [field]: value
        }
      }
    }));
  };

  const addNewAction = () => {
    if (!newActionName.trim()) return;
    
    setEditedScene(prev => ({
      ...prev,
      actions: {
        ...prev.actions,
        [newActionName]: {
          next_scene: '',
          dice_check: null,
          oxygen_change: 0,
          health_change: 0,
          penalties: {
            oxygen_loss: 0,
            health_loss: 0
          },
          rewards: {
            items: [],
            oxygen_gain: 0,
            health_gain: 0,
            xp_gain: 0,
            achievements: []
          }
        }
      }
    }));
    setNewActionName('');
  };

  const deleteAction = (actionName) => {
    const newActions = { ...editedScene.actions };
    delete newActions[actionName];
    setEditedScene(prev => ({
      ...prev,
      actions: newActions
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Edit Scene</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Scene Basic Info */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={editedScene.name}
              onChange={(e) => handleSceneChange('name', e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={editedScene.description}
              onChange={(e) => handleSceneChange('description', e.target.value)}
              className="w-full p-2 border rounded h-24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              value={editedScene.location}
              onChange={(e) => handleSceneChange('location', e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        {/* Actions Section */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Actions</h3>
          
          {/* Add New Action */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newActionName}
              onChange={(e) => setNewActionName(e.target.value)}
              placeholder="New action name"
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={addNewAction}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Action
            </button>
          </div>

          {/* Action List */}
          <div className="space-y-6">
            {Object.entries(editedScene.actions).map(([actionName, action]) => (
              <div key={actionName} className="border rounded p-4">
                <div className="flex justify-between mb-2">
                  <h4 className="font-medium">{actionName}</h4>
                  <button
                    onClick={() => deleteAction(actionName)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Next Scene</label>
                    <select
                      value={action.next_scene}
                      onChange={(e) => handleActionChange(actionName, 'next_scene', e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Select next scene...</option>
                      {availableScenes.map(sceneName => (
                        <option key={sceneName} value={sceneName}>
                          {sceneName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Dice Check</label>
                    <select
                      value={action.dice_check || ''}
                      onChange={(e) => handleActionChange(actionName, 'dice_check', e.target.value || null)}
                      className="w-full p-2 border rounded"
                    >
                      {DICE_CHECK_OPTIONS.map(option => (
                        <option key={option.value || 'null'} value={option.value || ''}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Oxygen Change</label>
                    <input
                      type="number"
                      value={action.oxygen_change}
                      onChange={(e) => handleActionChange(actionName, 'oxygen_change', parseInt(e.target.value))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Health Change</label>
                    <input
                      type="number"
                      value={action.health_change}
                      onChange={(e) => handleActionChange(actionName, 'health_change', parseInt(e.target.value))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onSave(editedScene)}
            className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
          >
            Save Changes
          </button>
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SceneEditor; 