import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { EditorProjectCandidateSchema } from "~/project-authoring/schema/EditorProjectCandidateSchema";
import type { EditorProjectRepositoryService } from "~/project-authoring/service/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/project-authoring/error/EditorProjectRepositoryError";
import {
	EditorBoardScenarioDescriptorSchema,
	EditorBoardScenarioSchema,
} from "~/board-scenario/schema/EditorBoardScenarioSchema";
import { admitEditorProjectWriteFx } from "~/project-authoring/service/EditorProjectWriteAdmission";
import {
	EditorProjectCommitPayloadSchema,
	EditorProjectPayloadSchema,
} from "~/project-authoring/schema/EditorProjectPayloadSchema";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { EditorNoteSchema } from "~/project-note/schema/EditorNoteSchema";
import { invokeEditorProjectTransportFx } from "~/project-authoring/fx/invokeEditorProjectTransportFx";

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

const parseBoardScenario = (candidate: unknown) => {
	const scenario = EditorBoardScenarioSchema.parse(candidate);
	return {
		...scenario,
		bytes: new Uint8Array(scenario.bytes),
	};
};

const parseCommit = (candidate: unknown) => EditorProjectCommitPayloadSchema.parse(candidate);
const parseProject = (candidate: unknown) => EditorProjectPayloadSchema.parse(candidate);

const callFx = <Value, Parsed>(
	operation: EditorProjectRepositoryOperation,
	call: () => Promise<EditorProjectTransport.Result<Value>>,
	parse: (value: Value) => Parsed,
) =>
	invokeEditorProjectTransportFx({
		call,
		operation,
		parse,
		requestMessage: "The editor IPC request failed.",
		responseMessage: "The editor IPC response is invalid.",
	});

const writeFx = <Value>(
	operation: EditorProjectRepositoryOperation,
	effect: Effect.Effect<Value, EditorProjectRepositoryError>,
) => admitEditorProjectWriteFx(operation, effect);

/** Creates an infallible renderer proxy; editor availability is queried separately. */
export const createElectronEditorProjectRepositoryFx = Effect.sync(
	(): EditorProjectRepositoryService => ({
		awaitIdleFx: callFx(
			"await-idle",
			() => window.arkini.editor.awaitIdle(),
			() => undefined,
		),
		createProjectFx: (request) =>
			writeFx(
				"create-project",
				callFx(
					"create-project",
					() => window.arkini.editor.createProject(request),
					parseProject,
				),
			),
		deleteProjectFx: (projectId) =>
			writeFx(
				"delete-project",
				callFx(
					"delete-project",
					() => window.arkini.editor.deleteProject(projectId),
					() => undefined,
				),
			),
		createNoteFx: (request) =>
			writeFx(
				"create-note",
				callFx(
					"create-note",
					() => window.arkini.editor.createNote(request),
					(value) => {
						const note = EditorNoteSchema.parse(value);
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
					() => window.arkini.editor.deleteNote(request),
					() => undefined,
				),
			),
		createVersionFx: (request) =>
			writeFx(
				"create-version",
				callFx(
					"create-version",
					() => window.arkini.editor.createVersion(request),
					(value) => versionDescriptorSchema.parse(value),
				),
			),
		checkoutVersionFx: (request) =>
			callFx(
				"checkout-version",
				() => window.arkini.editor.checkoutVersion(request),
				() => undefined,
			),
		deleteItemFx: (request) =>
			writeFx(
				"delete-item",
				callFx("delete-item", () => window.arkini.editor.deleteItem(request), parseCommit),
			),
		deleteResourceFx: (request) =>
			writeFx(
				"delete-resource",
				callFx(
					"delete-resource",
					() => window.arkini.editor.deleteResource(request),
					parseProject,
				),
			),
		diffVersionsFx: (request) =>
			callFx(
				"diff-versions",
				() => window.arkini.editor.diffVersions(request),
				(value) => versionDiffSchema.parse(value),
			),
		listProjectsFx: callFx(
			"list-projects",
			() => window.arkini.editor.listProjects(),
			(value) => EditorProjectCandidateSchema.array().parse(value),
		),
		listNotesFx: (projectId) =>
			callFx(
				"list-notes",
				() => window.arkini.editor.listNotes(projectId),
				(value) => {
					const notes = EditorNoteSchema.array().parse(value);
					if (notes.some((note) => note.projectId !== projectId))
						throw new Error("Editor note stream identity does not match the request.");
					return notes;
				},
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
			writeFx(
				"replace-config",
				callFx(
					"replace-config",
					() => window.arkini.editor.replaceConfig(request),
					parseCommit,
				),
			),
		replaceResourceFx: (request) =>
			writeFx(
				"replace-resource",
				callFx(
					"replace-resource",
					() => window.arkini.editor.replaceResource(request),
					parseProject,
				),
			),
		saveResourceFx: (request) =>
			writeFx(
				"save-resource",
				callFx(
					"save-resource",
					() => window.arkini.editor.saveResource(request),
					parseProject,
				),
			),
		upsertItemFx: (request) =>
			writeFx(
				"upsert-item",
				callFx("upsert-item", () => window.arkini.editor.upsertItem(request), parseCommit),
			),
		upsertResourcesFx: (request) =>
			writeFx(
				"upsert-resource",
				callFx(
					"upsert-resource",
					() => window.arkini.editor.upsertResources(request),
					parseProject,
				),
			),
		updateVersionTagFx: (request) =>
			writeFx(
				"update-version-tag",
				callFx(
					"update-version-tag",
					() => window.arkini.editor.updateVersionTag(request),
					(value) => versionDescriptorSchema.parse(value),
				),
			),
		updateNoteFx: (request) =>
			writeFx(
				"update-note",
				callFx(
					"update-note",
					() => window.arkini.editor.updateNote(request),
					(value) => {
						const note = EditorNoteSchema.parse(value);
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
					() => window.arkini.editor.writeBoardScenario(request),
					parseBoardScenario,
				),
			),
		deleteBoardScenarioFx: (request) =>
			writeFx(
				"delete-board-scenario",
				callFx(
					"delete-board-scenario",
					() => window.arkini.editor.deleteBoardScenario(request),
					() => undefined,
				),
			),
	}),
);
