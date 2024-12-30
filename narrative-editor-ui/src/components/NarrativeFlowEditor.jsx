import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeResizer,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RestoreIcon from '@mui/icons-material/Restore';
import PropTypes from 'prop-types';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 280;
const nodeHeight = 250;

// Add DICE_CHECK_OPTIONS constant
const DICE_CHECK_OPTIONS = [
  { value: null, label: 'None' },
  { value: 'STR', label: 'STR' },
  { value: 'SOC', label: 'SOC' },
  { value: 'TECH', label: 'TECH' },
];

const minimapStyle = {
  height: 120,
  backgroundColor: '#f8f9fa',
  maskColor: 'rgb(0, 0, 0, 0.2)',
  border: '1px solid #ddd',
};

// Add this function to generate node colors for the minimap
const getMinimapNodeColor = () => {
  // You can customize colors based on node type or other properties
  return '#2563eb';
};

const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  dagreGraph.setGraph({ 
    rankdir: direction, 
    ranksep: 600,  // Horizontal space between nodes
    nodesep: 1000   // Vertical space between nodes
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const extractUniqueItems = (narrative) => {
  const items = new Set();
  
  narrative.chapters.forEach(chapter => {
    Object.values(chapter.scenes).forEach(scene => {
      Object.values(scene.actions).forEach(action => {
        // Add items from rewards
        if (action.rewards?.items) {
          action.rewards.items.forEach(item => items.add(item));
        }
        // Add items from dice bypass
        if (action.dice_bypass_items) {
          action.dice_bypass_items.forEach(item => items.add(item));
        }
      });
    });
  });

  return Array.from(items)
    .sort((a, b) => a.localeCompare(b)) // Sort alphabetically
    .map(item => ({ value: item, label: item }));
};

const SceneNode = React.memo(({ 
  data, 
  id, 
  onSave, 
  allScenes, 
  isCollapsed, 
  onCollapse,
  onRenameScene,
  onDeleteScene,
  canDelete,
  narrativeState,
  isSceneReferenced
}) => {
  const [editedScene, setEditedScene] = useState(data);
  const [localScene, setLocalScene] = useState(data);
  const [newActionName, setNewActionName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [sceneName, setSceneName] = useState(id);

  // Update both states when props change
  React.useEffect(() => {
    setEditedScene(data);
    setLocalScene(data);
  }, [data]);

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
      onSave(id, updated);
    }
  };

  // Handle local action changes
  const handleLocalActionChange = (actionName, field, value) => {
    let updatedValue = value;
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      updatedValue = {
        ...localScene.actions[actionName][parent],
        [child]: value
      };
      field = parent;
    }

    setLocalScene(prev => ({
      ...prev,
      actions: {
        ...prev.actions,
        [actionName]: {
          ...prev.actions[actionName],
          [field]: updatedValue
        }
      }
    }));
  };

  // Save action changes on blur
  const handleActionBlur = (actionName, field, value) => {
    const currentValue = field.includes('.')
      ? editedScene.actions[actionName][field.split('.')[0]][field.split('.')[1]]
      : editedScene.actions[actionName][field];

    if (value !== currentValue) {
      const updated = {
        ...editedScene,
        actions: {
          ...editedScene.actions,
          [actionName]: {
            ...editedScene.actions[actionName],
            [field]: value
          }
        }
      };
      setEditedScene(updated);
      onSave(id, updated);
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
  const itemOptions = useMemo(() => 
    extractUniqueItems(narrativeState),
    [narrativeState]
  );

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

  return (
    <>
      <NodeResizer 
        minWidth={400}
        minHeight={isCollapsed ? 100 : 400}
        isVisible={true}
        lineClassName="border-blue-400"
        handleClassName="h-3 w-3 bg-white border-2 border-blue-400"
      />
      <div className="bg-white rounded-lg shadow-lg border-2 border-gray-300 h-full w-full flex flex-col">
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
            {!isSceneReferenced(id) && (
              <button
                onClick={() => onDeleteScene(id)}
                className="p-1 rounded text-red-500 hover:text-red-700"
                title="Delete scene"
              >
                <DeleteIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => onCollapse(!isCollapsed)}
            className="p-1 hover:bg-gray-200 rounded ml-2"
          >
            {isCollapsed ? (
              <ExpandMoreIcon className="w-5 h-5" />
            ) : (
              <ExpandLessIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Collapsible content */}
        {isCollapsed ? (
          <div className="p-2 text-sm">
            <div className="text-gray-600">{editedScene.description}</div>
            <div className="mt-1 text-gray-500">
              Actions: {Object.keys(editedScene.actions).join(', ')}
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto h-full">
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
                        <div>
                          <label className="block text-xs font-medium mb-1">Dice Bypass Items</label>
                          <select
                            multiple
                            value={action.dice_bypass_items || []}
                            onChange={(e) => {
                              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                              handleLocalActionChange(actionName, 'dice_bypass_items', selectedOptions);
                            }}
                            onBlur={(e) => handleActionBlur(actionName, 'dice_bypass_items', Array.from(e.target.selectedOptions, option => option.value))}
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
                            value={action.rewards.items || []}
                            onChange={(e) => {
                              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                              handleLocalActionChange(actionName, 'rewards.items', selectedOptions);
                            }}
                            onBlur={(e) => handleActionBlur(actionName, 'rewards.items', Array.from(e.target.selectedOptions, option => option.value))}
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
                            value={action.oxygen_change}
                            onChange={(e) => handleLocalActionChange(actionName, 'oxygen_change', parseInt(e.target.value))}
                            onBlur={(e) => handleActionBlur(actionName, 'oxygen_change', parseInt(e.target.value))}
                            className="w-full p-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Health Change</label>
                          <input
                            type="number"
                            value={action.health_change}
                            onChange={(e) => handleLocalActionChange(actionName, 'health_change', parseInt(e.target.value))}
                            onBlur={(e) => handleActionBlur(actionName, 'health_change', parseInt(e.target.value))}
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
                                value={action.penalties.oxygen_loss}
                                onChange={(e) => handleLocalActionChange(actionName, 'penalties.oxygen_loss', parseInt(e.target.value))}
                                onBlur={(e) => handleActionBlur(actionName, 'penalties.oxygen_loss', parseInt(e.target.value))}
                                className="w-full p-1 border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">Health Loss</label>
                              <input
                                type="number"
                                value={action.penalties.health_loss}
                                onChange={(e) => handleLocalActionChange(actionName, 'penalties.health_loss', parseInt(e.target.value))}
                                onBlur={(e) => handleActionBlur(actionName, 'penalties.health_loss', parseInt(e.target.value))}
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

// Add display names for memo components
SceneNode.displayName = 'SceneNode';

// Add this new component to manage history
const useHistoryStack = (initialState, maxHistory = 100) => {
  // Load initial history and current position from localStorage
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
  
  // Save to localStorage whenever history or current changes
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

  // Add clear history function
  const clearHistory = useCallback(() => {
    setHistory([initialState]);
    setCurrent(0);
    localStorage.removeItem('narrativeEditorHistory');
    localStorage.removeItem('narrativeEditorCurrent');
  }, [initialState]);

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

const Notification = ({ message, onHide }) => {
  useEffect(() => {
    const timer = setTimeout(onHide, 2000); // Hide after 2 seconds
    return () => clearTimeout(timer);
  }, [onHide]);

  return (
    <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg animate-fade-in-out">
      {message}
    </div>
  );
};

// Add display names for memo components
Notification.displayName = 'Notification';

// Update the getViewportCenter function
const getViewportCenter = (reactFlowInstance) => {
  const { x, y, zoom } = reactFlowInstance.getViewport();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate the center in flow coordinates
  return {
    x: (-x + viewportWidth / 2) / zoom - nodeWidth / 2,
    y: (-y + viewportHeight / 2) / zoom - nodeHeight / 2
  };
};

// Move CustomNode completely outside and make it a pure component
const CustomNode = React.memo(function CustomNode(props) {
  const {
    data,
    id,
  } = props;

  // Extract all the needed props from data
  const {
    onSave,
    allScenes,
    isCollapsed,
    onCollapse,
    onRenameScene,
    onDeleteScene,
    canDelete,
    narrativeState,
    originalId,
    isSceneReferenced
  } = data;

  const nodeId = originalId || id;
  const nodeIsCollapsed = typeof isCollapsed === 'function' 
    ? isCollapsed(nodeId)
    : isCollapsed;

  // Create a wrapped onCollapse function that includes the node ID
  const handleCollapse = (collapsed) => {
    onCollapse(nodeId, collapsed);
  };

  return (
    <SceneNode
      data={data}
      id={nodeId}
      onSave={onSave}
      allScenes={allScenes}
      isCollapsed={nodeIsCollapsed}
      onCollapse={handleCollapse}
      onRenameScene={onRenameScene}
      onDeleteScene={onDeleteScene}
      canDelete={canDelete}
      narrativeState={narrativeState}
      isSceneReferenced={isSceneReferenced}
    />
  );
});

// Add display names for memo components
CustomNode.displayName = 'CustomNode';

// Define nodeTypes as a constant outside
const nodeTypes = {
  custom: CustomNode
};

const NarrativeFlowEditor = ({ narrative, onSaveScene }) => {
  const {
    state: narrativeState,
    pushState: pushNarrativeState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory
  } = useHistoryStack(narrative);

  // Add collapsed states management
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());

  const handleNodeCollapse = useCallback((nodeId, isCollapsed) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (isCollapsed) {
        newSet.add(nodeId);
      } else {
        newSet.delete(nodeId);
      }
      return newSet;
    });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useRef(null);
  const startNodeRef = useRef(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if ((event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
          event.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Add this near the top of the component with other state declarations
  const [focusedNodeId, setFocusedNodeId] = useState(null);

  // Modify the handleSaveScene function to track the focused node
  const handleSaveScene = useCallback((sceneId, updatedScene) => {
    const newNarrative = {
      ...narrativeState,
      chapters: narrativeState.chapters.map(chapter => ({
        ...chapter,
        scenes: {
          ...chapter.scenes,
          [sceneId]: updatedScene
        }
      }))
    };
    
    pushNarrativeState(newNarrative);
    onSaveScene(sceneId, updatedScene);
  }, [narrativeState, pushNarrativeState, onSaveScene]);

  // Add this effect to handle focusing on the edited node
  useEffect(() => {
    if (focusedNodeId && reactFlowInstance.current) {
      const node = nodes.find(n => n.id === focusedNodeId);
      if (node) {
        // Only update positions if node is outside viewport
        const { x, y, zoom } = reactFlowInstance.current.getViewport();
        const viewportWidth = window.innerWidth / zoom;
        const viewportHeight = window.innerHeight / zoom;
        
        const isNodeVisible = 
          node.position.x >= -x && 
          node.position.x <= -x + viewportWidth &&
          node.position.y >= -y && 
          node.position.y <= -y + viewportHeight;

        if (!isNodeVisible) {
          reactFlowInstance.current.setCenter(
            node.position.x + nodeWidth / 2,
            node.position.y + nodeHeight / 2,
            { duration: 800, zoom: zoom }
          );
        }
      }
      setFocusedNodeId(null);
    }
  }, [nodes, focusedNodeId]);

  // Update the effect that handles data updates to preserve node positions when possible
  useEffect(() => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;
    
    // Try to preserve existing node positions
    const existingNodePositions = nodes.reduce((acc, node) => {
      acc[node.id] = node.position;
      return acc;
    }, {});

    const { nodes: updatedNodes, edges: updatedEdges } = createNodesAndEdges(
      scenes,
      existingNodePositions // Pass existing positions to createNodesAndEdges
    );
    
    setNodes(updatedNodes);
    setEdges(updatedEdges);
  }, [narrativeState]);

  // Modify createNodesAndEdges to accept and use existing positions
  const createNodesAndEdges = (scenes, existingPositions = {}) => {
    const incomingConnections = new Map();
    Object.entries(scenes).forEach(([_, scene]) => {
      Object.entries(scene.actions).forEach(([_, action]) => {
        if (action.next_scene) {
          incomingConnections.set(action.next_scene, (incomingConnections.get(action.next_scene) || 0) + 1);
        }
      });
    });

    const initialNodes = Object.entries(scenes).map(([sceneId, scene]) => ({
      id: sceneId,
      type: 'custom',
      data: {
        ...scene,
        originalId: sceneId
      },
      // Use scene's stored position, then existing position, then default
      position: scene.position || existingPositions[sceneId] || { x: 0, y: 0 },
    }));

    const initialEdges = [];
    Object.entries(scenes).forEach(([sourceId, scene]) => {
      Object.entries(scene.actions).forEach(([actionName, action]) => {
        const targetSceneId = action.next_scene;
        if (scenes[targetSceneId]) {
          initialEdges.push({
            id: `${sourceId}-${targetSceneId}-${actionName}`,
            source: sourceId,
            target: targetSceneId,
            sourceHandle: 'right',
            targetHandle: 'left',
            animated: true,
            label: actionName,
            type: 'smoothstep',
            style: { stroke: '#2563eb', strokeWidth: 2 },
            labelStyle: { fill: '#444', fontSize: 12 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#2563eb',
            },
          });
        }
      });
    });

    // Only apply layout if we don't have existing positions
    const shouldApplyLayout = Object.keys(existingPositions).length === 0;
    const layouted = shouldApplyLayout ? 
      getLayoutedElements(initialNodes, initialEdges) : 
      { nodes: initialNodes, edges: initialEdges };

    const startNode = layouted.nodes.find(node => !incomingConnections.has(node.id));

    return {
      nodes: layouted.nodes,
      edges: layouted.edges,
      startNode
    };
  };

  const [notification, setNotification] = useState(null);

  // Modify the undo/redo handlers to show notifications
  const handleUndo = () => {
    undo();
    setNotification('Changes undone');
  };

  const handleRedo = () => {
    redo();
    setNotification('Changes redone');
  };

  // Update keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
        } else if ((event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
          event.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Add scene rename handler
  const handleRenameScene = useCallback((oldId, newId) => {
    if (oldId === newId) return;
    
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;

    // Check if new name already exists
    if (scenes[newId]) {
      alert(`Scene "${newId}" already exists`);
      return;
    }

    // Create new narrative state with renamed scene
    const newNarrative = {
      ...narrativeState,
      chapters: narrativeState.chapters.map(chapter => {
        const newScenes = { ...chapter.scenes };
        // Rename the scene
        newScenes[newId] = newScenes[oldId];
        delete newScenes[oldId];

        // Update next_scene references in all scenes
        Object.values(newScenes).forEach(scene => {
          Object.values(scene.actions).forEach(action => {
            if (action.next_scene === oldId) {
              action.next_scene = newId;
            }
          });
        });

        return {
          ...chapter,
          scenes: newScenes
        };
      })
    };

    pushNarrativeState(newNarrative);
    onSaveScene(newId, newNarrative.chapters[0].scenes[newId]);
  }, [narrativeState, pushNarrativeState, onSaveScene]);

  // Update the handleAddScene function
  const handleAddScene = useCallback(() => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;
    
    // Generate a unique scene name
    let newSceneId = 'New Scene';
    let counter = 1;
    while (scenes[newSceneId]) {
      newSceneId = `New Scene ${counter}`;
      counter++;
    }

    // Get the center position of the current viewport
    let position = { x: 0, y: 0 };
    if (reactFlowInstance.current) {
      position = getViewportCenter(reactFlowInstance.current);
    }

    // Create new scene with default values
    const newScene = {
      name: newSceneId,
      description: '',
      location: '',
      actions: {},
      position // Store position with the scene
    };

    // Add new scene to narrative
    const newNarrative = {
      ...narrativeState,
      chapters: narrativeState.chapters.map(chapter => ({
        ...chapter,
        scenes: {
          ...chapter.scenes,
          [newSceneId]: newScene
        }
      }))
    };

    pushNarrativeState(newNarrative);
    onSaveScene(newSceneId, newScene);
    setFocusedNodeId(newSceneId); // Optional: focus on the new scene
  }, [narrativeState, pushNarrativeState, onSaveScene]);

  // Update the isSceneReferenced function
  const isSceneReferenced = useCallback((sceneId) => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;

    // Check if this scene is referenced by any other scene's action
    const hasIncomingReferences = Object.values(scenes).some(scene => 
      Object.values(scene.actions).some(action => 
        action.next_scene === sceneId
      )
    );

    // Check if this scene has any outgoing references
    const hasOutgoingReferences = Object.values(scenes[sceneId]?.actions || {}).some(action => 
      action.next_scene !== null && action.next_scene !== ''
    );

    // Return true if the scene has any references (meaning it cannot be deleted)
    return hasIncomingReferences || hasOutgoingReferences;
  }, [narrativeState]);

  // Update the debug function to show both incoming and outgoing references
  const debugSceneReferences = (sceneId) => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;
    
    const references = [];
    
    // Check incoming references
    Object.entries(scenes).forEach(([sourceId, scene]) => {
      Object.entries(scene.actions).forEach(([actionName, action]) => {
        if (action.next_scene === sceneId) {
          references.push(`Scene "${sourceId}" action "${actionName}" references this scene`);
        }
      });
    });
    
    // Check outgoing references
    Object.entries(scenes[sceneId]?.actions || {}).forEach(([actionName, action]) => {
      if (action.next_scene) {
        references.push(`This scene's action "${actionName}" references scene "${action.next_scene}"`);
      }
    });
    
    if (references.length > 0) {
      console.log(`Scene "${sceneId}" references:`, references);
    }
    return references.length > 0;
  };

  // Update the delete handler to show more specific error messages
  const handleDeleteScene = useCallback((sceneId) => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;

    const hasIncomingReferences = Object.values(scenes).some(scene => 
      Object.values(scene.actions).some(action => 
        action.next_scene === sceneId
      )
    );

    const hasOutgoingReferences = Object.values(scenes[sceneId]?.actions || {}).some(action => 
      action.next_scene !== null && action.next_scene !== ''
    );

    if (hasIncomingReferences || hasOutgoingReferences) {
      debugSceneReferences(sceneId);
      let errorMessage = 'Cannot delete scene because:\n';
      if (hasIncomingReferences) {
        errorMessage += '- It is referenced by other scenes\n';
      }
      if (hasOutgoingReferences) {
        errorMessage += '- It has actions that reference other scenes\n';
      }
      errorMessage += '\nRemove all references first.';
      alert(errorMessage);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete scene "${sceneId}"?`)) {
      return;
    }

    const newNarrative = {
      ...narrativeState,
      chapters: narrativeState.chapters.map(chapter => ({
        ...chapter,
        scenes: Object.fromEntries(
          Object.entries(chapter.scenes).filter(([id]) => id !== sceneId)
        )
      }))
    };

    pushNarrativeState(newNarrative);
    setNotification(`Scene "${sceneId}" deleted`);
  }, [narrativeState, pushNarrativeState]);

  // Wrap node props in useMemo
  const nodeProps = useMemo(() => ({
    onSave: handleSaveScene,
    allScenes: Object.keys(narrativeState.chapters[0].scenes),
    isCollapsed: (id) => collapsedNodes.has(id),
    onCollapse: handleNodeCollapse,
    onRenameScene: handleRenameScene,
    onDeleteScene: handleDeleteScene,
    canDelete: (id) => !isSceneReferenced(id),
    narrativeState,
    isSceneReferenced
  }), [
    handleSaveScene,
    narrativeState,
    collapsedNodes,
    handleNodeCollapse,
    handleRenameScene,
    handleDeleteScene,
    isSceneReferenced
  ]);

  // Update nodes with the current props
  useEffect(() => {
    setNodes(nodes => nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        ...nodeProps,
        originalId: node.id
      }
    })));
  }, [nodeProps, setNodes]);

  // Separate layout effect for initial positioning
  useEffect(() => {
    const chapter = narrative.chapters[0];
    const scenes = chapter.scenes;

    // Initialize collapsed states
    setCollapsedNodes(new Set(Object.keys(scenes)));

    // Create initial layout and position to leftmost node
    const { nodes: initialNodes, startNode } = createNodesAndEdges(scenes);
    if (startNode && reactFlowInstance.current) {
//      reactFlowInstance.current.setViewport({
//        x: 50,
//        y: -startNode.position.y + window.innerHeight,
//        zoom: 0.75
//      });
    }
  }, []); // Only run once on mount

  const onInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
    
    // If we have a start node, position it on the left
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;
    const { startNode } = createNodesAndEdges(scenes);
    
    if (startNode && reactFlowInstance.current) {
      reactFlowInstance.current.setViewport({
        x: 50,  // Add some left padding
        y: -startNode.position.y + window.innerHeight / 2,  // Center vertically
        zoom: 0.75  // Set a reasonable zoom level
      });
    }
  }, [narrativeState]);

  // Update the clearHistory handler
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the history? This action cannot be undone.')) {
      clearHistory();
      setNotification('History cleared');
    }
  };

  // Store initial narrative state
  const initialNarrative = useRef(narrative);

  // Add revert handler
  const handleRevertAll = () => {
    if (window.confirm('Are you sure you want to revert all changes? This will restore the narrative to its initial state and cannot be undone.')) {
      pushNarrativeState(initialNarrative.current);
      setNotification('All changes reverted');
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div className="absolute top-20 left-4 z-10 flex gap-0.5">
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className={`p-1 rounded text-white ${
            canUndo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon className="w-3 h-3" />
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className={`p-1 rounded text-white ${
            canRedo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          }`}
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        >
          <RedoIcon className="w-3 h-3" />
        </button>
        <button
          onClick={handleClearHistory}
          className="p-1 rounded text-white bg-red-500 hover:bg-red-600"
          title="Clear History"
        >
          <RestartAltIcon className="w-3 h-3" />
        </button>
        <button
          onClick={handleRevertAll}
          className="p-1 rounded text-white bg-orange-500 hover:bg-orange-600"
          title="Revert All Changes"
        >
          <RestoreIcon className="w-3 h-3" />
        </button>
        <button
          onClick={handleAddScene}
          className="p-1 rounded text-white bg-green-500 hover:bg-green-600"
          title="Add New Scene"
        >
          <AddIcon className="w-3 h-3" />
        </button>
      </div>

      {/* Add notification */}
      {notification && (
        <Notification 
          message={notification} 
          onHide={() => setNotification(null)} 
        />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap 
          style={minimapStyle}
          nodeColor={getMinimapNodeColor}
          nodeStrokeWidth={3}
          nodeStrokeColor="#fff"
          nodeBorderRadius={2}
          maskColor="rgb(0, 0, 0, 0.2)"
          position="bottom-right"
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};

// Add display names for memo components
NarrativeFlowEditor.displayName = 'NarrativeFlowEditor';

CustomNode.propTypes = {
  data: PropTypes.shape({
    originalId: PropTypes.string,
    onSave: PropTypes.func,
    allScenes: PropTypes.arrayOf(PropTypes.string),
    isCollapsed: PropTypes.bool,
    onCollapse: PropTypes.func,
    onRenameScene: PropTypes.func,
    onDeleteScene: PropTypes.func,
    canDelete: PropTypes.func,
    narrativeState: PropTypes.object,
    isSceneReferenced: PropTypes.func
  }).isRequired,
  id: PropTypes.string.isRequired
};

export default NarrativeFlowEditor; 