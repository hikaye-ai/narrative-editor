import React from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  NodeResizer,
  BezierEdge,
  SmoothStepEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// Constants
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

const getMinimapNodeColor = () => '#2563eb';

const extractUniqueItems = (narrative) => {
  const items = new Set();
  
  narrative.chapters.forEach(chapter => {
    Object.values(chapter.scenes).forEach(scene => {
      Object.values(scene.actions).forEach(action => {
        if (action.rewards?.items) {
          action.rewards.items.forEach(item => items.add(item));
        }
        if (action.dice_bypass_items) {
          action.dice_bypass_items.forEach(item => items.add(item));
        }
      });
    });
  });

  return Array.from(items)
    .sort((a, b) => a.localeCompare(b))
    .map(item => ({ value: item, label: item }));
};

const Notification = observer(({ store }) => {
  if (!store.notification) return null;

  return (
    <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg animate-fade-in-out">
      {store.notification}
    </div>
  );
});

const SceneNode = observer(function SceneNode({ data, id }) {
  // Convert the observable data to plain JS, excluding storeActions
  const { storeActions, ...sceneData } = data;
  console.log('SceneNode data:', { storeActions, sceneData, id });

  const plainData = toJS(sceneData);
  const [editedScene, setEditedScene] = React.useState(plainData);
  const [localScene, setLocalScene] = React.useState(plainData);
  const [newActionName, setNewActionName] = React.useState('');
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [sceneName, setSceneName] = React.useState(id);

  // Check if store actions are properly initialized
  if (!storeActions) {
    console.error('Store actions are not properly initialized in SceneNode');
    return null;
  }

  // Add debugging for store actions
  console.log('Store actions methods:', Object.keys(storeActions));

  // Replace useMemo with computed values from store
  const sceneOptions = storeActions.sceneOptions || [];
  const itemOptions = storeActions.itemOptions || [];

  // Get the initial collapsed state from the store
  const isCollapsed = storeActions.isNodeCollapsed(id);

  const handleLocalChange = (field, value) => {
    setLocalScene(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBlur = (field, value) => {
    if (value !== editedScene[field]) {
      const updated = {
        ...editedScene,
        [field]: value
      };
      setEditedScene(updated);
      storeActions.saveScene(id, updated);
    }
  };

  const handleLocalActionChange = (actionName, field, value) => {
    let updatedValue = value;
    let updatedAction = { ...localScene.actions[actionName] };
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      updatedAction[parent] = {
        ...updatedAction[parent],
        [child]: value
      };
    } else {
      updatedAction[field] = value;
    }

    setLocalScene(prev => ({
      ...prev,
      actions: {
        ...prev.actions,
        [actionName]: updatedAction
      }
    }));
  };

  const handleActionBlur = (actionName, field, value) => {
    let currentValue;
    let updatedAction = { ...editedScene.actions[actionName] };

    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      currentValue = editedScene.actions[actionName]?.[parent]?.[child];
      
      // Ensure parent object exists
      updatedAction[parent] = {
        ...updatedAction[parent],
        [child]: value
      };
    } else {
      currentValue = editedScene.actions[actionName]?.[field];
      updatedAction[field] = value;
    }

    if (value !== currentValue) {
      const updated = {
        ...editedScene,
        actions: {
          ...editedScene.actions,
          [actionName]: updatedAction
        }
      };
      setEditedScene(updated);
      storeActions.saveScene(id, updated);
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
          dice_bypass_items: [],
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
    storeActions.saveScene(id, updated);
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
    storeActions.saveScene(id, updated);
  };

  const handleSceneNameSubmit = () => {
    if (sceneName && sceneName !== id) {
      storeActions.renameScene(id, sceneName);
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

  const renderAction = (actionName, action) => {
    const isActionCollapsed = storeActions.isActionCollapsed(id, actionName);

    return (
      <div key={actionName} className="border rounded p-2 text-sm">
        {/* Action header */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => storeActions.toggleActionCollapse(id, actionName)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isActionCollapsed ? (
                <ExpandMoreIcon className="w-4 h-4" />
              ) : (
                <ExpandLessIcon className="w-4 h-4" />
              )}
            </button>
            <span className="font-medium">{actionName}</span>
          </div>
          <button
            onClick={() => deleteAction(actionName)}
            className="text-red-500 hover:text-red-700 text-xs"
          >
            Delete
          </button>
        </div>

        {/* Collapsed view */}
        {isActionCollapsed ? (
          <div className="text-gray-600 text-sm pl-6">
            Next Scene: {action.next_scene || 'None'}
            {action.dice_check && ` | Check: ${action.dice_check}`}
            {action.oxygen_change !== 0 && ` | O₂: ${action.oxygen_change}`}
            {action.health_change !== 0 && ` | HP: ${action.health_change}`}
          </div>
        ) : (
          /* Existing action fields */
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
                {sceneOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
                value={action.rewards?.items || []}
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

            {/* Penalties Section */}
            <div className="col-span-2 border-t mt-2 pt-2">
              <h4 className="text-xs font-medium mb-2">Dice Check Failure Penalties</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Oxygen Loss</label>
                  <input
                    type="number"
                    value={action.penalties?.oxygen_loss || 0}
                    onChange={(e) => handleLocalActionChange(actionName, 'penalties.oxygen_loss', parseInt(e.target.value))}
                    onBlur={(e) => handleActionBlur(actionName, 'penalties.oxygen_loss', parseInt(e.target.value))}
                    className="w-full p-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Health Loss</label>
                  <input
                    type="number"
                    value={action.penalties?.health_loss || 0}
                    onChange={(e) => handleLocalActionChange(actionName, 'penalties.health_loss', parseInt(e.target.value))}
                    onBlur={(e) => handleActionBlur(actionName, 'penalties.health_loss', parseInt(e.target.value))}
                    className="w-full p-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Rewards Section */}
            <div className="col-span-2 border-t mt-2 pt-2">
              <h4 className="text-xs font-medium mb-2">Additional Rewards</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Oxygen Gain</label>
                  <input
                    type="number"
                    value={action.rewards?.oxygen_gain || 0}
                    onChange={(e) => handleLocalActionChange(actionName, 'rewards.oxygen_gain', parseInt(e.target.value))}
                    onBlur={(e) => handleActionBlur(actionName, 'rewards.oxygen_gain', parseInt(e.target.value))}
                    className="w-full p-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Health Gain</label>
                  <input
                    type="number"
                    value={action.rewards?.health_gain || 0}
                    onChange={(e) => handleLocalActionChange(actionName, 'rewards.health_gain', parseInt(e.target.value))}
                    onBlur={(e) => handleActionBlur(actionName, 'rewards.health_gain', parseInt(e.target.value))}
                    className="w-full p-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">XP Gain</label>
                  <input
                    type="number"
                    value={action.rewards?.xp_gain || 0}
                    onChange={(e) => handleLocalActionChange(actionName, 'rewards.xp_gain', parseInt(e.target.value))}
                    onBlur={(e) => handleActionBlur(actionName, 'rewards.xp_gain', parseInt(e.target.value))}
                    className="w-full p-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
            {typeof storeActions.isSceneReferenced === 'function' && !storeActions.isSceneReferenced(id) && (
              <button
                onClick={() => storeActions.deleteScene(id)}
                className="p-1 rounded text-red-500 hover:text-red-700"
                title="Delete scene"
              >
                <DeleteIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => storeActions.toggleNodeCollapse(id)}
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
                  {Object.entries(localScene.actions).map(([actionName, action]) => 
                    renderAction(actionName, action)
                  )}
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

const NarrativeFlowEditor = observer(function NarrativeFlowEditor({ store }) {
  // Convert observable arrays to plain JS objects right before passing to ReactFlow
  const nodes = React.useMemo(() => toJS(store.nodes), [store.nodes]);
  const edges = React.useMemo(() => toJS(store.edges), [store.edges]);

  console.log('NarrativeFlowEditor render:', { nodes, edges });

  React.useEffect(() => {
    console.log('NarrativeFlowEditor mounted');
    return () => console.log('NarrativeFlowEditor unmounted');
  }, []);

  const onInit = React.useCallback((instance) => {
    console.log('ReactFlow onInit called');
    store.setReactFlowInstance(instance);
    setTimeout(() => {
      instance.fitView({ padding: 0.2 });
    }, 0);
  }, [store]);

  // Memoize the node types to prevent unnecessary re-renders
  const nodeTypes = React.useMemo(() => {
    console.log('Creating nodeTypes');
    return {
      custom: SceneNode
    };
  }, []);

  // Memoize the edge types
  const edgeTypes = React.useMemo(() => {
    console.log('Creating edgeTypes');
    return {
      bezier: BezierEdge,
      smoothstep: SmoothStepEdge,
    };
  }, []);

  if (!nodes || !edges) {
    console.log('No nodes or edges available');
    return null;
  }

  // Ensure all node data is also plain JS
  const plainNodes = nodes.map(node => ({
    ...node,
    data: toJS(node.data)
  }));

  return (
    <div className="w-full h-full bg-gray-100" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="absolute top-20 left-4 z-10 flex gap-0.5">
        <button
          onClick={() => store.undo()}
          disabled={!store.canUndo}
          className={`p-1 rounded text-white ${
            store.canUndo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon className="w-3 h-3" />
        </button>
        <button
          onClick={() => store.redo()}
          disabled={!store.canRedo}
          className={`p-1 rounded text-white ${
            store.canRedo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          }`}
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        >
          <RedoIcon className="w-3 h-3" />
        </button>
        <button
          onClick={() => store.clearHistory()}
          className="p-1 rounded text-white bg-red-500 hover:bg-red-600"
          title="Clear History"
        >
          <RestartAltIcon className="w-3 h-3" />
        </button>
        <button
          onClick={() => store.addScene()}
          className="p-1 rounded text-white bg-green-500 hover:bg-green-600"
          title="Add New Scene"
        >
          <AddIcon className="w-3 h-3" />
        </button>
      </div>

      <Notification store={store} />

      <ReactFlow
        nodes={plainNodes}
        edges={edges}
        onNodesChange={(changes) => store.updateNodes(changes)}
        onEdgesChange={(changes) => store.updateEdges(changes)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#2563eb', strokeWidth: 2 },
        }}
        connectionMode="loose"
        snapToGrid={true}
        snapGrid={[15, 15]}
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
});

export default NarrativeFlowEditor; 