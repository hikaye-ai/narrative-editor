import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Handle, Position, NodeResizer } from 'reactflow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import { DICE_CHECK_OPTIONS } from '../constants';
import { extractUniqueItems } from '../utils/flowUtils';

const O2_SYMBOL = 'O₂';

const SceneNode = React.memo(({ 
  data, 
  id,
}) => {
  const [editedScene, setEditedScene] = useState(data);
  const [localScene, setLocalScene] = useState(data);
  const [newActionName, setNewActionName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [sceneName, setSceneName] = useState(id);
  const [collapsedActions, setCollapsedActions] = useState(() => {
    return new Set(Object.keys(data.actions || {}));
  });

  const {
    onSave,
    allScenes,
    isCollapsed,
    onCollapse,
    onRenameScene,
    onDeleteScene,
    narrativeState,
    isSceneReferenced,
    originalId
  } = data;

  const itemOptions = useMemo(() => 
    extractUniqueItems(narrativeState),
    [narrativeState]
  );

  // Update both states when props change
  useEffect(() => {
    setEditedScene(data);
    setLocalScene(data);
    
    // Only add newly created actions to the collapsed set
    setCollapsedActions(prev => {
      const newSet = new Set(prev);
      Object.keys(data.actions || {}).forEach(actionName => {
        // Only add if it's a new action that doesn't exist in prev
        if (!editedScene.actions[actionName]) {
          newSet.add(actionName);
        }
      });
      return newSet;
    });
  }, [data, editedScene.actions]);

  // Handle local changes without saving
  const handleLocalChange = (field, value) => {
    setLocalScene(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save changes on blur
  const handleBlur = (field, value) => {
    if (value !== editedScene[field]) {
      const updated = {
        ...editedScene,
        [field]: value
      };
      setEditedScene(updated);
      onSave(originalId, updated);
    }
  };

  // Handle local action changes
  const handleLocalActionChange = (actionName, field, value) => {
    let updatedValue = value;
    let targetField = field;
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (parent === 'rewards') {
        updatedValue = {
          ...localScene.actions[actionName].rewards,
          [child]: value
        };
        targetField = 'rewards';
      } else if (parent === 'penalties') {
        updatedValue = {
          ...localScene.actions[actionName].penalties,
          [child]: value
        };
        targetField = 'penalties';
      }
    }

    setLocalScene(prev => ({
      ...prev,
      actions: {
        ...prev.actions,
        [actionName]: {
          ...prev.actions[actionName],
          [targetField]: updatedValue
        }
      }
    }));
  };

  // Save action changes on blur
  const handleActionBlur = (actionName, field, value) => {
    let currentValue;
    let updatedValue = value;
    let targetField = field;

    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (parent === 'rewards') {
        currentValue = editedScene.actions[actionName].rewards[child];
        updatedValue = {
          ...editedScene.actions[actionName].rewards,
          [child]: value
        };
        targetField = 'rewards';
      } else if (parent === 'penalties') {
        currentValue = editedScene.actions[actionName].penalties[child];
        updatedValue = {
          ...editedScene.actions[actionName].penalties,
          [child]: value
        };
        targetField = 'penalties';
      }
    } else {
      currentValue = editedScene.actions[actionName][field];
    }

    if (JSON.stringify(value) !== JSON.stringify(currentValue)) {
      const updated = {
        ...editedScene,
        actions: {
          ...editedScene.actions,
          [actionName]: {
            ...editedScene.actions[actionName],
            [targetField]: updatedValue
          }
        }
      };
      setEditedScene(updated);
      onSave(originalId, updated);
    }
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
          dice_bypass_items: [],
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
    onSave(originalId, updated);
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
    onSave(originalId, updated);
  };

  const handleSceneNameSubmit = () => {
    if (sceneName && sceneName !== originalId) {
      onRenameScene(originalId, sceneName);
    }
    setIsEditingName(false);
  };

  const handleSceneNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSceneNameSubmit();
    } else if (e.key === 'Escape') {
      setSceneName(originalId);
      setIsEditingName(false);
    }
  };

  const nodeIsCollapsed = isCollapsed(originalId);

  const handleNumberChange = (actionName, field, value, isButton = false) => {
    handleLocalActionChange(actionName, field, value);
    
    // If change came from increment/decrement buttons, save immediately
    if (isButton) {
      handleActionBlur(actionName, field, value);
    }
  };

  const toggleActionCollapse = (actionName) => {
    setCollapsedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionName)) {
        newSet.delete(actionName);
      } else {
        newSet.add(actionName);
      }
      return newSet;
    });
  };

  const handleActionChange = (actionIndex, field, value) => {
    const newActions = [...data.actions];
    newActions[actionIndex] = {
      ...newActions[actionIndex],
      [field]: value
    };

    // If changing the next scene, call onSceneConnectionChange
    if (field === 'next_scene') {
      data.onSceneConnectionChange(id, actionIndex, value);
    }

    const updatedScene = {
      ...data,
      actions: newActions
    };
    
    data.onSave(id, updatedScene);
  };

  return (
    <>
      <NodeResizer 
        minWidth={400}
        minHeight={nodeIsCollapsed ? 100 : 400}
        maxHeight={nodeIsCollapsed ? 200 : 1200}
        isVisible={true}
        lineClassName="border-blue-400"
        handleClassName="h-3 w-3 bg-white border-2 border-blue-400"
      />
      <div className={`bg-white rounded-lg shadow-lg border-2 border-gray-300 w-full flex flex-col ${
        nodeIsCollapsed ? '' : 'max-h-[1200px] h-full'
      }`}>
        <Handle type="target" position={Position.Left} />
        
        {/* Header */}
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
                {originalId}
              </div>
            )}
            {!isSceneReferenced(originalId) && (
              <button
                onClick={() => onDeleteScene(originalId)}
                className="p-1 rounded text-red-500 hover:text-red-700"
                title="Delete scene"
              >
                <DeleteIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => onCollapse(originalId, !nodeIsCollapsed)}
            className="p-1 hover:bg-gray-200 rounded ml-2"
          >
            {nodeIsCollapsed ? (
              <ExpandMoreIcon className="w-5 h-5" />
            ) : (
              <ExpandLessIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Content */}
        {nodeIsCollapsed ? (
          <div className="p-2 text-sm">
            <div className="text-gray-600">{editedScene.description}</div>
            <div className="mt-1 text-gray-500">
              Actions: {Object.keys(editedScene.actions).join(', ')}
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="p-4">
              {/* Scene Basic Info */}
              <div className="space-y-3 mb-4">
                <textarea
                  value={localScene.description}
                  onChange={(e) => handleLocalChange('description', e.target.value)}
                  onBlur={(e) => handleBlur('description', e.target.value)}
                  className="w-full p-2 border rounded text-sm h-20"
                  placeholder="Description"
                />
                <input
                  type="text"
                  value={localScene.location}
                  onChange={(e) => handleLocalChange('location', e.target.value)}
                  onBlur={(e) => handleBlur('location', e.target.value)}
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
                  {Object.entries(localScene.actions).map(([actionName, action]) => (
                    <div key={actionName} className="border rounded p-2 text-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 flex-grow">
                          <button
                            onClick={() => toggleActionCollapse(actionName)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {collapsedActions.has(actionName) ? (
                              <ExpandMoreIcon className="w-4 h-4" />
                            ) : (
                              <ExpandLessIcon className="w-4 h-4" />
                            )}
                          </button>
                          <span className="font-medium">{actionName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={action.next_scene || ''}
                            onChange={(e) => handleLocalActionChange(actionName, 'next_scene', e.target.value)}
                            onBlur={(e) => handleActionBlur(actionName, 'next_scene', e.target.value)}
                            className="p-1 border rounded text-sm w-40"
                          >
                            <option value="">Next scene...</option>
                            {allScenes.map(sceneId => (
                              <option key={sceneId} value={sceneId}>
                                {sceneId}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteAction(actionName)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Add info text for collapsed state */}
                      {collapsedActions.has(actionName) && (
                        <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap break-words">
                          {[
                            // Basic info
                            [
                              action.dice_check && `Dice: ${action.dice_check}`,
                              `${O2_SYMBOL}: ${action.oxygen_change} • HP: ${action.health_change}`
                            ].filter(Boolean).join(' • '),

                            // Dice bypass items
                            action.dice_bypass_items?.length > 0 && 
                              `Bypass: ${action.dice_bypass_items.join(', ')}`,

                            // Penalties group
                            [
                              action.penalties?.oxygen_loss > 0 && `${O2_SYMBOL}: -${action.penalties.oxygen_loss}`,
                              action.penalties?.health_loss > 0 && `HP: -${action.penalties.health_loss}`
                            ].some(Boolean) && 
                              `Penalties: ${[
                                action.penalties?.oxygen_loss > 0 && `${O2_SYMBOL}: -${action.penalties.oxygen_loss}`,
                                action.penalties?.health_loss > 0 && `HP: -${action.penalties.health_loss}`
                              ].filter(Boolean).join(' • ')}`,

                            // Rewards group
                            [
                              action.rewards?.oxygen_gain > 0 && `${O2_SYMBOL}: +${action.rewards.oxygen_gain}`,
                              action.rewards?.health_gain > 0 && `HP: +${action.rewards.health_gain}`,
                              action.rewards?.xp_gain > 0 && `XP: ${action.rewards.xp_gain}`
                            ].some(Boolean) && 
                              `Rewards: ${[
                                action.rewards?.oxygen_gain > 0 && `${O2_SYMBOL}: +${action.rewards.oxygen_gain}`,
                                action.rewards?.health_gain > 0 && `HP: +${action.rewards.health_gain}`,
                                action.rewards?.xp_gain > 0 && `XP: ${action.rewards.xp_gain}`
                              ].filter(Boolean).join(' • ')}`,

                            // Items and achievements
                            action.rewards?.items?.length > 0 && 
                              `Items: ${action.rewards.items.join(', ')}`,
                            action.rewards?.achievements?.length > 0 && 
                              `Achievements: ${action.rewards.achievements.join(', ')}`
                          ].filter(Boolean).join('\n')}
                        </div>
                      )}

                      {/* Rest of the action content */}
                      {!collapsedActions.has(actionName) && (
                        <div className="grid grid-cols-2 gap-2">
                          {/* Action Fields */}
                          <div className="relative">
                            <label className="block text-xs font-medium mb-1">Next Scene</label>
                            <select
                              value={action.next_scene || ''}
                              onChange={(e) => handleLocalActionChange(actionName, 'next_scene', e.target.value)}
                              onBlur={(e) => handleActionBlur(actionName, 'next_scene', e.target.value)}
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
                              value={action.dice_check || ''}
                              onChange={(e) => handleLocalActionChange(actionName, 'dice_check', e.target.value || null)}
                              onBlur={(e) => handleActionBlur(actionName, 'dice_check', e.target.value || null)}
                              className="w-full p-1 border rounded text-sm"
                            >
                              {DICE_CHECK_OPTIONS.map(option => (
                                <option key={option.value || 'null'} value={option.value || ''}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Stats Changes */}
                          <div>
                            <label className="block text-xs font-medium mb-1">Oxygen Change</label>
                            <input
                              type="number"
                              value={action.oxygen_change}
                              onChange={(e) => {
                                const isButton = e.nativeEvent.inputType === 'insertReplacementText';
                                handleNumberChange(actionName, 'oxygen_change', parseInt(e.target.value) || 0, isButton);
                              }}
                              onBlur={(e) => handleActionBlur(actionName, 'oxygen_change', parseInt(e.target.value) || 0)}
                              className="w-full p-1 border rounded text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium mb-1">Health Change</label>
                            <input
                              type="number"
                              value={action.health_change}
                              onChange={(e) => {
                                const isButton = e.nativeEvent.inputType === 'insertReplacementText';
                                handleNumberChange(actionName, 'health_change', parseInt(e.target.value) || 0, isButton);
                              }}
                              onBlur={(e) => handleActionBlur(actionName, 'health_change', parseInt(e.target.value) || 0)}
                              className="w-full p-1 border rounded text-sm"
                            />
                          </div>

                          {/* Dice Bypass Items */}
                          <div>
                            <label className="block text-xs font-medium mb-1">Dice Bypass Items</label>
                            <select
                              multiple
                              value={action.dice_bypass_items || []}
                              onChange={(e) => {
                                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                                handleLocalActionChange(actionName, 'dice_bypass_items', selectedOptions);
                                handleActionBlur(actionName, 'dice_bypass_items', selectedOptions);
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

                          {/* Penalties Section */}
                          <div className="col-span-2 border-t mt-2 pt-2">
                            <h4 className="text-xs font-medium mb-2">Dice Check Failure Penalties</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium mb-1">Oxygen Loss</label>
                                <input
                                  type="number"
                                  value={action.penalties?.oxygen_loss || 0}
                                  onChange={(e) => {
                                    const isButton = e.nativeEvent.inputType === 'insertReplacementText';
                                    handleNumberChange(actionName, 'penalties.oxygen_loss', parseInt(e.target.value) || 0, isButton);
                                  }}
                                  onBlur={(e) => handleActionBlur(actionName, 'penalties.oxygen_loss', parseInt(e.target.value) || 0)}
                                  className="w-full p-1 border rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Health Loss</label>
                                <input
                                  type="number"
                                  value={action.penalties?.health_loss || 0}
                                  onChange={(e) => {
                                    const isButton = e.nativeEvent.inputType === 'insertReplacementText';
                                    handleNumberChange(actionName, 'penalties.health_loss', parseInt(e.target.value) || 0, isButton);
                                  }}
                                  onBlur={(e) => handleActionBlur(actionName, 'penalties.health_loss', parseInt(e.target.value) || 0)}
                                  className="w-full p-1 border rounded text-sm"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Rewards Section */}
                          <div className="col-span-2 border-t mt-2 pt-2">
                            <h4 className="text-xs font-medium mb-2">Action Rewards</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium mb-1">Reward Items</label>
                                <select
                                  multiple
                                  value={action.rewards?.items || []}
                                  onChange={(e) => {
                                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                                    handleLocalActionChange(actionName, 'rewards.items', selectedOptions);
                                    handleActionBlur(actionName, 'rewards.items', selectedOptions);
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
                                <label className="block text-xs font-medium mb-1">XP Gain</label>
                                <input
                                  type="number"
                                  value={action.rewards?.xp_gain || 0}
                                  onChange={(e) => {
                                    const isButton = e.nativeEvent.inputType === 'insertReplacementText';
                                    handleNumberChange(actionName, 'rewards.xp_gain', parseInt(e.target.value) || 0, isButton);
                                  }}
                                  onBlur={(e) => handleActionBlur(actionName, 'rewards.xp_gain', parseInt(e.target.value) || 0)}
                                  className="w-full p-1 border rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Oxygen Gain</label>
                                <input
                                  type="number"
                                  value={action.rewards?.oxygen_gain || 0}
                                  onChange={(e) => {
                                    const isButton = e.nativeEvent.inputType === 'insertReplacementText';
                                    handleNumberChange(actionName, 'rewards.oxygen_gain', parseInt(e.target.value) || 0, isButton);
                                  }}
                                  onBlur={(e) => handleActionBlur(actionName, 'rewards.oxygen_gain', parseInt(e.target.value) || 0)}
                                  className="w-full p-1 border rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Health Gain</label>
                                <input
                                  type="number"
                                  value={action.rewards?.health_gain || 0}
                                  onChange={(e) => {
                                    const isButton = e.nativeEvent.inputType === 'insertReplacementText';
                                    handleNumberChange(actionName, 'rewards.health_gain', parseInt(e.target.value) || 0, isButton);
                                  }}
                                  onBlur={(e) => handleActionBlur(actionName, 'rewards.health_gain', parseInt(e.target.value) || 0)}
                                  className="w-full p-1 border rounded text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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

SceneNode.displayName = 'SceneNode';

SceneNode.propTypes = {
  data: PropTypes.shape({
    onSave: PropTypes.func.isRequired,
    allScenes: PropTypes.arrayOf(PropTypes.string).isRequired,
    isCollapsed: PropTypes.func.isRequired,
    onCollapse: PropTypes.func.isRequired,
    onRenameScene: PropTypes.func.isRequired,
    onDeleteScene: PropTypes.func.isRequired,
    onSceneConnectionChange: PropTypes.func.isRequired,
    narrativeState: PropTypes.object.isRequired,
    isSceneReferenced: PropTypes.func.isRequired,
    originalId: PropTypes.string.isRequired,
  }).isRequired,
  id: PropTypes.string.isRequired,
};

export default SceneNode; 