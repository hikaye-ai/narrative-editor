export type ChangeType = 
  | 'SCENE_FIELD_UPDATE'
  | 'SCENE_CREATE' 
  | 'SCENE_DELETE'
  | 'ACTION_CREATE'
  | 'ACTION_UPDATE'
  | 'ACTION_DELETE';

export interface Change {
  type: ChangeType;
  sceneId: string;
  timestamp: number;
  data: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    actionId?: string;
  };
} 