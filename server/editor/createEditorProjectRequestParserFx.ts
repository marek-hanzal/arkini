import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectRepository } from "../../src/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "../../src/editor/EditorProjectRepositoryError";
import { IdSchema } from "../../src/engine/common/schema/IdSchema";
import { ItemSchema } from "../../src/engine/item/schema/ItemSchema";
import { ResourceSchema } from "../../src/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "../../src/engine/schema/GameConfigSchema";
import { ArkpackVersionSchema } from "../../src/engine/version/schema/ArkpackVersionSchema";
import { EditorBoardScenarioNameSchema } from "../../src/editor/board/EditorBoardScenarioSchema";

const createProjectSchema = z
	.object({
		projectId: IdSchema,
		version: ArkpackVersionSchema,
		config: GameConfigSchema,
		resources: ResourceSchema.array(),
	})
	.strict();
const upsertItemSchema = z
	.object({
		projectId: IdSchema,
		item: ItemSchema,
	})
	.strict();
const replaceConfigSchema = z
	.object({
		projectId: IdSchema,
		expectedRevision: z.number().int().nonnegative(),
		config: GameConfigSchema,
	})
	.strict();
const replaceResourceSchema = z
	.object({
		config: GameConfigSchema,
		currentId: IdSchema,
		expectedRevision: z.number().int().nonnegative(),
		projectId: IdSchema,
		resource: ResourceSchema,
	})
	.strict();
const upsertResourcesSchema = z
	.object({
		projectId: IdSchema,
		resources: ResourceSchema.array().min(1),
	})
	.strict();
const boardScenarioKeySchema = z
	.object({
		projectId: IdSchema,
		name: EditorBoardScenarioNameSchema,
	})
	.strict();
const writeBoardScenarioSchema = boardScenarioKeySchema
	.extend({
		expectedRevision: z.number().int().nonnegative(),
		bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength > 0),
	})
	.strict();

const parse = <Value>(
	operation: EditorProjectRepositoryError["operation"],
	schema: z.ZodType<Value>,
	candidate: unknown,
): Value => {
	const result = schema.safeParse(candidate);
	if (result.success) return result.data;
	throw new EditorProjectRepositoryError({
		operation,
		message: "The editor IPC request is invalid.",
		cause: result.error,
	});
};

/** Creates the server-owned validator capability used by the Electron IPC adapter. */
export const createEditorProjectRequestParserFx = Effect.fn("createEditorProjectRequestParserFx")(
	() =>
		Effect.succeed({
			parseCreateProject: (candidate: unknown): EditorProjectRepository.CreateProjectProps =>
				parse("create-project", createProjectSchema, candidate),
			parseProjectId: (candidate: unknown) => parse("read-project", IdSchema, candidate),
			parseReplaceConfig: (candidate: unknown): EditorProjectRepository.ReplaceConfigProps =>
				parse("replace-config", replaceConfigSchema, candidate),
			parseReplaceResource: (
				candidate: unknown,
			): EditorProjectRepository.ReplaceResourceProps =>
				parse("replace-resource", replaceResourceSchema, candidate),
			parseUpsertItem: (candidate: unknown): EditorProjectRepository.UpsertItemProps =>
				parse("upsert-item", upsertItemSchema, candidate),
			parseUpsertResources: (
				candidate: unknown,
			): EditorProjectRepository.UpsertResourcesProps =>
				parse("upsert-resource", upsertResourcesSchema, candidate),
			parseBoardScenarioProjectId: (candidate: unknown) =>
				parse("list-board-scenarios", IdSchema, candidate),
			parseBoardScenarioKey: (candidate: unknown): EditorProjectRepository.BoardScenarioKey =>
				parse("read-board-scenario", boardScenarioKeySchema, candidate),
			parseDeleteBoardScenario: (
				candidate: unknown,
			): EditorProjectRepository.BoardScenarioKey =>
				parse("delete-board-scenario", boardScenarioKeySchema, candidate),
			parseWriteBoardScenario: (
				candidate: unknown,
			): EditorProjectRepository.WriteBoardScenarioProps =>
				parse("write-board-scenario", writeBoardScenarioSchema, candidate),
		} as const),
);
