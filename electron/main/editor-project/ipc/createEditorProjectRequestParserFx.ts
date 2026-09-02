import { Effect } from "effect";
import { z } from "zod";

import type { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import type {
	ProjectVersionCheckoutInput,
	ProjectVersionCommitInput,
	ProjectVersionDiffInput,
	ProjectVersionTagInput,
} from "~/project-version/type/ProjectVersion";
import {
	ProjectVersionBodySchema,
	ProjectVersionSubjectSchema,
	ProjectVersionTagSchema,
} from "~/project-version/schema/ProjectVersionMetadataSchema";

import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const createProjectSchema = z
	.object({
		version: GameVersionSchema,
		config: GameConfigSchema,
		initialVersionSubject: ProjectVersionSubjectSchema.optional(),
		resources: ResourceSchema.array(),
	})
	.strict();
const buildProjectSchema = z
	.object({
		expectedRevision: z.number().int().nonnegative(),
		projectId: IdSchema,
	})
	.strict();
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
const saveResourceSchema = z
	.object({
		expectedRevision: z.number().int().nonnegative(),
		overwrite: z.boolean(),
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
const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
const versionReferenceSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("current"),
		})
		.strict(),
	z
		.object({
			type: z.literal("version"),
			versionId: IdSchema,
		})
		.strict(),
]);
const versionCommitSchema = z
	.object({
		body: ProjectVersionBodySchema.optional(),
		expectedFingerprint: fingerprintSchema.optional(),
		projectId: IdSchema,
		subject: ProjectVersionSubjectSchema,
		tag: ProjectVersionTagSchema.optional(),
	})
	.strict();
const versionCheckoutSchema = z
	.object({
		expectedFingerprint: fingerprintSchema.optional(),
		projectId: IdSchema,
		versionId: IdSchema,
	})
	.strict();
const versionTagSchema = z
	.object({
		projectId: IdSchema,
		tag: ProjectVersionTagSchema.optional(),
		versionId: IdSchema,
	})
	.strict();
const versionDiffSchema = z
	.object({
		projectId: IdSchema,
		from: versionReferenceSchema,
		to: versionReferenceSchema,
	})
	.strict();

/** Creates the feature-owned validator capability used by the Electron IPC adapter. */
export const createEditorProjectRequestParserFx = Effect.fn("createEditorProjectRequestParserFx")(
	() =>
		Effect.succeed({
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
			parseSaveResourceFx: (
				candidate: unknown,
			): Effect.Effect<ProjectRepository.SaveResourceProps, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx("save-resource", saveResourceSchema, candidate),
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
			parseVersionStatusProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("read-version-status", IdSchema, candidate),
			parseVersionCommitPreviewProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("preview-version-commit", IdSchema, candidate),
			parseVersionListProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("list-versions", IdSchema, candidate),
			parseVersionCommitFx: (
				candidate: unknown,
			): Effect.Effect<ProjectVersionCommitInput, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx("create-version", versionCommitSchema, candidate),
			parseVersionCheckoutFx: (
				candidate: unknown,
			): Effect.Effect<ProjectVersionCheckoutInput, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx(
					"checkout-version",
					versionCheckoutSchema,
					candidate,
				),
			parseVersionTagFx: (
				candidate: unknown,
			): Effect.Effect<ProjectVersionTagInput, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx("update-version-tag", versionTagSchema, candidate),
			parseVersionDiffFx: (
				candidate: unknown,
			): Effect.Effect<ProjectVersionDiffInput, ProjectRepositoryError, never> =>
				parseEditorProjectIpcRequestFx("diff-versions", versionDiffSchema, candidate),
		} as const),
);
