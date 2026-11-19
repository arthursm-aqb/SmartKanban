import { z } from 'zod';
import { ActivityActionType } from '../../domain/entities/ActivityLog';
import { StickyNoteColor } from '../../domain/entities/StickyNote';
import { ColumnType, SubcolumnType } from '../../domain/value-objects/KanbanStage';

export const idSchema = z.uuid('Identificador UUID inválido.');

export const columnTypeSchema = z.enum(ColumnType);

export const subcolumnSchema = z.enum(SubcolumnType);

export const stickyNoteColorSchema = z.enum(StickyNoteColor);

export const activityActionTypeSchema = z.enum(ActivityActionType);
