import React from 'react';
import { SceneNode } from './SceneNode';

// Create a wrapper component to handle props
function CustomNode(props) {
  const allScenes = props.data?.allScenes || [];
  const isCollapsed = props.data?.isCollapsed || false;
  const handlers = props.data?.handlers || {};

  return React.createElement(SceneNode, {
    ...props,
    allScenes,
    isCollapsed,
    onCollapse: handlers.onCollapse,
    onSave: handlers.onSave,
    onRenameScene: handlers.onRename,
    onDeleteScene: handlers.onDelete,
    canDelete: handlers.canDelete,
  });
}

// Create node types object
const nodeTypes = {
  custom: CustomNode
};

export default nodeTypes; 