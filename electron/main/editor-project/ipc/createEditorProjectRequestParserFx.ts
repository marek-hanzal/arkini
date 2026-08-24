import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

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

/** Creates the feature-owned validator capability used by the Electron IPC adapter. */
export const createEditorProjectRequestParserFx = Effect.fn("createEditorProjectRequestParserFx")(
	() =>
		Effect.succeed({
			parseCreateProjectFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.CreateProjectProps,
				EditorProjectRepositoryError
			> =>
				Effect.try({
					try: () => parse("create-project", createProjectSchema, candidate),
					catch: (error) => error as EditorProjectRepositoryError,
				}),
			parseProjectIdFx: (candidate: unknown) =>
				Effect.try({
					try: () => parse("read-project", IdSchema, candidate),
					catch: (error) => error as EditorProjectRepositoryError,
				}),
			parseReplaceConfigFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.ReplaceConfigProps,
				EditorProjectRepositoryError
			> =>
				Effect.try({
					try: () => parse("replace-config", replaceConfigSchema, candidate),
					catch: (error) => error as EditorProjectRepositoryError,
				}),
			parseReplaceResourceFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.ReplaceResourceProps,
				EditorProjectRepositoryError
			> =>
				Effect.try({
					try: () => parse("replace-resource", replaceResourceSchema, candidate),
					catch: (error) => error as EditorProjectRepositoryError,
				}),
			parseUpsertItemFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.UpsertItemProps,
				EditorProjectRepositoryError
			> =>
				Effect.try({
					try: () => parse("upsert-item", upsertItemSchema, candidate),
					catch: (error) => error as EditorProjectRepositoryError,
				}),
			parseUpsertResourcesFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.UpsertResourcesProps,
				EditorProjectRepositoryError
			> =>
				Effect.try({
					try: () => parse("upsert-resource", upsertResourcesSchema, candidate),
					catch: (error) => error as EditorProjectRepositoryError,
				}),
		} as const),
);
