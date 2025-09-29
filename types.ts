export interface Files {
  [path: string]: string;
}

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface FileAttachment {
  name: string;
  type: string;
  content: string; // base64 encoded string
}

export interface Change {
  filePath: string;
  content?: string;
  action: 'create' | 'update' | 'delete';
}

export interface Modification {
  projectName?: string;
  reason: string;
  changes: Change[];
  previewHtml?: string;
}

export type ApiResponse =
  | {
      responseType: 'CHAT';
      message: string;
      modification?: never;
    }
  | {
      responseType: 'MODIFY_CODE';
      modification: Modification;
      message?: never;
    };

// New types for version history
export interface AppState {
  files: Files;
  previewHtml: string;
  chatMessages: Message[];
  hasGeneratedCode: boolean;
  projectName: string;
}

export interface History {
  versions: AppState[];
  currentIndex: number;
}
