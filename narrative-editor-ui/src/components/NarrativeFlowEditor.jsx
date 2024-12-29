import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

// Hooks & Components (import from your codebase)
import { useHistoryStack } from '../hooks/useHistoryStack';
import nodeTypes from './nodeTypes';
import { Notification } from './Notification';

import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AddCircleIcon from '@mui/icons-material/AddCircle';

//
// GLOBALS
//
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 280;
const nodeHeight = 250;

const minimapStyle = {
  height: 120,
  backgroundColor: '#f8f9fa',
  border: '1px solid #ddd',
  maskColor: 'rgb(0, 0, 0, 0.2)',
};

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 0.75 };

//
// HELPER: INITIAL DAGRE LAYOUT (ONE-TIME)
//
function getLayoutedElements(nodes, edges, direction = 'LR') {
  dagreGraph.setGraph({
    rankdir: direction,
    // Tweak these to space out your nodes
    ranksep: 300,
    nodesep: 200,
    edgesep: 80,
    marginx: 50,
    marginy: 50,
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
}

//
// HELPER: CENTER OF VIEWPORT
//
function getViewportCenter(reactFlowInstance) {
  const { x, y, zoom } = reactFlowInstance.getViewport();
  const viewportWidth = window.innerWidth / zoom;
  const viewportHeight = window.innerHeight / zoom;

  return {
    x: -x + viewportWidth / 2,
    y: -y + viewportHeight / 2,
  };
}

//
// MAIN COMPONENT
//
const NarrativeFlowEditor = ({ narrative, onSaveScene }) => {
  //
  // REFS & STATES
  //
  const initialNarrative = useRef(narrative);
  const reactFlowInstance = useRef(null);
  const handlersRef = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [notification, setNotification] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const layoutAppliedRef = useRef(false);

  //
  // HISTORY STACK
  //
  const {
    state: narrativeState,
    viewport,
    pushState: pushNarrativeState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useHistoryStack(narrative, 'narrative-history');

  //
  // SCENES DATA
  //
  const scenesData = useMemo(() => {
    if (!narrativeState?.chapters?.[0]?.scenes) return null;
    return narrativeState.chapters[0].scenes;
  }, [narrativeState]);

  //
  // CREATE NODES/EDGES
  //
  const createNodesAndEdges = useCallback(
    (scenes, existingPositions = {}) => {
      console.log('Creating nodes with:', { 
        scenesCount: Object.keys(scenes || {}).length,
        existingPositions,
        handlers: handlersRef.current 
      });

      // Early return if scenes is not valid
      if (!scenes || typeof scenes !== 'object') {
        console.warn('Invalid scenes data:', scenes);
        return { nodes: [], edges: [] };
      }

      try {
        const flowNodes = Object.entries(scenes).map(([sceneId, scene]) => {
          if (!scene) {
            console.warn(`Invalid scene data for ${sceneId}:`, scene);
            return null;
          }

          const position = existingPositions[sceneId] || scene.position || { x: 0, y: 0 };
          const node = {
            id: sceneId,
            type: 'custom',
            data: {
              ...scene,
              originalId: sceneId,
              allScenes: Object.keys(scenes),
              isCollapsed: scene.isCollapsed || false,
              handlers: handlersRef.current,
            },
            position: {
              x: position.x || 0,
              y: position.y || 0,
            },
            width: scene.isCollapsed ? 400 : (position.width || 400),
            height: scene.isCollapsed ? 100 : (position.height || 400),
            sourcePosition: 'right',
            targetPosition: 'left',
          };
          console.log(`Node ${sceneId} created:`, { 
            isCollapsed: node.data.isCollapsed,
            hasHandlers: !!node.data.handlers,
            hasCollapseHandler: !!node.data.handlers?.onCollapse
          });
          return node;
        }).filter(Boolean); // Remove any null nodes

        const flowEdges = [];
        Object.entries(scenes).forEach(([sourceId, scene]) => {
          if (!scene || !scene.actions) return;

          Object.entries(scene.actions).forEach(([actionName, action]) => {
            if (!action) return;
            
            const targetId = action.next_scene;
            if (targetId && scenes[targetId]) {
              flowEdges.push({
                id: `${sourceId}-${targetId}-${actionName}`,
                source: sourceId,
                target: targetId,
                animated: true,
                type: 'smoothstep',
                label: actionName,
                sourceHandle: 'right',
                targetHandle: 'left',
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

        return { nodes: flowNodes, edges: flowEdges };
      } catch (error) {
        console.error('Error creating nodes and edges:', error);
        return { nodes: [], edges: [] };
      }
    },
    [] // No dependencies needed since we use refs
  );

  //
  // SCENE REFERENCE CHECK
  //
  const isSceneReferenced = useCallback(
    (sceneId) => {
      const chapter = narrativeState.chapters[0];
      const scenes = chapter.scenes;

      const hasIncoming = Object.values(scenes).some((scene) =>
        Object.values(scene.actions).some((action) => action.next_scene === sceneId)
      );
      const hasOutgoing = Object.values(scenes[sceneId]?.actions || {}).some(
        (action) => action.next_scene
      );
      return hasIncoming || hasOutgoing;
    },
    [narrativeState]
  );

  // Update handlers ref whenever dependencies change
  useEffect(() => {
    console.log('Updating handlers ref');
    handlersRef.current = {
      onCollapse: (nodeId, isCollapsed) => {
        console.log('Collapse handler called:', { nodeId, isCollapsed });
        
        // Get current positions
        const currentPositions = nodes.reduce((acc, node) => {
          acc[node.id] = {
            x: node.position.x,
            y: node.position.y,
            width: node.width,
            height: node.height,
          };
          return acc;
        }, {});

        // Create updated narrative with collapse state
        const updatedNarrative = {
          ...narrativeState,
          chapters: narrativeState.chapters.map((chapter) => ({
            ...chapter,
            scenes: Object.fromEntries(
              Object.entries(chapter.scenes).map(([id, scene]) => [
                id,
                {
                  ...scene,
                  position: currentPositions[id] ? {
                    x: currentPositions[id].x,
                    y: currentPositions[id].y,
                  } : scene.position,
                  isCollapsed: id === nodeId ? isCollapsed : (scene.isCollapsed || false),
                },
              ])
            ),
          })),
        };

        // Push new state (without collapsedNodes)
        const currentViewport = reactFlowInstance.current?.getViewport() || viewport;
        pushNarrativeState(updatedNarrative, null, currentViewport);

        // Immediately update nodes and edges
        const { nodes: newNodes, edges: newEdges } = createNodesAndEdges(
          scenesData,
          currentPositions
        );

        setNodes(newNodes);
        setEdges(newEdges);
      },
      onSave: (sceneId, updatedScene) => {
        const newNarrative = {
          ...narrativeState,
          chapters: narrativeState.chapters.map((chapter) => ({
            ...chapter,
            scenes: {
              ...chapter.scenes,
              [sceneId]: {
                ...chapter.scenes[sceneId],
                ...updatedScene,
                position: chapter.scenes[sceneId]?.position || updatedScene.position,
              },
            },
          })),
        };

        const currentViewport = reactFlowInstance.current?.getViewport() || viewport;
        pushNarrativeState(newNarrative, null, currentViewport);
        onSaveScene?.(sceneId, updatedScene);

        try {
          localStorage.setItem('narrative-backup', JSON.stringify(newNarrative));
        } catch (error) {
          console.warn('Failed to save narrative to localStorage:', error);
        }
      },
      onRename: (oldId, newId) => {
        if (oldId === newId) return;
        if (narrativeState.chapters[0].scenes[newId]) {
          alert(`Scene "${newId}" already exists`);
          return;
        }

        const newNarrative = {
          ...narrativeState,
          chapters: narrativeState.chapters.map((chapter) => {
            const newScenes = { ...chapter.scenes };
            newScenes[newId] = newScenes[oldId];
            delete newScenes[oldId];

            Object.values(newScenes).forEach((scene) => {
              Object.values(scene.actions).forEach((action) => {
                if (action.next_scene === oldId) {
                  action.next_scene = newId;
                }
              });
            });

            return { ...chapter, scenes: newScenes };
          }),
        };

        pushNarrativeState(newNarrative);
        onSaveScene(newId, newNarrative.chapters[0].scenes[newId]);
      },
      onDelete: (sceneId) => {
        if (isSceneReferenced(sceneId)) {
          alert('Cannot delete scene—it has references.\nRemove references first.');
          return;
        }

        if (!window.confirm(`Are you sure you want to delete scene "${sceneId}"?`)) {
          return;
        }

        const newNarrative = {
          ...narrativeState,
          chapters: narrativeState.chapters.map((chapter) => ({
            ...chapter,
            scenes: Object.fromEntries(
              Object.entries(chapter.scenes).filter(([id]) => id !== sceneId)
            ),
          })),
        };

        pushNarrativeState(newNarrative);
        setNotification(`Scene "${sceneId}" deleted`);
      },
      canDelete: (sceneId) => !isSceneReferenced(sceneId),
    };
  }, [
    nodes,
    viewport,
    narrativeState,
    pushNarrativeState,
    scenesData,
    createNodesAndEdges,
    isSceneReferenced,
    onSaveScene,
  ]);

  //
  // 1. INITIALIZE NODES/EDGES + LAYOUT (ONE-TIME)
  //
  useEffect(() => {
    if (!scenesData || isInitialized || layoutAppliedRef.current) return;

    const { nodes: rawNodes, edges: rawEdges } = createNodesAndEdges(
      scenesData,
      {}
    );

    // Perform Dagre layout once
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      rawNodes,
      rawEdges
    );

    // Set local state
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    // Update narrative with the computed positions
    const initialPositions = layoutedNodes.reduce((acc, node) => {
      acc[node.id] = node.position;
      return acc;
    }, {});

    const updatedNarrative = {
      ...narrative,
      chapters: narrative.chapters.map((chapter) => ({
        ...chapter,
        scenes: Object.fromEntries(
          Object.entries(chapter.scenes).map(([id, scene]) => [
            id,
            { ...scene, position: initialPositions[id] || scene.position },
          ])
        ),
      })),
    };

    pushNarrativeState(updatedNarrative, null, DEFAULT_VIEWPORT);

    layoutAppliedRef.current = true;
    setIsInitialized(true);
  }, [
    scenesData,
    narrative,
    createNodesAndEdges,
    isInitialized,
    pushNarrativeState,
  ]);

  //
  // 2. UPDATE NODES/EDGES IF COLLAPSE STATE OR SCENES CHANGE
  //
  useEffect(() => {
    if (!isInitialized || !scenesData) return;

    // Build a map of current positions
    const currentPositions = nodes.reduce((acc, node) => {
      acc[node.id] = node.position;
      return acc;
    }, {});

    const { nodes: updatedNodes, edges: updatedEdges } = createNodesAndEdges(
      scenesData,
      currentPositions
    );

    // Compare with existing to avoid useless re-renders
    const nodeChange = JSON.stringify(nodes.map((n) => [n.id, n.data.isCollapsed])) !==
      JSON.stringify(updatedNodes.map((n) => [n.id, n.data.isCollapsed]));
    const edgeChange = JSON.stringify(edges) !== JSON.stringify(updatedEdges);

    if (nodeChange || edgeChange) {
      setNodes(updatedNodes);
      setEdges(updatedEdges);
    }
  }, [isInitialized, scenesData, createNodesAndEdges, nodes, edges]);

  //
  // REACT FLOW ON INIT
  //
  const onInit = useCallback(
    (instance) => {
      reactFlowInstance.current = instance;

      // Slight delay to allow ReactFlow to calculate the layout
      setTimeout(() => {
        if (viewport) {
          instance.setViewport(viewport);
        } else {
          instance.setViewport(DEFAULT_VIEWPORT);
        }
        instance.fitView({ padding: 0.2 });
      }, 100);
    },
    [viewport]
  );

  // If viewport changes externally
  useEffect(() => {
    if (reactFlowInstance.current && viewport) {
      reactFlowInstance.current.setViewport(viewport);
    }
  }, [viewport]);

  //
  // RESET
  //
  const handleReset = useCallback(() => {
    if (!window.confirm('Are you sure you want to reset all changes? This cannot be undone.'))
      return;

    const newNarrative = JSON.parse(JSON.stringify(initialNarrative.current));
    const currentViewport = reactFlowInstance.current?.getViewport() || viewport;

    pushNarrativeState(newNarrative, new Set(), currentViewport);
    setNotification('Reset to initial state');
  }, [pushNarrativeState, viewport]);

  //
  // UNDO/REDO SHORTCUTS
  //
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  //
  // FOCUS ON NEWLY ADDED OR RENAMED NODE
  //
  useEffect(() => {
    if (!focusedNodeId || !reactFlowInstance.current) return;

    const node = nodes.find((n) => n.id === focusedNodeId);
    if (node) {
      const { x, y, zoom } = reactFlowInstance.current.getViewport();
      const viewportWidth = window.innerWidth / zoom;
      const viewportHeight = window.innerHeight / zoom;

      const isVisible =
        node.position.x >= -x &&
        node.position.x <= -x + viewportWidth &&
        node.position.y >= -y &&
        node.position.y <= -y + viewportHeight;

      // Smoothly pan/zoom to node if not visible
      if (!isVisible) {
        reactFlowInstance.current.setCenter(
          node.position.x + nodeWidth / 2,
          node.position.y + nodeHeight / 2,
          { duration: 800, zoom }
        );
      }
    }
    setFocusedNodeId(null);
  }, [focusedNodeId, nodes]);

  //
  // ADD SCENE
  //
  const handleAddScene = useCallback(() => {
    const chapter = narrativeState.chapters[0];
    const scenes = chapter.scenes;

    // Generate unique ID
    let newSceneId = 'New Scene';
    let counter = 1;
    while (scenes[newSceneId]) {
      newSceneId = `New Scene ${counter}`;
      counter++;
    }

    // Center in the current viewport
    let position = { x: 0, y: 0 };
    if (reactFlowInstance.current) {
      position = getViewportCenter(reactFlowInstance.current);
    }

    // Minimal default scene
    const newScene = {
      name: newSceneId,
      description: '',
      location: '',
      actions: {},
      position,
    };

    const newNarrative = {
      ...narrativeState,
      chapters: narrativeState.chapters.map((chapter) => ({
        ...chapter,
        scenes: {
          ...chapter.scenes,
          [newSceneId]: newScene,
        },
      })),
    };

    pushNarrativeState(newNarrative);
    onSaveScene(newSceneId, newScene);
    setFocusedNodeId(newSceneId);
  }, [narrativeState, onSaveScene, pushNarrativeState]);

  //
  // RENDER
  //
  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Floating buttons */}
      <div className="absolute top-20 left-4 z-10 flex gap-1">
        <button
          onClick={() => {
            undo();
            setNotification('Changes undone');
          }}
          disabled={!canUndo}
          className={`p-1 rounded text-white ${
            canUndo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          } shadow-md`}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon sx={{ fontSize: 18 }} />
        </button>

        <button
          onClick={() => {
            redo();
            setNotification('Changes redone');
          }}
          disabled={!canRedo}
          className={`p-1 rounded text-white ${
            canRedo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          } shadow-md`}
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        >
          <RedoIcon sx={{ fontSize: 18 }} />
        </button>

        <button
          onClick={clearHistory}
          className="p-1 rounded text-white bg-red-500 hover:bg-red-600 shadow-md"
          title="Clear History"
        >
          <DeleteIcon sx={{ fontSize: 18 }} />
        </button>

        <button
          onClick={handleReset}
          className="p-1 rounded text-white bg-yellow-500 hover:bg-yellow-600 shadow-md"
          title="Reset to initial state"
        >
          <RestartAltIcon sx={{ fontSize: 18 }} />
        </button>

        <button
          onClick={handleAddScene}
          className="p-1 rounded text-white bg-green-500 hover:bg-green-600 shadow-md"
          title="Add New Scene"
        >
          <AddCircleIcon sx={{ fontSize: 18 }} />
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <Notification message={notification} onHide={() => setNotification(null)} />
      )}

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        defaultViewport={DEFAULT_VIEWPORT}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
        fitView
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap
          style={minimapStyle}
          nodeColor={() => '#2563eb'}
          nodeStrokeWidth={3}
          nodeStrokeColor="#fff"
          nodeBorderRadius={2}
          maskColor="rgba(0,0,0,0.2)"
          position="bottom-right"
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};

export default NarrativeFlowEditor;
