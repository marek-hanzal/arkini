import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

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

/** Creates the feature-owned validator capability used by the Electron IPC adapter. */
export const createEditorProjectRequestParserFx = Effect.fn("createEditorProjectRequestParserFx")(
	() =>
		Effect.succeed({
			parseCreateProjectFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.CreateProjectProps,
				EditorProjectRepositoryError
			> => parseEditorProjectIpcRequestFx("create-project", createProjectSchema, candidate),
			parseProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("read-project", IdSchema, candidate),
			parseReplaceConfigFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.ReplaceConfigProps,
				EditorProjectRepositoryError
			> => parseEditorProjectIpcRequestFx("replace-config", replaceConfigSchema, candidate),
			parseReplaceResourceFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.ReplaceResourceProps,
				EditorProjectRepositoryError
			> =>
				parseEditorProjectIpcRequestFx(
					"replace-resource",
					replaceResourceSchema,
					candidate,
				),
			parseUpsertItemFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.UpsertItemProps,
				EditorProjectRepositoryError
			> => parseEditorProjectIpcRequestFx("upsert-item", upsertItemSchema, candidate),
			parseUpsertResourcesFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.UpsertResourcesProps,
				EditorProjectRepositoryError
			> =>
				parseEditorProjectIpcRequestFx("upsert-resource", upsertResourcesSchema, candidate),
		} as const),
);
