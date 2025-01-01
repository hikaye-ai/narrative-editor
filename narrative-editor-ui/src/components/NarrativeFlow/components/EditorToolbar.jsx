import React from 'react';
import PropTypes from 'prop-types';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RestoreIcon from '@mui/icons-material/Restore';
import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { deleteDatabase } from '../utils/indexedDB';

export const EditorToolbar = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  clearHistory,
  onRevertAll,
  onAddScene,
  onAutoLayout
}) => {
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      clearHistory();
    }
  };

  const handleResetDB = async () => {
    if (window.confirm('Reset database? This will clear all saved history.')) {
      try {
        await deleteDatabase();
        window.location.reload();
      } catch (error) {
        console.error('Error resetting database:', error);
      }
    }
  };

  return (
    <div className="absolute top-20 left-4 z-10 flex gap-0.5">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-1 rounded text-white ${
          canUndo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
        }`}
        title="Undo (Ctrl+Z)"
      >
        <UndoIcon className="w-3 h-3" />
      </button>
      <button
        onClick={onRedo}
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
        onClick={onRevertAll}
        className="p-1 rounded text-white bg-orange-500 hover:bg-orange-600"
        title="Revert All Changes"
      >
        <RestoreIcon className="w-3 h-3" />
      </button>
      <button
        onClick={onAddScene}
        className="p-1 rounded text-white bg-green-500 hover:bg-green-600"
        title="Add New Scene"
      >
        <AddIcon className="w-3 h-3" />
      </button>
      <button
        onClick={onAutoLayout}
        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
        title=""
      >
        <AutorenewIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

EditorToolbar.propTypes = {
  canUndo: PropTypes.bool.isRequired,
  canRedo: PropTypes.bool.isRequired,
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
  clearHistory: PropTypes.func.isRequired,
  onRevertAll: PropTypes.func.isRequired,
  onAddScene: PropTypes.func.isRequired,
  onAutoLayout: PropTypes.func.isRequired
}; 