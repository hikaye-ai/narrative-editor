import dagre from 'dagre';
import { MarkerType, Position } from 'reactflow';

const nodeWidth = 280;
const nodeHeight = 250;

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  dagreGraph.setGraph({ 
    rankdir: direction, 
    ranksep: 600,
    nodesep: 1000
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

export const createNodesAndEdges = (scenes, store) => {
  const incomingConnections = new Map();
  
  Object.entries(scenes).forEach(([_, scene]) => {
    Object.entries(scene.actions).forEach(([_, action]) => {
      if (action.next_scene) {
        incomingConnections.set(action.next_scene, (incomingConnections.get(action.next_scene) || 0) + 1);
      }
    });
  });

  const nodes = Object.entries(scenes).map(([sceneId, scene]) => {
    const sceneData = {
      ...scene,
      originalId: sceneId,
    };

    return {
      id: sceneId,
      type: 'custom',
      data: {
        ...sceneData,
        storeActions: {
          saveScene: store.saveScene.bind(store),
          deleteScene: store.deleteScene.bind(store),
          renameScene: store.renameScene.bind(store),
          isSceneReferenced: store.isSceneReferenced.bind(store),
          toggleNodeCollapse: store.toggleNodeCollapse.bind(store),
          isNodeCollapsed: store.isNodeCollapsed.bind(store),
          getNarrative: () => store.narrative,
          getAllScenes: () => store.narrative.chapters[0].scenes
        }
      },
      position: scene.position || { x: 0, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const edges = [];
  Object.entries(scenes).forEach(([sourceId, scene]) => {
    Object.entries(scene.actions).forEach(([actionName, action]) => {
      if (scenes[action.next_scene]) {
        edges.push({
          id: `${sourceId}-${action.next_scene}-${actionName}`,
          source: sourceId,
          target: action.next_scene,
          label: actionName,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#2563eb', strokeWidth: 2 },
          labelStyle: { fill: '#444', fontSize: 12 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#2563eb',
          },
          sourceHandle: null,
          targetHandle: null,
        });
      }
    });
  });

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);

  console.log('Nodes:', layoutedNodes);
  console.log('Edges:', layoutedEdges);

  return {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    startNode: layoutedNodes.find(node => !incomingConnections.has(node.id))
  };
}; 