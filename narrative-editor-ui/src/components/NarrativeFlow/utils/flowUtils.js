import dagre from 'dagre';
import { NODE_WIDTH, NODE_HEIGHT } from '../constants';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// Add collision detection helper
const doNodesCollide = (node1, node2, padding = 50) => {
  const left1 = node1.position.x;
  const right1 = left1 + NODE_WIDTH;
  const top1 = node1.position.y;
  const bottom1 = top1 + NODE_HEIGHT;

  const left2 = node2.position.x;
  const right2 = left2 + NODE_WIDTH;
  const top2 = node2.position.y;
  const bottom2 = top2 + NODE_HEIGHT;

  return !(right1 + padding < left2 || 
           left1 > right2 + padding || 
           bottom1 + padding < top2 || 
           top1 > bottom2 + padding);
};

// Add force-directed adjustment
const adjustNodesPosition = (nodes) => {
  const ITERATIONS = 50;
  const FORCE_STRENGTH = 1;
  
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    let moved = false;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (doNodesCollide(nodes[i], nodes[j])) {
          moved = true;
          
          // Calculate center points
          const center1 = {
            x: nodes[i].position.x + NODE_WIDTH / 2,
            y: nodes[i].position.y + NODE_HEIGHT / 2
          };
          const center2 = {
            x: nodes[j].position.x + NODE_WIDTH / 2,
            y: nodes[j].position.y + NODE_HEIGHT / 2
          };
          
          // Calculate direction vector
          const dx = center2.x - center1.x;
          const dy = center2.y - center1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance === 0) continue;
          
          // Normalize and apply force
          const moveX = (dx / distance) * FORCE_STRENGTH;
          const moveY = (dy / distance) * FORCE_STRENGTH;
          
          // Move nodes apart
          nodes[i].position.x -= moveX * 200;
          nodes[i].position.y -= moveY * 200;
          nodes[j].position.x += moveX * 200;
          nodes[j].position.y += moveY * 200;
        }
      }
    }
    
    if (!moved) break;
  }
  
  return nodes;
};

export const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  // If there's only one node, don't apply layout
  if (nodes.length <= 1) {
    return { nodes, edges };
  }

  dagreGraph.setGraph({ 
    rankdir: direction,
    ranksep: 600,
    nodesep: 600,
    align: 'UL',
    ranker: ''
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  let layoutedNodes = nodes.map((node) => {
    // If this is a new node (no edges connected to it), keep its original position
    const isNewNode = !edges.some(edge => 
      edge.source === node.id || edge.target === node.id
    );

    if (isNewNode) {
      return node;
    }

    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  // Apply force-directed adjustment to prevent collisions
  layoutedNodes = adjustNodesPosition(layoutedNodes);

  return { nodes: layoutedNodes, edges };
};

export const getViewportCenter = (reactFlowInstance) => {
    const { x, y, zoom } = reactFlowInstance.current.getViewport();
    const width = window.innerWidth;
    const height = window.innerHeight - 80; // Account for toolbar
    
    const position = {
      x: (-x + width / 2) / zoom - NODE_WIDTH / 2,
      y: (-y + height / 2) / zoom - NODE_HEIGHT / 2
    };

    return position;
 };

export const extractUniqueItems = (narrative) => {
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

export const focusOnNode = (nodeId, reactFlowInstance) => {
  if (!nodeId || !reactFlowInstance) return;
  
  const node = reactFlowInstance.getNode(nodeId);
  if (!node) return;

  reactFlowInstance.setCenter(
    node.position.x + node.width / 2,
    node.position.y + node.height / 2,
    { duration: 800, zoom: 1.5 }
  );
}; 