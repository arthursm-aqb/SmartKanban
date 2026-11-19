import { z } from 'zod';
import { ListActivityLogsInput } from '../../application/dtos/ActivityLogDtos';
import { JoinBoardInput, UpdateColumnWipInput } from '../../application/dtos/BoardDtos';
import {
  CreateStickyNoteInput,
  DeleteStickyNoteInput,
  UpdateStickyNoteInput,
} from '../../application/dtos/StickyNoteDtos';
import {
  CreateStoryInput,
  DeleteStoryInput,
  MoveStoryInput,
  UpdateStoryInput,
} from '../../application/dtos/StoryDtos';
import {
  DeleteTaskInput,
  GenerateTasksInput,
  MoveTaskInput,
  ReprioritizeStoryTasksInput,
  UpdateTaskInput,
} from '../../application/dtos/TaskDtos';
import { SubcolumnType } from '../../domain/value-objects/KanbanStage';
import {
  activityActionTypeSchema,
  columnTypeSchema,
  idSchema,
  stickyNoteColorSchema,
} from './common';

export const boardJoinSchema = z.strictObject({
  boardId: idSchema,
}) satisfies z.ZodType<JoinBoardInput>;

export const boardUpdateWipSchema = z.strictObject({
  columnType: columnTypeSchema,
  wipLimit: z.union([
    z.null(),
    z.int('O limite WIP deve ser um número inteiro.').min(1).max(99),
  ]),
}) satisfies z.ZodType<UpdateColumnWipInput>;

export const storyCreateSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(3, 'O título da história deve ter pelo menos 3 caracteres.')
    .max(120, 'O título da história deve ter no máximo 120 caracteres.'),
  description: z
    .string()
    .trim()
    .max(4000, 'A descrição deve ter no máximo 4000 caracteres.')
    .optional(),
}) satisfies z.ZodType<CreateStoryInput>;

export const storyUpdateSchema = z
  .strictObject({
    storyId: idSchema,
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(4000).optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: 'Informe ao menos título ou descrição para atualizar a história.',
  }) satisfies z.ZodType<UpdateStoryInput>;

export const storyMoveSchema = z.strictObject({
  storyId: idSchema,
  toSubcolumn: z.enum([SubcolumnType.BACKLOG, SubcolumnType.IN_SPECIFICATION]),
  position: z.int().min(0),
}) satisfies z.ZodType<MoveStoryInput>;

export const storyDeleteSchema = z.strictObject({
  storyId: idSchema,
}) satisfies z.ZodType<DeleteStoryInput>;

export const storyGenerateTasksSchema = z.strictObject({
  storyId: idSchema,
  tasks: z
    .array(
      z.strictObject({
        title: z
          .string()
          .trim()
          .min(3, 'O título da tarefa deve ter pelo menos 3 caracteres.')
          .max(120, 'O título da tarefa deve ter no máximo 120 caracteres.'),
        description: z
          .string()
          .trim()
          .max(2000, 'A descrição da tarefa deve ter no máximo 2000 caracteres.')
          .optional(),
      }),
    )
    .min(1, 'Adicione pelo menos 1 tarefa para gerar a linha em Especificado.')
    .max(20, 'Máximo de 20 tarefas por geração.'),
}) satisfies z.ZodType<GenerateTasksInput>;

export const taskUpdateSchema = z
  .strictObject({
    taskId: idSchema,
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: 'Informe ao menos título ou descrição para atualizar a tarefa.',
  }) satisfies z.ZodType<UpdateTaskInput>;

export const taskMoveSchema = z.strictObject({
  taskId: idSchema,
  toSubcolumn: z.enum([
    SubcolumnType.SPECIFIED,
    SubcolumnType.IN_IMPLEMENTATION,
    SubcolumnType.IMPLEMENTED,
    SubcolumnType.IN_REVIEW,
    SubcolumnType.REVIEWED,
  ]),
  position: z.int().min(0),
}) satisfies z.ZodType<MoveTaskInput>;

export const taskDeleteSchema = z.strictObject({
  taskId: idSchema,
}) satisfies z.ZodType<DeleteTaskInput>;

export const taskReprioritizeSchema = z.strictObject({
  storyId: idSchema,
}) satisfies z.ZodType<ReprioritizeStoryTasksInput>;

export const noteCreateSchema = z.strictObject({
  content: z
    .string()
    .trim()
    .min(1, 'O post-it não pode ficar vazio.')
    .max(500, 'O post-it deve ter no máximo 500 caracteres.'),
  color: stickyNoteColorSchema,
  posX: z.number().min(0).max(10000),
  posY: z.number().min(0).max(10000),
}) satisfies z.ZodType<CreateStickyNoteInput>;

export const noteUpdateSchema = z
  .strictObject({
    noteId: idSchema,
    content: z.string().trim().min(1).max(500).optional(),
    color: stickyNoteColorSchema.optional(),
    posX: z.number().min(0).max(10000).optional(),
    posY: z.number().min(0).max(10000).optional(),
  })
  .refine(
    (data) =>
      data.content !== undefined ||
      data.color !== undefined ||
      data.posX !== undefined ||
      data.posY !== undefined,
    {
      message: 'Informe ao menos um campo para atualizar o post-it.',
    },
  ) satisfies z.ZodType<UpdateStickyNoteInput>;

export const noteDeleteSchema = z.strictObject({
  noteId: idSchema,
}) satisfies z.ZodType<DeleteStickyNoteInput>;

export const activityListSchema = z.strictObject({
  cursor: idSchema.optional(),
  limit: z.int().min(1).max(100).default(50),
  actorId: idSchema.optional(),
  actionType: activityActionTypeSchema.optional(),
}) satisfies z.ZodType<ListActivityLogsInput>;
