import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import type {
	EditorProjectVersionCheckoutInput,
	EditorProjectVersionCommitInput,
	EditorProjectVersionDiffInput,
	EditorProjectVersionTagInput,
} from "~/editor/version/EditorProjectVersion";
import {
	EditorProjectVersionBodySchema,
	EditorProjectVersionSubjectSchema,
	EditorProjectVersionTagSchema,
} from "~/editor/version/EditorProjectVersionMetadataSchema";

import { parseEditorProjectIpcRequestFx } from "./parseEditorProjectIpcRequestFx";

const createProjectSchema = z
	.object({
		version: ArkpackVersionSchema,
		config: GameConfigSchema,
		resources: ResourceSchema.array(),
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
		body: EditorProjectVersionBodySchema.optional(),
		expectedFingerprint: fingerprintSchema.optional(),
		projectId: IdSchema,
		subject: EditorProjectVersionSubjectSchema,
		tag: EditorProjectVersionTagSchema.optional(),
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
		tag: EditorProjectVersionTagSchema.optional(),
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
			parseCreateProjectFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.CreateProjectProps,
				EditorProjectRepositoryError
			> => parseEditorProjectIpcRequestFx("create-project", createProjectSchema, candidate),
			parseProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("read-project", IdSchema, candidate),
			parseDeleteProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("delete-project", IdSchema, candidate),
			parseDeleteItemFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.DeleteItemProps,
				EditorProjectRepositoryError
			> => parseEditorProjectIpcRequestFx("delete-item", deleteItemSchema, candidate),
			parseDeleteResourceFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.DeleteResourceProps,
				EditorProjectRepositoryError
			> => parseEditorProjectIpcRequestFx("delete-resource", deleteResourceSchema, candidate),
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
			parseSaveResourceFx: (
				candidate: unknown,
			): Effect.Effect<
				EditorProjectRepository.SaveResourceProps,
				EditorProjectRepositoryError
			> => parseEditorProjectIpcRequestFx("save-resource", saveResourceSchema, candidate),
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
			parseVersionStatusProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("read-version-status", IdSchema, candidate),
			parseVersionListProjectIdFx: (candidate: unknown) =>
				parseEditorProjectIpcRequestFx("list-versions", IdSchema, candidate),
			parseVersionCommitFx: (
				candidate: unknown,
			): Effect.Effect<EditorProjectVersionCommitInput, EditorProjectRepositoryError> =>
				parseEditorProjectIpcRequestFx("create-version", versionCommitSchema, candidate),
			parseVersionCheckoutFx: (
				candidate: unknown,
			): Effect.Effect<EditorProjectVersionCheckoutInput, EditorProjectRepositoryError> =>
				parseEditorProjectIpcRequestFx(
					"checkout-version",
					versionCheckoutSchema,
					candidate,
				),
			parseVersionTagFx: (
				candidate: unknown,
			): Effect.Effect<EditorProjectVersionTagInput, EditorProjectRepositoryError> =>
				parseEditorProjectIpcRequestFx("update-version-tag", versionTagSchema, candidate),
			parseVersionDiffFx: (
				candidate: unknown,
			): Effect.Effect<EditorProjectVersionDiffInput, EditorProjectRepositoryError> =>
				parseEditorProjectIpcRequestFx("diff-versions", versionDiffSchema, candidate),
		} as const),
);
