import { Effect } from "effect";
import { z } from "zod";

import type { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";

import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const createProjectSchema = z
	.object({
		version: VersionPartsSchema,
		config: GameConfigSchema,
		resources: ResourceSchema.array(),
	})
	.strict();
const saveBuildVersionSchema = z
	.object({
		version: VersionPartsSchema,
		expectedRevision: z.number().int().nonnegative(),
		projectId: IdSchema,
	})
	.strict();
const buildProjectSchema = saveBuildVersionSchema
	.omit({
		version: true,
	})
	.extend({
		expectedVersion: VersionPartsSchema,
	});
const readProjectBuildSchema = z
	.object({
		contentHash: z.string().regex(/^[a-f0-9]{64}$/),
		expectedRevision: z.number().int().nonnegative(),
		projectId: IdSchema,
	})
	.strict();
const upsertItemSchema = z
	.object({
		expectedRevision: z.number().int().nonnegative().optional(),
		projectId: IdSchema,
		item: ItemSchema,
	})
	.strict();
const deleteItemSchema = z
	.object({
		projectId: IdSchema,
		itemUid: IdSchema,
		expectedRevision: z.number().int().nonnegative(),
		force: z.boolean(),
	})
	.strict();
const deleteResourceSchema = z
	.object({
		expectedRevision: z.number().int().nonnegative(),
		projectId: IdSchema,
		resourceId: IdSchema,
	})
	.strict();
const optimizeResourcesSchema = z
	.object({
		expectedRevision: z.number().int().nonnegative(),
		projectId: IdSchema,
		resourceIds: IdSchema.array()
			.min(1)
			.refine((ids) => new Set(ids).size === ids.length, {
				message: "Resource IDs must be unique.",
			}),
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
			parseSaveBuildVersionFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx(
					"save-build-version",
					saveBuildVersionSchema,
					candidate,
				),
			parseBuildProjectFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("build-project", buildProjectSchema, candidate),
			parseReadProjectBuildFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx(
					"read-project-build",
					readProjectBuildSchema,
					candidate,
				),
			parseCreateProjectFx: (
				candidate: unknown,
			): Effect.Effect<ProjectRepository.CreateProjectProps, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx("create-project", createProjectSchema, candidate),
			parseProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("read-project", IdSchema, candidate),
			parseDeleteProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("delete-project", IdSchema, candidate),
			parseProjectRootFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx(
					"open-project-directory",
					z.string().min(1),
					candidate,
				),
			parseDeleteItemFx: (
				candidate: unknown,
			): Effect.Effect<ProjectRepository.DeleteItemProps, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx("delete-item", deleteItemSchema, candidate),
			parseDeleteResourceFx: (
				candidate: unknown,
			): Effect.Effect<
				ProjectRepository.DeleteResourceProps,
				ProjectRepositoryError,
				never
			> => parseEditorProjectIpcRequestFx("delete-resource", deleteResourceSchema, candidate),
			parseOptimizeResourcesFx: (
				candidate: unknown,
			): Effect.Effect<
				ProjectRepository.OptimizeResourcesProps,
				ProjectRepositoryError,
				never
			> =>
				parseEditorProjectIpcRequestFx(
					"optimize-resources",
					optimizeResourcesSchema,
					candidate,
				),
			parseReplaceConfigFx: (
				candidate: unknown,
			): Effect.Effect<ProjectRepository.ReplaceConfigProps, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx("replace-config", replaceConfigSchema, candidate),
			parseReplaceResourceFx: (
				candidate: unknown,
			): Effect.Effect<
				ProjectRepository.ReplaceResourceProps,
				ProjectRepositoryError,
				never
			> =>
				parseEditorProjectIpcRequestFx(
					"replace-resource",
					replaceResourceSchema,
					candidate,
				),
			parseUpsertItemFx: (
				candidate: unknown,
			): Effect.Effect<ProjectRepository.UpsertItemProps, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx("upsert-item", upsertItemSchema, candidate),
			parseUpsertResourcesFx: (
				candidate: unknown,
			): Effect.Effect<
				ProjectRepository.UpsertResourcesProps,
				ProjectRepositoryError,
				never
			> =>
				parseEditorProjectIpcRequestFx("upsert-resource", upsertResourcesSchema, candidate),
		} as const),
);
