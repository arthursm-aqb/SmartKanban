import { ContextFileType } from './Team';

export interface Project {
  id: string;
  teamId: string;
  name: string;
  contextFileName: string;
  contextFileType: ContextFileType;
  contextText: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Board {
  id: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}
