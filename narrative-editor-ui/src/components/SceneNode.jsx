import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import Select from 'react-select';
import Creatable from 'react-select/creatable';
import narrativeData from '../../narrative.json';

// Add DICE_CHECK_OPTIONS constant
const DICE_CHECK_OPTIONS = [
  { value: null, label: 'None' },
  { value: 'STR', label: 'STR' },
  { value: 'SOC', label: 'SOC' },
  { value: 'TECH', label: 'TECH' },
];

export const SceneNode = React.memo(({ 
  data, 
  id, 
  onSave, 
  allScenes, 
  isCollapsed, 
  onCollapse,
  onRenameScene,
  onDeleteScene,
  canDelete
}) => {
  const [editedScene, setEditedScene] = useState(data);
  const [newActionName, setNewActionName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [sceneName, setSceneName] = useState(id);

  // Update local state when props change
  React.useEffect(() => {
    setEditedScene(data);
  }, [data]);

  const handleSceneChange = (field, value) => {
    const updated = {
      ...editedScene,
      [field]: value
    };
    setEditedScene(updated);
    onSave(id, updated);
  };

  const handleActionChange = (actionName, field, value) => {
    let updatedValue = value;
    
    // Handle nested fields (like rewards.items)
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      updatedValue = {
        ...editedScene.actions[actionName][parent],
        [child]: value
      };
      field = parent;
    }

    const updated = {
      ...editedScene,
      actions: {
        ...editedScene.actions,
        [actionName]: {
          ...editedScene.actions[actionName],
          [field]: updatedValue
        }
      }
    };
    setEditedScene(updated);
    onSave(id, updated);
  };

  const addNewAction = () => {
    if (!newActionName.trim()) return;
    
    const updated = {
      ...editedScene,
      actions: {
        ...editedScene.actions,
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
    };
    setEditedScene(updated);
    onSave(id, updated);
    setNewActionName('');
  };

  const deleteAction = (actionName) => {
    const newActions = { ...editedScene.actions };
    delete newActions[actionName];
    const updated = {
      ...editedScene,
      actions: newActions
    };
    setEditedScene(updated);
    onSave(id, updated);
  };

  // Prepare options for the Select component
  const sceneOptions = allScenes.map(sceneId => ({ value: sceneId, label: sceneId }));
  const itemOptions = Object.keys(narrativeData.items).map(itemName => ({ value: itemName, label: itemName }));

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '28px',
      height: '28px',
      borderColor: state.isFocused ? '#2563eb' : base.borderColor,
      boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : base.boxShadow,
      '&:hover': {
        borderColor: '#2563eb',
      },
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    container: (base) => ({
      ...base,
      zIndex: 999,
    }),
    valueContainer: (base) => ({
      ...base,
      height: '28px',
      padding: '0 6px',
    }),
    input: (base) => ({
      ...base,
      margin: '0px',
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: '28px',
    }),
  };

  const handleSceneNameSubmit = () => {
    if (sceneName && sceneName !== id) {
      onRenameScene(id, sceneName);
    }
    setIsEditingName(false);
  };

  const handleSceneNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSceneNameSubmit();
    } else if (e.key === 'Escape') {
      setSceneName(id);
      setIsEditingName(false);
    }
  };

  // Add console log to debug collapse
  const handleCollapse = () => {
    console.log('Collapse clicked:', { id, currentState: isCollapsed });
    onCollapse(id, !isCollapsed);
  };

  return (
    <>
      {/* Only show NodeResizer when not collapsed */}
      {!isCollapsed && (
        <NodeResizer 
          minWidth={400}
          minHeight={400}
          isVisible={true}
          lineClassName="border-blue-400"
          handleClassName="h-3 w-3 bg-white border-2 border-blue-400"
        />
      )}
      
      <div className={`bg-white rounded-lg shadow-lg border-2 border-gray-300 h-full w-full flex flex-col ${
        isCollapsed ? 'min-h-[100px]' : 'min-h-[400px]'
      }`}>
        <Handle type="target" position={Position.Left} />
        
        {/* Header with editable scene name and delete button */}
        <div className="flex justify-between items-center p-2 border-b bg-gray-50">
          <div className="flex-grow flex items-center gap-2">
            {isEditingName ? (
              <input
                type="text"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                onBlur={handleSceneNameSubmit}
                onKeyDown={handleSceneNameKeyDown}
                className="font-bold text-lg text-blue-800 bg-white border rounded px-2 flex-grow mr-2"
                autoFocus
              />
            ) : (
              <div 
                onClick={() => setIsEditingName(true)}
                className="font-bold text-lg text-blue-800 cursor-pointer hover:bg-blue-50 px-2 rounded flex-grow"
                title="Click to edit scene name"
              >
                {id}
              </div>
            )}
            {canDelete && (
              <button
                onClick={() => onDeleteScene(id)}
                className="text-red-500 hover:text-red-700 p-1 rounded"
                title="Delete scene"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleCollapse}
            className="p-1 hover:bg-gray-200 rounded ml-2"
          >
            {isCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Collapsible content */}
        {isCollapsed ? (
          <div className="p-2 text-sm overflow-hidden">
            <div className="text-gray-600 truncate">{editedScene.description}</div>
            <div className="mt-1 text-gray-500 truncate">
              Actions: {Object.keys(editedScene.actions).join(', ')}
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto h-full">
            <div className="p-4">
              {/* Scene Basic Info */}
              <div className="space-y-3 mb-4">
                <textarea
                  value={editedScene.description}
                  onChange={(e) => handleSceneChange('description', e.target.value)}
                  className="w-full p-2 border rounded text-sm h-20"
                  placeholder="Description"
                />
                <input
                  type="text"
                  value={editedScene.location}
                  onChange={(e) => handleSceneChange('location', e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="Location"
                />
              </div>

              {/* Actions Section */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Actions</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newActionName}
                      onChange={(e) => setNewActionName(e.target.value)}
                      placeholder="New action"
                      className="p-1 border rounded text-sm w-32"
                    />
                    <button
                      onClick={addNewAction}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(editedScene.actions).map(([actionName, action]) => (
                    <div key={actionName} className="border rounded p-2 text-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{actionName}</span>
                        <button
                          onClick={() => deleteAction(actionName)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <label className="block text-xs font-medium mb-1">Next Scene</label>
                          <select
                            value={editedScene.actions[actionName].next_scene || ''}
                            onChange={(e) => handleActionChange(actionName, 'next_scene', e.target.value)}
                            className="w-full p-1 border rounded text-sm"
                          >
                            <option value="">Select next scene...</option>
                            {allScenes.map(sceneId => (
                              <option key={sceneId} value={sceneId}>
                                {sceneId}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Dice Check</label>
                          <select
                            value={editedScene.actions[actionName].dice_check || ''}
                            onChange={(e) => handleActionChange(actionName, 'dice_check', e.target.value || null)}
                            className="w-full p-1 border rounded text-sm"
                          >
                            {DICE_CHECK_OPTIONS.map(option => (
                              <option key={option.value || 'null'} value={option.value || ''}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Dice Bypass Items</label>
                          <select
                            multiple
                            value={editedScene.actions[actionName].dice_bypass_items || []}
                            onChange={(e) => {
                              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                              handleActionChange(actionName, 'dice_bypass_items', selectedOptions);
                            }}
                            className="w-full p-1 border rounded text-sm"
                            size={3}
                          >
                            {itemOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Reward Items</label>
                          <select
                            multiple
                            value={editedScene.actions[actionName].rewards.items || []}
                            onChange={(e) => {
                              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                              handleActionChange(actionName, 'rewards.items', selectedOptions);
                            }}
                            className="w-full p-1 border rounded text-sm"
                            size={3}
                          >
                            {itemOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Oxygen Change</label>
                          <input
                            type="number"
                            value={editedScene.actions[actionName].oxygen_change}
                            onChange={(e) => handleActionChange(actionName, 'oxygen_change', parseInt(e.target.value))}
                            className="w-full p-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Health Change</label>
                          <input
                            type="number"
                            value={editedScene.actions[actionName].health_change}
                            onChange={(e) => handleActionChange(actionName, 'health_change', parseInt(e.target.value))}
                            className="w-full p-1 border rounded text-sm"
                          />
                        </div>

                        {/* Add Penalties Section */}
                        <div className="col-span-2 border-t mt-2 pt-2">
                          <h4 className="text-xs font-medium mb-2">Dice Check Failure Penalties</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium mb-1">Oxygen Loss</label>
                              <input
                                type="number"
                                value={editedScene.actions[actionName].penalties.oxygen_loss}
                                onChange={(e) => handleActionChange(
                                  actionName,
                                  'penalties.oxygen_loss',
                                  parseInt(e.target.value)
                                )}
                                className="w-full p-1 border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Health Loss</label>
                              <input
                                type="number"
                                value={editedScene.actions[actionName].penalties.health_loss}
                                onChange={(e) => handleActionChange(
                                  actionName,
                                  'penalties.health_loss',
                                  parseInt(e.target.value)
                                )}
                                className="w-full p-1 border rounded text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <Handle type="source" position={Position.Right} />
      </div>
    </>
  );
}); 