import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { EditorProjectDescriptorSchema } from "~/editor/EditorProjectDescriptor";
import { EditorProjectRecordSchema } from "~/editor/EditorProjectRecordSchema";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/editor/EditorProjectRepositoryError";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import {
	EditorBoardScenarioDescriptorSchema,
	EditorBoardScenarioSchema,
} from "~/editor/board/EditorBoardScenarioSchema";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

const commitTransportSchema = z
	.object({
		...EditorProjectDescriptorSchema.shape,
		revision: z.number().int().nonnegative(),
		config: GameConfigSchema,
	})
	.strict();

const versionReferenceSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("current") }).strict(),
	z.object({ type: z.literal("version"), versionId: z.string().min(1) }).strict(),
]);
const versionDescriptorSchema = z
	.object({
		applicability: z.discriminatedUnion("type", [
			z.object({ type: z.literal("applicable") }).strict(),
			z.object({ type: z.literal("incompatible"), reason: z.string() }).strict(),
		]),
		arkini: ArkiniVersionSchema,
		arkpackVersion: ArkpackVersionSchema,
		body: z.string().optional(),
		createdAtMs: z.number().int().nonnegative(),
		parentVersionId: z.string().min(1).optional(),
		projectId: z.string().min(1),
		snapshotFormatVersion: z.number().int().positive(),
		sourceRevision: z.number().int().nonnegative(),
		subject: z.string().min(1),
		tag: z.string().optional(),
		versionId: z.string().min(1),
	})
	.strict();
const versionStatusSchema = z
	.object({
		canCommit: z.boolean(),
		currentBaseVersionId: z.string().min(1).optional(),
		currentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
		dirty: z.boolean(),
		versionCount: z.number().int().nonnegative(),
	})
	.strict();
const versionValueChangeSchema = z
	.object({
		path: z.string(),
		before: z.unknown().optional(),
		after: z.unknown().optional(),
	})
	.strict();
const versionBinaryDiffSchema = z
	.object({
		change: z.enum(["added", "changed", "deleted"]),
		id: z.string(),
	})
	.strict();
const versionDiffSchema = z
	.object({
		from: versionReferenceSchema,
		to: versionReferenceSchema,
		hasChanges: z.boolean(),
		project: versionValueChangeSchema.array(),
		items: z
			.object({
				change: z.enum(["added", "changed", "deleted"]),
				uid: z.string(),
				values: versionValueChangeSchema.array(),
			})
			.strict()
			.array(),
		resources: versionBinaryDiffSchema.array(),
		scenarios: versionBinaryDiffSchema.array(),
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
			...EditorProjectDescriptorSchema.shape,
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

const parseBoardScenario = (candidate: unknown) => {
	const scenario = EditorBoardScenarioSchema.parse(candidate);
	return {
		...scenario,
		bytes: new Uint8Array(scenario.bytes),
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

/** Creates an infallible renderer proxy; editor availability is queried separately. */
export const createElectronEditorProjectRepositoryFx = Effect.sync(
	(): EditorProjectRepositoryService => ({
		awaitIdleFx: callFx(
			"await-idle",
			() => window.arkini.editor.awaitIdle(),
			() => undefined,
		),
		createProjectFx: (request) =>
			callFx(
				"create-project",
				() => window.arkini.editor.createProject(request),
				parseProject,
			),
		deleteProjectFx: (projectId) =>
			callFx(
				"delete-project",
				() => window.arkini.editor.deleteProject(projectId),
				() => undefined,
			),
		createVersionFx: (request) =>
			callFx(
				"create-version",
				() => window.arkini.editor.createVersion(request),
				(value) => versionDescriptorSchema.parse(value),
			),
		checkoutVersionFx: (request) =>
			callFx(
				"checkout-version",
				() => window.arkini.editor.checkoutVersion(request),
				(value) => {
					const checkout = z
						.object({ project: z.unknown(), version: versionDescriptorSchema })
						.strict()
						.parse(value);
					return {
						project: parseProject(checkout.project),
						version: checkout.version,
					};
				},
			),
		deleteItemFx: (request) =>
			callFx("delete-item", () => window.arkini.editor.deleteItem(request), parseCommit),
		diffVersionsFx: (request) =>
			callFx(
				"diff-versions",
				() => window.arkini.editor.diffVersions(request),
				(value) => versionDiffSchema.parse(value),
			),
		listProjectsFx: callFx(
			"list-projects",
			() => window.arkini.editor.listProjects(),
			(value) => EditorProjectDescriptorSchema.array().parse(value),
		),
		listVersionsFx: (projectId) =>
			callFx(
				"list-versions",
				() => window.arkini.editor.listVersions(projectId),
				(value) => versionDescriptorSchema.array().parse(value),
			),
		listBoardScenariosFx: (projectId) =>
			callFx(
				"list-board-scenarios",
				() => window.arkini.editor.listBoardScenarios(projectId),
				(value) => EditorBoardScenarioDescriptorSchema.array().parse(value),
			),
		readBoardScenarioFx: (request) =>
			callFx(
				"read-board-scenario",
				() => window.arkini.editor.readBoardScenario(request),
				(value) => (value === null ? null : parseBoardScenario(value)),
			),
		readProjectFx: (projectId) =>
			callFx(
				"read-project",
				() => window.arkini.editor.readProject(projectId),
				(value) => (value === null ? null : parseProject(value)),
			),
		readVersionStatusFx: (projectId) =>
			callFx(
				"read-version-status",
				() => window.arkini.editor.readVersionStatus(projectId),
				(value) => versionStatusSchema.parse(value),
			),
		replaceConfigFx: (request) =>
			callFx(
				"replace-config",
				() => window.arkini.editor.replaceConfig(request),
				parseCommit,
			),
		replaceResourceFx: (request) =>
			callFx(
				"replace-resource",
				() => window.arkini.editor.replaceResource(request),
				parseProject,
			),
		saveResourceFx: (request) =>
			callFx("save-resource", () => window.arkini.editor.saveResource(request), parseProject),
		upsertItemFx: (request) =>
			callFx("upsert-item", () => window.arkini.editor.upsertItem(request), parseCommit),
		upsertResourcesFx: (request) =>
			callFx(
				"upsert-resource",
				() => window.arkini.editor.upsertResources(request),
				parseProject,
			),
		updateVersionTagFx: (request) =>
			callFx(
				"update-version-tag",
				() => window.arkini.editor.updateVersionTag(request),
				(value) => versionDescriptorSchema.parse(value),
			),
		writeBoardScenarioFx: (request) =>
			callFx(
				"write-board-scenario",
				() => window.arkini.editor.writeBoardScenario(request),
				parseBoardScenario,
			),
		deleteBoardScenarioFx: (request) =>
			callFx(
				"delete-board-scenario",
				() => window.arkini.editor.deleteBoardScenario(request),
				() => undefined,
			),
	}),
);
