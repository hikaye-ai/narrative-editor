import React, { useState, useEffect } from 'react';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useItemsHistory } from '../hooks/useItemsHistory';
import { Notification } from './Notification';

const ItemsEditor = ({ items, onSaveItems }) => {
  // Initialize our items history directly with the props `items`.
  // This ensures we don't keep pushing the same data on every re-render.
  const {
    state: editedItems = {},
    pushState,
    undo,
    redo,
    clearHistory,
    reset,
    canUndo,
    canRedo,
  } = useItemsHistory(items || {}, 'items-history');

  const [newItemName, setNewItemName] = useState('');
  const [notification, setNotification] = useState(null);

  const handleItemChange = (itemName, field, value) => {
    if (!editedItems) return;

    const updatedItem = {
      ...editedItems[itemName],
      [field]: value,
    };

    // Validation rules
    if (field === 'player_usable' && value === true && !editedItems[itemName].effect) {
      alert('Player usable items must have an effect description');
      return;
    }

    if (field === 'effect' && !value && editedItems[itemName].player_usable) {
      alert('Player usable items must have an effect description');
      return;
    }

    if (field === 'stats_effect') {
      updatedItem.stats_effect =
        value === null
          ? null
          : {
              ...(editedItems[itemName].stats_effect || { health: 0, oxygen: 0 }),
              ...value,
            };
    }

    const updatedItems = {
      ...editedItems,
      [itemName]: updatedItem,
    };

    pushState(updatedItems);
    onSaveItems(updatedItems);
  };

  const addNewItem = () => {
    if (!newItemName.trim() || !editedItems) return;

    if (editedItems[newItemName]) {
      alert('An item with this name already exists');
      return;
    }

    const updatedItems = {
      ...editedItems,
      [newItemName]: {
        description: '',
        player_usable: false,
        effect: '',
        bypass_check: null,
        stats_effect: null,
      },
    };

    pushState(updatedItems);
    onSaveItems(updatedItems);
    setNewItemName('');
  };

  const deleteItem = (itemName) => {
    if (!editedItems) return;

    if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
      return;
    }

    const newItems = { ...editedItems };
    delete newItems[itemName];
    pushState(newItems);
    onSaveItems(newItems);
  };

  const handleUndo = () => {
    undo();
    setNotification('Changes undone');
  };

  const handleRedo = () => {
    redo();
    setNotification('Changes redone');
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all changes? This cannot be undone.')) {
      reset();
      setNotification('Reset to initial state');
    }
  };

  // Add keyboard shortcuts for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
        } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
          event.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 bg-white border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Items Editor</h2>
          <div className="flex gap-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`p-1 rounded text-white ${
                canUndo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
              } shadow-md`}
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon sx={{ fontSize: 18 }} />
            </button>
            <button
              onClick={handleRedo}
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
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="New item name"
            className="border rounded px-2 py-1"
          />
          <button
            onClick={addNewItem}
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            Add Item
          </button>
        </div>
      </div>

      {notification && (
        <Notification
          message={notification}
          onHide={() => setNotification(null)}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4">
          {editedItems &&
            typeof editedItems === 'object' &&
            Object.entries(editedItems).map(([itemName, item]) => (
              <div key={itemName} className="border rounded-lg p-4 bg-white shadow">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg">{itemName}</h3>
                  <button
                    onClick={() => deleteItem(itemName)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Description
                    </label>
                    <textarea
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(itemName, 'description', e.target.value)
                      }
                      className="w-full p-2 border rounded"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Effect {item.player_usable && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={item.effect}
                      onChange={(e) =>
                        handleItemChange(itemName, 'effect', e.target.value)
                      }
                      className={`w-full p-2 border rounded ${
                        item.player_usable && !item.effect ? 'border-red-500' : ''
                      }`}
                      placeholder={
                        item.player_usable
                          ? 'Required for player usable items'
                          : 'Effect description'
                      }
                    />
                    {item.player_usable && !item.effect && (
                      <p className="text-red-500 text-xs mt-1">
                        Effect is required for player usable items
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Bypass Check
                      </label>
                      <select
                        value={item.bypass_check || ''}
                        onChange={(e) =>
                          handleItemChange(
                            itemName,
                            'bypass_check',
                            e.target.value || null
                          )
                        }
                        className="w-full p-2 border rounded"
                      >
                        <option value="">None</option>
                        <option value="TECH">TECH</option>
                        <option value="STR">STR</option>
                        <option value="SOC">SOC</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Player Usable
                      </label>
                      <select
                        value={item.player_usable.toString()}
                        onChange={(e) =>
                          handleItemChange(
                            itemName,
                            'player_usable',
                            e.target.value === 'true'
                          )
                        }
                        className="w-full p-2 border rounded"
                      >
                        <option value="false">Auto Use</option>
                        <option value="true">Player Usable</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Stats Effect
                    </label>
                    <select
                      value={item.stats_effect === null ? 'none' : 'has_effect'}
                      onChange={(e) =>
                        handleItemChange(
                          itemName,
                          'stats_effect',
                          e.target.value === 'none'
                            ? null
                            : { health: 0, oxygen: 0 }
                        )
                      }
                      className="w-full p-2 border rounded mb-2"
                    >
                      <option value="none">None</option>
                      <option value="has_effect">Has Effect</option>
                    </select>

                    {item.stats_effect !== null && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Health Effect
                          </label>
                          <input
                            type="number"
                            value={item.stats_effect.health}
                            onChange={(e) =>
                              handleItemChange(itemName, 'stats_effect', {
                                health: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Oxygen Effect
                          </label>
                          <input
                            type="number"
                            value={item.stats_effect.oxygen}
                            onChange={(e) =>
                              handleItemChange(itemName, 'stats_effect', {
                                oxygen: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full p-2 border rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ItemsEditor;
