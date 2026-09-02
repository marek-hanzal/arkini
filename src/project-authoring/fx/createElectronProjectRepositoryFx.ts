import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { ProjectCandidateSchema } from "~/project-authoring/schema/ProjectCandidateSchema";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import {
	BoardScenarioDescriptorSchema,
	BoardScenarioSchema,
} from "~/board-scenario/schema/BoardScenarioSchema";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import {
	ProjectCommitPayloadSchema,
	ProjectPayloadSchema,
} from "~/project-authoring/schema/ProjectPayloadSchema";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { NoteSchema } from "~/project-note/schema/NoteSchema";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";

const versionReferenceSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("current"),
		})
		.strict(),
	z
		.object({
			type: z.literal("version"),
			versionId: z.string().min(1),
		})
		.strict(),
]);
const versionDescriptorSchema = z
	.object({
		arkini: ArkiniVersionSchema,
		arkpackVersion: GameVersionSchema,
		body: z.string().optional(),
		createdAtMs: z.number().int().nonnegative(),
		parentVersionId: z.string().min(1).optional(),
		projectId: z.string().min(1),
		sourceRevision: z.number().int().nonnegative(),
		subject: z.string().min(1),
		tag: z.string().optional(),
		versionId: z.string().min(1),
	})
	.strict();
const versionValueChangeSchema = z
	.object({
		path: z.string(),
		before: z.unknown().optional(),
		after: z.unknown().optional(),
		bump: z
			.enum([
				"minor",
				"major",
			])
			.optional(),
	})
	.strict();
const versionBinaryDiffSchema = z
	.object({
		change: z.enum([
			"added",
			"changed",
			"deleted",
		]),
		bump: z
			.enum([
				"minor",
				"major",
			])
			.optional(),
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
				change: z.enum([
					"added",
					"changed",
					"deleted",
				]),
				uid: z.string(),
				values: versionValueChangeSchema.array(),
			})
			.strict()
			.array(),
		resources: versionBinaryDiffSchema.array(),
		scenarios: versionBinaryDiffSchema.array(),
	})
	.strict();
const versionCommitPreviewSchema = z
	.object({
		bump: z.enum([
			"noop",
			"minor",
			"major",
		]),
		canCommit: z.boolean(),
		currentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
		diff: versionDiffSchema.optional(),
		initial: z.boolean(),
		nextArkpackVersion: GameVersionSchema,
		scenariosToDelete: z.string().array(),
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

const parseBoardScenarioFn = (candidate: unknown) => {
	const scenario = BoardScenarioSchema.parse(candidate);
	return {
		...scenario,
		bytes: new Uint8Array(scenario.bytes),
	};
};

const parseCommitFn = (candidate: unknown) => ProjectCommitPayloadSchema.parse(candidate);
const parseProjectFn = (candidate: unknown) => ProjectPayloadSchema.parse(candidate);

const callFx = <Value, Parsed>(
	operation: ProjectRepositoryOperation,
	callFn: () => Promise<EditorProjectTransport.Result<Value>>,
	parseFn: (value: Value) => Parsed,
) =>
	invokeProjectTransportFx({
		callFn,
		operation,
		parseFn,
		requestMessage: "The editor IPC request failed.",
		responseMessage: "The editor IPC response is invalid.",
	});

/** Creates an infallible renderer proxy; editor availability is queried separately. */
export const createElectronProjectRepositoryFx = Effect.gen(function* () {
	const admission = yield* ProjectWriteAdmission;
	const writeFx = <Value>(
		operation: ProjectRepositoryOperation,
		effect: Effect.Effect<Value, ProjectRepositoryError, never>,
	) => admission.admitWriteFx(operation, effect);
	return {
		awaitIdleFx: callFx(
			"await-idle",
			() => window.arkini.editor.awaitIdleFn(),
			() => undefined,
		),
		createProjectFx: (request) =>
			writeFx(
				"create-project",
				callFx(
					"create-project",
					() => window.arkini.editor.createProjectFn(request),
					parseProjectFn,
				),
			),
		deleteProjectFx: (projectId) =>
			writeFx(
				"delete-project",
				callFx(
					"delete-project",
					() => window.arkini.editor.deleteProjectFn(projectId),
					() => undefined,
				),
			),
		createNoteFx: (request) =>
			writeFx(
				"create-note",
				callFx(
					"create-note",
					() => window.arkini.editor.createNoteFn(request),
					(value) => {
						const note = NoteSchema.parse(value);
						if (note.projectId !== request.projectId)
							throw new Error(
								"Editor note project identity does not match the request.",
							);
						return note;
					},
				),
			),
		deleteNoteFx: (request) =>
			writeFx(
				"delete-note",
				callFx(
					"delete-note",
					() => window.arkini.editor.deleteNoteFn(request),
					() => undefined,
				),
			),
		createVersionFx: (request) =>
			writeFx(
				"create-version",
				callFx(
					"create-version",
					() => window.arkini.editor.createVersionFn(request),
					(value) => versionDescriptorSchema.parse(value),
				),
			),
		checkoutVersionFx: (request) =>
			callFx(
				"checkout-version",
				() => window.arkini.editor.checkoutVersionFn(request),
				() => undefined,
			),
		deleteItemFx: (request) =>
			writeFx(
				"delete-item",
				callFx(
					"delete-item",
					() => window.arkini.editor.deleteItemFn(request),
					parseCommitFn,
				),
			),
		deleteResourceFx: (request) =>
			writeFx(
				"delete-resource",
				callFx(
					"delete-resource",
					() => window.arkini.editor.deleteResourceFn(request),
					parseProjectFn,
				),
			),
		diffVersionsFx: (request) =>
			callFx(
				"diff-versions",
				() => window.arkini.editor.diffVersionsFn(request),
				(value) => versionDiffSchema.parse(value),
			),
		listProjectsFx: callFx(
			"list-projects",
			() => window.arkini.editor.listProjectsFn(),
			(value) => ProjectCandidateSchema.array().parse(value),
		),
		listNotesFx: (projectId) =>
			callFx(
				"list-notes",
				() => window.arkini.editor.listNotesFn(projectId),
				(value) => {
					const notes = NoteSchema.array().parse(value);
					if (notes.some((note) => note.projectId !== projectId))
						throw new Error("Editor note stream identity does not match the request.");
					return notes;
				},
			),
		listVersionsFx: (projectId) =>
			callFx(
				"list-versions",
				() => window.arkini.editor.listVersionsFn(projectId),
				(value) => versionDescriptorSchema.array().parse(value),
			),
		previewVersionCommitFx: (projectId) =>
			callFx(
				"preview-version-commit",
				() => window.arkini.editor.previewVersionCommitFn(projectId),
				(value) => versionCommitPreviewSchema.parse(value),
			),
		listBoardScenariosFx: (projectId) =>
			callFx(
				"list-board-scenarios",
				() => window.arkini.editor.listBoardScenariosFn(projectId),
				(value) => BoardScenarioDescriptorSchema.array().parse(value),
			),
		readBoardScenarioFx: (request) =>
			callFx(
				"read-board-scenario",
				() => window.arkini.editor.readBoardScenarioFn(request),
				(value) => (value === null ? null : parseBoardScenarioFn(value)),
			),
		readProjectFx: (projectId) =>
			callFx(
				"read-project",
				() => window.arkini.editor.readProjectFn(projectId),
				(value) => (value === null ? null : parseProjectFn(value)),
			),
		readVersionStatusFx: (projectId) =>
			callFx(
				"read-version-status",
				() => window.arkini.editor.readVersionStatusFn(projectId),
				(value) => versionStatusSchema.parse(value),
			),
		replaceConfigFx: (request) =>
			writeFx(
				"replace-config",
				callFx(
					"replace-config",
					() => window.arkini.editor.replaceConfigFn(request),
					parseCommitFn,
				),
			),
		replaceResourceFx: (request) =>
			writeFx(
				"replace-resource",
				callFx(
					"replace-resource",
					() => window.arkini.editor.replaceResourceFn(request),
					parseProjectFn,
				),
			),
		saveResourceFx: (request) =>
			writeFx(
				"save-resource",
				callFx(
					"save-resource",
					() => window.arkini.editor.saveResourceFn(request),
					parseProjectFn,
				),
			),
		upsertItemFx: (request) =>
			writeFx(
				"upsert-item",
				callFx(
					"upsert-item",
					() => window.arkini.editor.upsertItemFn(request),
					parseCommitFn,
				),
			),
		upsertResourcesFx: (request) =>
			writeFx(
				"upsert-resource",
				callFx(
					"upsert-resource",
					() => window.arkini.editor.upsertResourcesFn(request),
					parseProjectFn,
				),
			),
		updateVersionTagFx: (request) =>
			writeFx(
				"update-version-tag",
				callFx(
					"update-version-tag",
					() => window.arkini.editor.updateVersionTagFn(request),
					(value) => versionDescriptorSchema.parse(value),
				),
			),
		updateNoteFx: (request) =>
			writeFx(
				"update-note",
				callFx(
					"update-note",
					() => window.arkini.editor.updateNoteFn(request),
					(value) => {
						const note = NoteSchema.parse(value);
						if (note.projectId !== request.projectId || note.noteId !== request.noteId)
							throw new Error("Editor note identity does not match the request.");
						return note;
					},
				),
			),
		writeBoardScenarioFx: (request) =>
			writeFx(
				"write-board-scenario",
				callFx(
					"write-board-scenario",
					() => window.arkini.editor.writeBoardScenarioFn(request),
					parseBoardScenarioFn,
				),
			),
		deleteBoardScenarioFx: (request) =>
			writeFx(
				"delete-board-scenario",
				callFx(
					"delete-board-scenario",
					() => window.arkini.editor.deleteBoardScenarioFn(request),
					() => undefined,
				),
			),
	} satisfies ProjectRepositoryService;
});
