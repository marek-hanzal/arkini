import { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";
import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { ProjectCandidateSchema } from "~/project-authoring/schema/ProjectCandidateSchema";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import {
	ProjectCommitPayloadSchema,
	ProjectPayloadSchema,
} from "~/project-authoring/schema/ProjectPayloadSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NoteSchema } from "~/project-note/schema/NoteSchema";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";

const parseCommitFn = (candidate: unknown) => ProjectCommitPayloadSchema.parse(candidate);
const parseProjectFn = (candidate: unknown) => ProjectPayloadSchema.parse(candidate);
const optimizeResourcesResultSchema = z
	.object({
		optimizedResourceCount: z.number().int().nonnegative(),
		originalBytes: z.number().int().nonnegative(),
		optimizedBytes: z.number().int().nonnegative(),
		processedResourceCount: z.number().int().nonnegative(),
		project: ProjectPayloadSchema,
	})
	.strict();
const optimizeResourcesProgressSchema = z
	.object({
		completedResourceCount: z.number().int().nonnegative(),
		expectedRevision: z.number().int().nonnegative(),
		phase: z.enum([
			"optimizing",
			"saving",
		]),
		projectId: IdSchema,
		totalResourceCount: z.number().int().nonnegative(),
	})
	.strict();

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
		listProjectsFx: callFx(
			"list-projects",
			() => window.arkini.editor.listProjectsFn(),
			(value) => ProjectCandidateSchema.array().parse(value),
		),
		optimizeResourcesFx: ({ onProgressFn, ...request }) =>
			writeFx(
				"optimize-resources",
				Effect.acquireUseRelease(
					Effect.sync(() =>
						onProgressFn === undefined
							? undefined
							: window.arkini.editor.onOptimizeResourcesProgressFn((progress) => {
									const parsed =
										optimizeResourcesProgressSchema.safeParse(progress);
									if (!parsed.success) return;
									if (
										parsed.data.projectId === request.projectId &&
										parsed.data.expectedRevision === request.expectedRevision
									)
										onProgressFn({
											completedResourceCount:
												parsed.data.completedResourceCount,
											phase: parsed.data.phase,
											totalResourceCount: parsed.data.totalResourceCount,
										});
								}),
					),
					() =>
						callFx(
							"optimize-resources",
							() => window.arkini.editor.optimizeResourcesFn(request),
							(value) => optimizeResourcesResultSchema.parse(value),
						),
					(unsubscribeFn) => Effect.sync(() => unsubscribeFn?.()),
				),
			),
		bakeTilePaintingsFx: (request) =>
			writeFx(
				"bake-tile-paintings",
				callFx(
					"bake-tile-paintings",
					() => window.arkini.editor.bakeTilePaintingsFn(request),
					(value) => {
						const result = z
							.object({
								project: ProjectPayloadSchema,
								paintings: TilePaintingSchema.array(),
							})
							.strict()
							.parse(value);
						const ids = new Set(
							request.paintings.map((painting) => painting.paintingId),
						);
						if (
							result.project.projectId !== request.projectId ||
							result.paintings.length !== ids.size ||
							new Set(result.paintings.map((painting) => painting.paintingId))
								.size !== ids.size ||
							result.paintings.some(
								(painting) =>
									painting.projectId !== request.projectId ||
									!ids.has(painting.paintingId),
							)
						)
							throw new Error("Baked painting batch identity does not match.");
						return result;
					},
				),
			),
		listTilePaintingsFx: (projectId) =>
			callFx(
				"list-tile-paintings",
				() => window.arkini.editor.listTilePaintingsFn(projectId),
				(value) => {
					const paintings = TilePaintingSchema.array().parse(value);
					if (paintings.some((painting) => painting.projectId !== projectId))
						throw new Error("Painting project identity does not match.");
					return paintings;
				},
			),
		readTilePaintingFx: (request) =>
			callFx(
				"read-tile-painting",
				() => window.arkini.editor.readTilePaintingFn(request),
				(value) => {
					const painting = TilePaintingSchema.nullable().parse(value);
					if (
						painting !== null &&
						(painting.projectId !== request.projectId ||
							painting.paintingId !== request.paintingId)
					)
						throw new Error("Painting identity does not match.");
					return painting;
				},
			),
		saveTilePaintingFx: (request) =>
			writeFx(
				"save-tile-painting",
				callFx(
					"save-tile-painting",
					() => window.arkini.editor.saveTilePaintingFn(request),
					(value) => {
						const result = z
							.object({
								painting: TilePaintingSchema,
								project: ProjectPayloadSchema,
							})
							.strict()
							.parse(value);
						if (
							result.painting.projectId !== request.projectId ||
							result.painting.paintingId !== request.paintingId ||
							result.project.projectId !== request.projectId
						)
							throw new Error("Saved painting identity does not match.");
						return result;
					},
				),
			),
		deleteTilePaintingFx: (request) =>
			writeFx(
				"delete-tile-painting",
				callFx(
					"delete-tile-painting",
					() => window.arkini.editor.deleteTilePaintingFn(request),
					() => undefined,
				),
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
		readProjectFx: (projectId) =>
			callFx(
				"read-project",
				() => window.arkini.editor.readProjectFn(projectId),
				(value) => (value === null ? null : parseProjectFn(value)),
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
	} satisfies ProjectRepositoryService;
});
