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
import Select from 'react-select';
import Creatable from 'react-select/creatable';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import itemsData from '../../items.json'; // Adjust the path as necessary

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

const SceneNode = React.memo(({ 
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
  const itemOptions = Object.keys(itemsData.items).map(itemName => ({ value: itemName, label: itemName }));

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
            onClick={() => onCollapse(!isCollapsed)}
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

  // Modified save handler to update history
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

  // Add ref to store ReactFlow instance
  const onInit = (instance) => {
    reactFlowInstance.current = instance;
    // If we already have a start node, position it on the left
    if (startNodeRef.current && reactFlowInstance.current) {
      const { y } = startNodeRef.current;
      // Set viewport to position the start node on the left with some padding
      reactFlowInstance.current.setViewport({
        x: 50,  // Add some left padding
        y: -y + window.innerHeight,  // Center vertically
        zoom: 0.75  // Set a reasonable zoom level
      });
    }
  };

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

  // Add new scene handler
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

    // Create new scene with default values
    const newScene = {
      name: newSceneId,
      description: '',
      location: '',
      actions: {}
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
  }, [narrativeState, pushNarrativeState, onSaveScene]);

  // Add function to check if a scene is referenced
  const isSceneReferenced = useCallback((sceneId) => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;
    
    // Check if this scene is referenced by any other scene's action
    const isReferencedByOthers = Object.values(scenes).some(scene => 
      Object.values(scene.actions).some(action => 
        action.next_scene === sceneId
      )
    );

    // Check if this scene has any outgoing connections
    const hasOutgoingConnections = Object.values(scenes[sceneId]?.actions || {}).some(action => 
      action.next_scene !== null && action.next_scene !== ''
    );

    return isReferencedByOthers || hasOutgoingConnections;
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

  // Update nodeTypes to include delete functionality
  const nodeTypes = useMemo(() => ({
    custom: (props) => (
      <SceneNode 
        {...props} 
        onSave={(id, scene) => handleSaveScene(props.data.originalId, scene)} 
        allScenes={Object.keys(narrativeState.chapters[0].scenes)}
        isCollapsed={collapsedNodes.has(props.id)}
        onCollapse={(isCollapsed) => handleNodeCollapse(props.id, isCollapsed)}
        onRenameScene={handleRenameScene}
        onDeleteScene={handleDeleteScene}
        canDelete={!isSceneReferenced(props.id)}
      />
    ),
  }), [handleSaveScene, narrativeState, collapsedNodes, handleNodeCollapse, handleRenameScene, handleDeleteScene, isSceneReferenced]);

  // Separate layout effect for initial positioning
  useEffect(() => {
    const chapter = narrative.chapters[0];
    const scenes = chapter.scenes;

    // Initialize collapsed states
    setCollapsedNodes(new Set(Object.keys(scenes)));

    // Create initial layout and position to leftmost node
    const { nodes: initialNodes, startNode } = createNodesAndEdges(scenes);
    if (startNode && reactFlowInstance.current) {
      reactFlowInstance.current.setViewport({
        x: 50,
        y: -startNode.position.y + window.innerHeight,
        zoom: 0.75
      });
    }
  }, []); // Only run once on mount

  // Effect for handling data updates without repositioning
  useEffect(() => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;
    const { nodes: updatedNodes, edges: updatedEdges } = createNodesAndEdges(scenes);
    
    setNodes(updatedNodes);
    setEdges(updatedEdges);
  }, [narrativeState]);

  // Helper function to create nodes and edges
  const createNodesAndEdges = (scenes) => {
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
      position: { x: 0, y: 0 },
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

    const layouted = getLayoutedElements(initialNodes, initialEdges);
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

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className={`px-3 py-1 rounded text-white ${
            canUndo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          }`}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className={`px-3 py-1 rounded text-white ${
            canRedo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          }`}
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button
          onClick={clearHistory}
          className="px-3 py-1 rounded text-white bg-red-500 hover:bg-red-600"
          title="Clear History"
        >
          Clear History
        </button>
        <button
          onClick={handleAddScene}
          className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600"
          title="Add New Scene"
        >
          New Scene
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
          nodeColor="#2563eb"
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
};

export default NarrativeFlowEditor; 