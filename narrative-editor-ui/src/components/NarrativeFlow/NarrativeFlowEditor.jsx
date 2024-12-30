import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import PropTypes from 'prop-types';
import { useHistoryStack } from './hooks/useHistoryStack';
import { getLayoutedElements, getViewportCenter, extractUniqueItems } from './utils/flowUtils';
import { MINIMAP_STYLE } from './constants';
import { Notification } from './components/Notification';
import { EditorToolbar } from './components/EditorToolbar';
import SceneNode from './components/SceneNode';
import 'reactflow/dist/style.css';

const nodeTypes = {
  custom: SceneNode
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

  const [collapsedNodes, setCollapsedNodes] = useState(() => {
    const chapter = narrative.chapters[0];
    return new Set(Object.keys(chapter.scenes));
  });
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [notification, setNotification] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  
  const reactFlowInstance = useRef(null);
  const initialNarrative = useRef(narrative);

  // Handle node collapse
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

  // Handle scene save
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
    setFocusedNodeId(sceneId);
  }, [narrativeState, pushNarrativeState, onSaveScene]);

  // Handle scene rename
  const handleRenameScene = useCallback((oldId, newId) => {
    if (oldId === newId) return;
    
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;

    if (scenes[newId]) {
      setNotification('Scene name already exists');
      return;
    }

    const newNarrative = {
      ...narrativeState,
      chapters: narrativeState.chapters.map(chapter => {
        const newScenes = { ...chapter.scenes };
        newScenes[newId] = newScenes[oldId];
        delete newScenes[oldId];

        // Update references
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
    setNotification(`Scene renamed to "${newId}"`);
  }, [narrativeState, pushNarrativeState, onSaveScene]);

  // Handle scene deletion
  const handleDeleteScene = useCallback((sceneId) => {
    if (isSceneReferenced(sceneId)) {
      setNotification('Cannot delete scene with references');
      return;
    }

    if (!window.confirm(`Delete scene "${sceneId}"?`)) return;

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

  // Handle adding new scene
  const handleAddScene = useCallback(() => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;
    
    let newSceneId = 'New Scene';
    let counter = 1;
    while (scenes[newSceneId]) {
      newSceneId = `New Scene ${counter}`;
      counter++;
    }

    const position = getViewportCenter(reactFlowInstance);
    const newScene = {
      description: '',
      location: '',
      actions: {},
      position
    };

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
    setFocusedNodeId(newSceneId);
    setNotification(`Scene "${newSceneId}" created`);
  }, [narrativeState, pushNarrativeState, onSaveScene]);

  // Check if scene is referenced
  const isSceneReferenced = useCallback((sceneId) => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;

    return Object.values(scenes).some(scene => 
      // Check if any action points to this scene (incoming connections)
      Object.values(scene.actions).some(action => 
        action.next_scene === sceneId
      ) ||
      // Check if this scene points to any other scene (outgoing connections)
      (scenes[sceneId]?.actions && Object.values(scenes[sceneId].actions).some(action => 
        action.next_scene && action.next_scene !== ''
      ))
    );
  }, [narrativeState]);

  // Handle undo/redo
  const handleUndo = useCallback(() => {
    undo();
    setNotification('Changes undone');
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
    setNotification('Changes redone');
  }, [redo]);

  // Handle history clear
  const handleClearHistory = useCallback(() => {
    if (window.confirm('Clear history? This cannot be undone.')) {
      clearHistory();
      setNotification('History cleared');
    }
  }, [clearHistory]);

  // Handle revert all
  const handleRevertAll = useCallback(() => {
    if (window.confirm('Revert all changes? This cannot be undone.')) {
      pushNarrativeState(initialNarrative.current);
      setNotification('All changes reverted');
    }
  }, [pushNarrativeState]);

  // Initialize flow
  const onInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
  }, []);

  // Update nodes when narrative changes
  useEffect(() => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;
    
    // Create nodes
    const newNodes = Object.entries(scenes).map(([id, scene]) => ({
      id,
      type: 'custom',
      data: {
        ...scene,
        onSave: handleSaveScene,
        allScenes: Object.keys(scenes),
        isCollapsed: (nodeId) => collapsedNodes.has(nodeId),
        onCollapse: handleNodeCollapse,
        onRenameScene: handleRenameScene,
        onDeleteScene: handleDeleteScene,
        narrativeState,
        isSceneReferenced,
        originalId: id
      },
      position: scene.position || { x: 0, y: 0 }
    }));

    // Create edges from actions
    const newEdges = [];
    Object.entries(scenes).forEach(([sourceId, scene]) => {
      Object.entries(scene.actions || {}).forEach(([actionName, action]) => {
        if (action.next_scene) {
          newEdges.push({
            id: `${sourceId}-${action.next_scene}-${actionName}`,
            source: sourceId,
            target: action.next_scene,
            label: actionName,
            type: 'default',
            animated: true,
            style: { stroke: '#2563eb' },
            labelStyle: { fill: '#444', fontSize: 12 },
            markerEnd: {
              type: 'arrowclosed',
              color: '#2563eb',
            },
          });
        }
      });
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [
    narrativeState,
    collapsedNodes,
    handleSaveScene,
    handleNodeCollapse,
    handleRenameScene,
    handleDeleteScene,
    isSceneReferenced
  ]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <EditorToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        clearHistory={handleClearHistory}
        onRevertAll={handleRevertAll}
        onAddScene={handleAddScene}
      />

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
          type: 'default',
          animated: true,
          style: { stroke: '#2563eb' },
          markerEnd: {
            type: 'arrowclosed',
            color: '#2563eb',
          },
        }}
        fitView
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap 
          style={MINIMAP_STYLE}
          nodeColor={() => '#2563eb'}
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

NarrativeFlowEditor.propTypes = {
  narrative: PropTypes.object.isRequired,
  onSaveScene: PropTypes.func.isRequired,
};

export default NarrativeFlowEditor; 