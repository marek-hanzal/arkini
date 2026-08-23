import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { EditorProjectRecordSchema } from "~/editor/EditorProjectRecordSchema";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/editor/EditorProjectRepositoryError";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

const descriptorSchema = z
	.object({
		projectId: IdSchema,
		title: z.string(),
		version: ArkpackVersionSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict();

const commitTransportSchema = z
	.object({
		...descriptorSchema.shape,
		revision: z.number().int().nonnegative(),
		config: GameConfigSchema,
	})
	.strict();

const materializeCommit = (transport: z.infer<typeof commitTransportSchema>) => {
	const record = EditorProjectRecordSchema.parse({
		projectId: transport.projectId,
		config: transport.config,
		version: transport.version,
		revision: transport.revision,
		createdAtMs: transport.createdAtMs,
		updatedAtMs: transport.updatedAtMs,
	});
	if (transport.title !== record.config.meta.title || transport.version !== record.version) {
		throw new Error("Editor IPC metadata does not match the canonical project config.");
	}
	return {
		projectId: record.projectId,
		title: record.config.meta.title,
		version: record.version,
		createdAtMs: record.createdAtMs,
		updatedAtMs: record.updatedAtMs,
		revision: record.revision,
		config: record.config,
	};
};

const parseCommit = (candidate: unknown) =>
	materializeCommit(commitTransportSchema.parse(candidate));

const parseProject = (candidate: unknown) => {
	const project = z
		.object({
			...descriptorSchema.shape,
			revision: z.number().int().nonnegative(),
			config: GameConfigSchema,
			resources: ResourceSchema.array(),
		})
		.strict()
		.parse(candidate);
	return {
		...materializeCommit({
			projectId: project.projectId,
			title: project.title,
			version: project.version,
			createdAtMs: project.createdAtMs,
			updatedAtMs: project.updatedAtMs,
			revision: project.revision,
			config: project.config,
		}),
		resources: project.resources
			.map((resource) => ({
				...resource,
				bytes: new Uint8Array(resource.bytes),
			}))
			.sort((left, right) => left.id.localeCompare(right.id)),
	};
};

const callFx = <Value, Parsed>(
	operation: EditorProjectRepositoryOperation,
	call: () => Promise<EditorProjectTransport.Result<Value>>,
	parse: (value: Value) => Parsed,
) =>
	Effect.tryPromise({
		try: call,
		catch: (cause) =>
			new EditorProjectRepositoryError({
				operation,
				message: "The editor IPC request failed.",
				cause,
			}),
	}).pipe(
		Effect.flatMap((result) =>
			Effect.try({
				try: (): EditorProjectTransport.Result<Value> => {
					if (typeof result !== "object" || result === null || !("type" in result)) {
						throw new Error("Editor IPC returned no result envelope.");
					}
					if (result.type === "success" && "value" in result) return result;
					if (
						result.type === "failure" &&
						"error" in result &&
						typeof result.error === "object" &&
						result.error !== null &&
						"operation" in result.error &&
						"message" in result.error &&
						typeof result.error.operation === "string" &&
						typeof result.error.message === "string"
					) {
						return result as EditorProjectTransport.Result<Value>;
					}
					throw new Error("Editor IPC returned an invalid result envelope.");
				},
				catch: (cause) =>
					new EditorProjectRepositoryError({
						operation,
						message: "The editor IPC response is invalid.",
						cause,
					}),
			}).pipe(
				Effect.flatMap((envelope) =>
					envelope.type === "failure"
						? Effect.fail(new EditorProjectRepositoryError(envelope.error))
						: Effect.try({
								try: () => parse(envelope.value),
								catch: (cause) =>
									new EditorProjectRepositoryError({
										operation,
										message: "The editor IPC response is invalid.",
										cause,
									}),
							}),
				),
			),
		),
	);

const validateFx = <Value>(operation: EditorProjectRepositoryOperation, validate: () => Value) =>
	Effect.try({
		try: validate,
		catch: (cause) =>
			new EditorProjectRepositoryError({
				operation,
				message: "The editor project request is invalid.",
				cause,
			}),
	});

/** Creates an infallible renderer proxy; editor availability is queried separately. */
export const createElectronEditorProjectRepositoryFx = Effect.sync(
	(): EditorProjectRepositoryService => ({
		awaitIdleFx: callFx(
			"await-idle",
			() => window.arkini.editor.awaitIdle(),
			() => undefined,
		),
		createProjectFx: ({ projectId, version, config: candidateConfig, resources: candidates }) =>
			validateFx("create-project", () => ({
				projectId: IdSchema.parse(projectId),
				version: ArkpackVersionSchema.parse(version),
				config: GameConfigSchema.parse(candidateConfig),
				resources: ResourceSchema.array().parse(candidates),
			})).pipe(
				Effect.flatMap((request) =>
					callFx(
						"create-project",
						() => window.arkini.editor.createProject(request),
						parseProject,
					),
				),
			),
		listProjectsFx: callFx(
			"list-projects",
			() => window.arkini.editor.listProjects(),
			(value) => descriptorSchema.array().parse(value),
		),
		readProjectFx: (projectId) =>
			validateFx("read-project", () => IdSchema.parse(projectId)).pipe(
				Effect.flatMap((parsedProjectId) =>
					callFx(
						"read-project",
						() => window.arkini.editor.readProject(parsedProjectId),
						(value) => (value === null ? null : parseProject(value)),
					),
				),
			),
		replaceConfigFx: ({ projectId, expectedRevision, config: candidateConfig }) =>
			validateFx("replace-config", () => ({
				projectId: IdSchema.parse(projectId),
				expectedRevision: z.number().int().nonnegative().parse(expectedRevision),
				config: GameConfigSchema.parse(candidateConfig),
			})).pipe(
				Effect.flatMap((request) =>
					callFx(
						"replace-config",
						() => window.arkini.editor.replaceConfig(request),
						parseCommit,
					),
				),
			),
		replaceResourceFx: ({
			config: candidateConfig,
			currentId,
			expectedRevision,
			projectId,
			resource: candidateResource,
		}) =>
			validateFx("replace-resource", () => ({
				config: GameConfigSchema.parse(candidateConfig),
				currentId: IdSchema.parse(currentId),
				expectedRevision: z.number().int().nonnegative().parse(expectedRevision),
				projectId: IdSchema.parse(projectId),
				resource: ResourceSchema.parse(candidateResource),
			})).pipe(
				Effect.flatMap((request) =>
					callFx(
						"replace-resource",
						() => window.arkini.editor.replaceResource(request),
						parseProject,
					),
				),
			),
		upsertItemFx: ({ projectId, item: candidateItem }) =>
			validateFx("upsert-item", () => ({
				projectId: IdSchema.parse(projectId),
				item: ItemSchema.parse(candidateItem),
			})).pipe(
				Effect.flatMap((request) =>
					callFx(
						"upsert-item",
						() => window.arkini.editor.upsertItem(request),
						parseCommit,
					),
				),
			),
		upsertResourcesFx: ({ projectId, resources: candidateResources }) =>
			validateFx("upsert-resource", () => ({
				projectId: IdSchema.parse(projectId),
				resources: ResourceSchema.array().min(1).parse(candidateResources),
			})).pipe(
				Effect.flatMap((request) =>
					callFx(
						"upsert-resource",
						() => window.arkini.editor.upsertResources(request),
						parseProject,
					),
				),
			),
	}),
);
