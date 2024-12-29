import { makeAutoObservable, runInAction, toJS } from 'mobx';
import { createNodesAndEdges, getLayoutedElements } from '../utils/flowUtils';

class NarrativeStore {
  narrative = null;
  nodes = [];
  edges = [];
  collapsedNodes = new Set();
  notification = null;
  focusedNodeId = null;
  reactFlowInstance = null;
  history = [];
  currentHistoryIndex = 0;
  maxHistory = 100;

  constructor(initialNarrative) {
    makeAutoObservable(this, {
      isSceneReferenced: false,
      saveScene: false,
      deleteScene: false,
      renameScene: false,
      toggleNodeCollapse: false,
      getNarrative: false,
      getAllScenes: false,
    });
    
    // Bind methods that will be passed to components
    this.saveScene = this.saveScene.bind(this);
    this.deleteScene = this.deleteScene.bind(this);
    this.renameScene = this.renameScene.bind(this);
    this.isSceneReferenced = this.isSceneReferenced.bind(this);
    this.toggleNodeCollapse = this.toggleNodeCollapse.bind(this);
    this.getNarrative = this.getNarrative.bind(this);
    this.getAllScenes = this.getAllScenes.bind(this);
    
    this.loadInitialState(initialNarrative);
  }

  loadInitialState(initialNarrative) {
    // Load history from localStorage or use initial narrative
    try {
      const savedHistory = localStorage.getItem('narrativeEditorHistory');
      const savedCurrent = localStorage.getItem('narrativeEditorCurrent');
      
      if (savedHistory && savedCurrent) {
        this.history = JSON.parse(savedHistory);
        this.currentHistoryIndex = parseInt(savedCurrent, 10);
      } else {
        this.history = [initialNarrative];
        this.currentHistoryIndex = 0;
      }
      
      this.narrative = this.history[this.currentHistoryIndex];
      this.updateNodesAndEdges();
    } catch (error) {
      console.error('Error loading initial state:', error);
      this.history = [initialNarrative];
      this.currentHistoryIndex = 0;
      this.narrative = initialNarrative;
      this.updateNodesAndEdges();
    }
  }

  updateNodesAndEdges() {
    const chapter = this.narrative.chapters[0];
    const { nodes, edges } = createNodesAndEdges(chapter.scenes, this);
    console.log('Updating nodes and edges:', { nodes, edges });
    this.nodes = nodes;
    this.edges = edges;
  }

  setReactFlowInstance(instance) {
    this.reactFlowInstance = instance;
  }

  saveScene(sceneId, updatedScene) {
    const newNarrative = {
      ...this.narrative,
      chapters: this.narrative.chapters.map(chapter => ({
        ...chapter,
        scenes: {
          ...chapter.scenes,
          [sceneId]: updatedScene
        }
      }))
    };
    
    this.pushToHistory(newNarrative);
  }

  pushToHistory(newState) {
    runInAction(() => {
      const newHistory = this.history.slice(0, this.currentHistoryIndex + 1);
      newHistory.push(newState);
      
      if (newHistory.length > this.maxHistory) {
        newHistory.shift();
      }
      
      this.history = newHistory;
      this.currentHistoryIndex = Math.min(this.currentHistoryIndex + 1, this.maxHistory - 1);
      this.narrative = newState;
      
      this.updateNodesAndEdges();
      this.saveToLocalStorage();
    });
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('narrativeEditorHistory', JSON.stringify(this.history));
      localStorage.setItem('narrativeEditorCurrent', this.currentHistoryIndex.toString());
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  undo() {
    if (this.canUndo) {
      runInAction(() => {
        this.currentHistoryIndex--;
        this.narrative = this.history[this.currentHistoryIndex];
        this.updateNodesAndEdges();
        this.saveToLocalStorage();
        this.setNotification('Changes undone');
      });
    }
  }

  redo() {
    if (this.canRedo) {
      runInAction(() => {
        this.currentHistoryIndex++;
        this.narrative = this.history[this.currentHistoryIndex];
        this.updateNodesAndEdges();
        this.saveToLocalStorage();
        this.setNotification('Changes redone');
      });
    }
  }

  clearHistory() {
    if (window.confirm('Are you sure you want to clear the history? This action cannot be undone.')) {
      runInAction(() => {
        this.history = [this.narrative];
        this.currentHistoryIndex = 0;
        localStorage.removeItem('narrativeEditorHistory');
        localStorage.removeItem('narrativeEditorCurrent');
        this.setNotification('History cleared');
      });
    }
  }

  setNotification(message) {
    this.notification = message;
    setTimeout(() => runInAction(() => this.notification = null), 2000);
  }

  toggleNodeCollapse = (nodeId) => {
    runInAction(() => {
      if (this.collapsedNodes.has(nodeId)) {
        this.collapsedNodes.delete(nodeId);
      } else {
        this.collapsedNodes.add(nodeId);
      }
    });
  };

  isNodeCollapsed = (nodeId) => {
    return this.collapsedNodes.has(nodeId);
  };

  addScene() {
    const chapter = this.narrative.chapters[0];
    const scenes = chapter.scenes;
    
    let newSceneId = 'New Scene';
    let counter = 1;
    while (scenes[newSceneId]) {
      newSceneId = `New Scene ${counter}`;
      counter++;
    }

    const newScene = {
      name: newSceneId,
      description: '',
      location: '',
      actions: {},
      position: { x: 0, y: 0 } // You can calculate position based on viewport
    };

    const newNarrative = {
      ...this.narrative,
      chapters: this.narrative.chapters.map(chapter => ({
        ...chapter,
        scenes: {
          ...chapter.scenes,
          [newSceneId]: newScene
        }
      }))
    };

    this.pushToHistory(newNarrative);
    this.focusedNodeId = newSceneId;
    this.setNotification(`Scene "${newSceneId}" added`);
  }

  get canUndo() {
    return this.currentHistoryIndex > 0;
  }

  get canRedo() {
    return this.currentHistoryIndex < this.history.length - 1;
  }

  isSceneReferenced = (sceneId) => {
    const chapter = this.narrative.chapters[0];
    const scenes = chapter.scenes;

    const hasIncomingReferences = Object.values(scenes).some(scene => 
      Object.values(scene.actions).some(action => 
        action.next_scene === sceneId
      )
    );

    const hasOutgoingReferences = Object.values(scenes[sceneId]?.actions || {}).some(action => 
      action.next_scene !== null && action.next_scene !== ''
    );

    return hasIncomingReferences || hasOutgoingReferences;
  };

  deleteScene(sceneId) {
    if (this.isSceneReferenced(sceneId)) {
      alert('Cannot delete scene because it has references. Remove all references first.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete scene "${sceneId}"?`)) {
      return;
    }

    const newNarrative = {
      ...this.narrative,
      chapters: this.narrative.chapters.map(chapter => ({
        ...chapter,
        scenes: Object.fromEntries(
          Object.entries(chapter.scenes).filter(([id]) => id !== sceneId)
        )
      }))
    };

    this.pushToHistory(newNarrative);
    this.setNotification(`Scene "${sceneId}" deleted`);
  }

  renameScene(oldId, newId) {
    if (oldId === newId) return;
    
    const chapter = this.narrative.chapters[0];
    const scenes = chapter.scenes;

    if (scenes[newId]) {
      alert(`Scene "${newId}" already exists`);
      return;
    }

    const newNarrative = {
      ...this.narrative,
      chapters: this.narrative.chapters.map(chapter => {
        const newScenes = { ...chapter.scenes };
        newScenes[newId] = newScenes[oldId];
        delete newScenes[oldId];

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

    this.pushToHistory(newNarrative);
  }

  updateNodes(changes) {
    runInAction(() => {
      changes.forEach(change => {
        if (change.type === 'position' || change.type === 'dimensions') {
          const nodeIndex = this.nodes.findIndex(n => n.id === change.id);
          if (nodeIndex !== -1) {
            const updatedNode = { ...toJS(this.nodes[nodeIndex]) };
            if (change.type === 'position') {
              updatedNode.position = change.position;
            } else {
              updatedNode.dimensions = change.dimensions;
            }
            this.nodes[nodeIndex] = updatedNode;
          }
        }
      });
    });
  }

  updateEdges(changes) {
    runInAction(() => {
      changes.forEach(change => {
        if (change.type === 'remove') {
          this.edges = this.edges.filter(e => e.id !== change.id);
        } else if (change.type === 'select') {
          const edgeIndex = this.edges.findIndex(e => e.id === change.id);
          if (edgeIndex !== -1) {
            const updatedEdge = {
              ...toJS(this.edges[edgeIndex]),
              selected: change.selected
            };
            this.edges[edgeIndex] = updatedEdge;
          }
        }
      });
    });
  }

  getNarrative() {
    return this.narrative;
  }

  getAllScenes() {
    return this.narrative.chapters[0].scenes;
  }
}

export default NarrativeStore; 