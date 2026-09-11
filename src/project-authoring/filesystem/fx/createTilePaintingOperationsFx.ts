import { readTilePaintingReferencedImageIdsFn } from "~/tile-painting/fn/readTilePaintingReferencedImageIdsFn";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import type { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { readTilePaintingPngSupportFn } from "~/tile-painting/fn/readTilePaintingPngSupportFn";
import { TilePaintingCanvasSize } from "~/tile-painting/constant/TilePaintingCanvasSize";
import { TilePaintingFileSchema } from "~/tile-painting/schema/TilePaintingFileSchema";
import { validateTilePaintingDocumentFx } from "./validateTilePaintingDocumentFx";
import { cloneProjectFn } from "~/project-authoring/fn/cloneProjectFn";
import { Clock, Effect, FileSystem, type Semaphore } from "effect";
import sharp from "sharp";
import { z } from "zod";
import type { ProjectState } from "../ProjectState";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";
import { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { writeProjectFileSetFx } from "./writeProjectFileSetFx";

const encoder = new TextEncoder();
const encodeJsonFn = (value: unknown) => encoder.encode(`${JSON.stringify(value)}\n`);
const pngSchema = z
	.string()
	.max(24 * 1024 * 1024)
	.regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
const keySchema = z
	.object({
		projectId: IdSchema,
		paintingId: IdSchema,
	})
	.strict();
const deleteSchema = keySchema
	.extend({
		expectedRevision: z.number().int().nonnegative(),
		expectedUpdatedAtMs: z.number().int().nonnegative(),
	})
	.strict();
const saveSchema = deleteSchema
	.extend({
		expectedUpdatedAtMs: z.number().int().nonnegative().nullable(),
		document: TilePaintingDocumentSchema,
		bakedPng: pngSchema.optional(),
		outputResourceId: IdSchema.optional(),
	})
	.strict();
const batchSchema = z
	.object({
		projectId: IdSchema,
		expectedRevision: z.number().int().nonnegative(),
		paintings: z
			.array(
				z
					.object({
						paintingId: IdSchema,
						expectedUpdatedAtMs: z.number().int().nonnegative(),
						document: TilePaintingDocumentSchema,
						bakedPng: pngSchema,
					})
					.strict(),
			)
			.min(1)
			.max(256),
	})
	.strict();
type Operations = Pick<
	ProjectRepositoryService,
	| "listTilePaintingsFx"
	| "readTilePaintingFx"
	| "saveTilePaintingFx"
	| "deleteTilePaintingFx"
	| "bakeTilePaintingsFx"
>;
interface PreparedPainting {
	readonly painting: TilePaintingSchema.Type;
	readonly output: ResourceSchema.Type | null;
}
const errorFn = (operation: ProjectRepositoryOperation, cause: unknown) =>
	cause instanceof ProjectRepositoryError && cause.operation === operation
		? cause
		: new ProjectRepositoryError({
				operation,
				message: cause instanceof Error ? cause.message : "Painting operation failed.",
				cause,
			});

/** Recipe saves and complete source rebuilds publish through one canonical current-tree transaction. */
export const createTilePaintingOperationsFx = Effect.fn("createTilePaintingOperationsFx")(
	function* ({
		filesystemWrite,
		operations,
		readStateFx,
		states,
	}: {
		readonly filesystemWrite: FilesystemWrite;
		readonly operations: Semaphore.Semaphore;
		readonly readStateFx: (
			projectId: string,
		) => Effect.Effect<ProjectState, ProjectRepositoryError>;
		readonly states: Map<string, ProjectState>;
	}) {
		const fs = yield* FileSystem.FileSystem;
		const preparePaintingFx = Effect.fn("prepareTilePaintingFx")(function* (
			state: ProjectState,
			request: ProjectRepository.SaveTilePaintingProps,
			nowMs: number,
		) {
			const previous = state.tilePaintings.find(
				(painting) => painting.paintingId === request.paintingId,
			);
			if ((previous?.updatedAtMs ?? null) !== request.expectedUpdatedAtMs)
				return yield* Effect.fail(new Error("Painting changed after it was read."));
			if (previous === undefined && state.tilePaintings.length >= 256)
				return yield* Effect.fail(new Error("A project supports at most 256 paintings."));
			yield* validateTilePaintingDocumentFx(request.document);
			const outputResourceId = request.outputResourceId ?? previous?.outputResourceId ?? null;
			if (request.bakedPng !== undefined && outputResourceId === null)
				return yield* Effect.fail(
					new Error("Choose an asset ID before baking a painting."),
				);
			if (request.outputResourceId !== undefined && request.bakedPng === undefined)
				return yield* Effect.fail(
					new Error("An output asset ID can only change together with a bake."),
				);
			const painting = TilePaintingSchema.parse({
				projectId: request.projectId,
				paintingId: request.paintingId,
				updatedAtMs: Math.max(nowMs, (previous?.updatedAtMs ?? 0) + 1),
				outputResourceId,
				document: request.document,
			});
			const target = yield* state.paths.tilePaintingFileFx(request.paintingId);
			if (previous === undefined && (yield* fs.exists(target)))
				return yield* Effect.fail(
					new Error("Painting file already exists. Refresh before creating it."),
				);
			let output: ResourceSchema.Type | null = null;
			if (request.bakedPng !== undefined && outputResourceId !== null) {
				const outputPath = yield* state.paths.assetFileFx(outputResourceId);
				if (
					state.tilePaintings.some(
						(value) =>
							value.paintingId !== painting.paintingId &&
							value.outputResourceId === outputResourceId,
					)
				)
					return yield* Effect.fail(
						new Error(`Asset ${outputResourceId} belongs to another painting.`),
					);
				const existing = state.project.resources.find(
					(resource) => resource.id === outputResourceId,
				);
				if (
					(existing !== undefined || (yield* fs.exists(outputPath))) &&
					previous?.outputResourceId !== outputResourceId
				)
					return yield* Effect.fail(
						new Error(
							`Asset ${outputResourceId} already exists and is not this painting's output.`,
						),
					);
				if (Object.values(state.project.config.resources).includes(outputResourceId))
					return yield* Effect.fail(
						new Error("A painting cannot replace a package-shell resource."),
					);
				const bytes = new Uint8Array(
					Buffer.from(request.bakedPng.slice("data:image/png;base64,".length), "base64"),
				);
				if (!readTilePaintingPngSupportFn(bytes))
					return yield* Effect.fail(
						new Error("Baked painting output must be a supported single-frame PNG."),
					);
				yield* Effect.tryPromise({
					try: async () => {
						const decoder = sharp(bytes, {
							limitInputPixels: 2048 * 2048,
						});
						const metadata = await decoder.metadata();
						if (
							metadata.format !== "png" ||
							metadata.width !== TilePaintingCanvasSize ||
							metadata.height !== TilePaintingCanvasSize
						)
							throw new Error("Baked PNG dimensions do not match the painting.");
						await decoder.raw().toBuffer();
					},
					catch: (cause) =>
						new Error("Baked painting PNG is invalid.", {
							cause,
						}),
				});
				output = {
					id: outputResourceId,
					mime: "image/png",
					bytes,
				};
			}
			return {
				painting,
				output,
			} satisfies PreparedPainting;
		});
		const commitPaintingsFx = Effect.fn("commitTilePaintingsFx")(function* (
			state: ProjectState,
			prepared: ReadonlyArray<PreparedPainting>,
			nowMs: number,
		) {
			const outputs = prepared.flatMap((value) =>
				value.output === null
					? []
					: [
							value.output,
						],
			);
			if (new Set(outputs.map((output) => output.id)).size !== outputs.length)
				return yield* Effect.fail(
					new Error("Painting outputs must have unique resource IDs."),
				);
			const effectiveResources = new Map(
				state.project.resources.map((resource) => [
					resource.id,
					resource,
				]),
			);
			for (const output of outputs) effectiveResources.set(output.id, output);
			// A batch may include upstream outputs. Every baked snapshot must use the final exact source bytes.
			for (const entry of prepared) {
				if (entry.output === null) continue;
				const referenced = readTilePaintingReferencedImageIdsFn(entry.painting.document);
				for (const image of entry.painting.document.images) {
					if (!referenced.has(image.id)) continue;
					const source = effectiveResources.get(image.sourceResourceId);
					if (source === undefined)
						return yield* Effect.fail(
							new Error(
								`Painting source ${image.sourceResourceId} is missing from the project.`,
							),
						);
					const snapshot = Buffer.from(
						image.png.slice("data:image/png;base64,".length),
						"base64",
					);
					if (!snapshot.equals(Buffer.from(source.bytes)))
						return yield* Effect.fail(
							new Error(
								`Painting source ${image.sourceResourceId} changed. Refresh its snapshot before baking.`,
							),
						);
				}
			}
			const writes: Array<{
				target: string;
				bytes: Uint8Array;
			}> = [];
			for (const entry of prepared) {
				const { projectId: _projectId, paintingId, ...file } = entry.painting;
				writes.push({
					target: yield* state.paths.tilePaintingFileFx(paintingId),
					bytes: encodeJsonFn(TilePaintingFileSchema.parse(file)),
				});
				if (entry.output !== null)
					writes.push({
						target: yield* state.paths.assetFileFx(entry.output.id),
						bytes: entry.output.bytes,
					});
			}
			let project = state.project;
			if (outputs.length > 0) {
				const revision = Math.max(nowMs, state.project.revision + 1);
				project = {
					...state.project,
					revision,
					updatedAtMs: revision,
					resources: [
						...effectiveResources.values(),
					].sort((left, right) => left.id.localeCompare(right.id)),
				};
				writes.push({
					target: state.paths.projectFile,
					bytes: encodeJsonFn(
						GameProjectManifestSchema.parse({
							arkini: ArkiniAppVersion,
							revision,
						}),
					),
				});
			}
			yield* writeProjectFileSetFx({
				filesystemWrite,
				root: state.paths.root,
				planFx: Effect.succeed({
					writes,
				}),
			});
			const changedIds = new Set(prepared.map((entry) => entry.painting.paintingId));
			states.set(project.projectId, {
				...state,
				project,
				tilePaintings: [
					...state.tilePaintings.filter(
						(painting) => !changedIds.has(painting.paintingId),
					),
					...prepared.map((entry) => entry.painting),
				],
			});
			return {
				project: cloneProjectFn(project),
				paintings: prepared.map((entry) => TilePaintingSchema.parse(entry.painting)),
			};
		});
		const listTilePaintingsFx: Operations["listTilePaintingsFx"] = (projectId) =>
			operations.withPermits(1)(
				readStateFx(projectId).pipe(
					Effect.map((state) =>
						state.tilePaintings.map((painting) => TilePaintingSchema.parse(painting)),
					),
					Effect.mapError((cause) => errorFn("list-tile-paintings", cause)),
				),
			);
		const readTilePaintingFx: Operations["readTilePaintingFx"] = (key) =>
			operations.withPermits(1)(
				readStateFx(key.projectId).pipe(
					Effect.map((state) => {
						const painting = state.tilePaintings.find(
							(value) => value.paintingId === key.paintingId,
						);
						return painting === undefined ? null : TilePaintingSchema.parse(painting);
					}),
					Effect.mapError((cause) => errorFn("read-tile-painting", cause)),
				),
			);
		const saveTilePaintingFx: Operations["saveTilePaintingFx"] = (candidate) =>
			operations
				.withPermits(1)(
					Effect.gen(function* () {
						const request = yield* Effect.try({
							try: () => saveSchema.parse(candidate),
							catch: (cause) =>
								new Error("Painting save request is invalid.", {
									cause,
								}),
						});
						const state = yield* readStateFx(request.projectId);
						if (state.project.revision !== request.expectedRevision)
							return yield* Effect.fail(
								new Error(
									"Project changed before the painting could be saved. Refresh and try again.",
								),
							);
						const nowMs = yield* Clock.currentTimeMillis;
						const prepared = yield* preparePaintingFx(state, request, nowMs);
						const result = yield* commitPaintingsFx(
							state,
							[
								prepared,
							],
							nowMs,
						);
						return {
							project: result.project,
							painting: result.paintings[0],
						};
					}),
				)
				.pipe(Effect.mapError((cause) => errorFn("save-tile-painting", cause)));
		const bakeTilePaintingsFx: Operations["bakeTilePaintingsFx"] = (candidate) =>
			operations
				.withPermits(1)(
					Effect.gen(function* () {
						const request = yield* Effect.try({
							try: () => batchSchema.parse(candidate),
							catch: (cause) =>
								new Error("Painting batch request is invalid.", {
									cause,
								}),
						});
						const state = yield* readStateFx(request.projectId);
						if (state.project.revision !== request.expectedRevision)
							return yield* Effect.fail(
								new Error(
									"Project changed before the painting batch could commit.",
								),
							);
						if (
							new Set(request.paintings.map((painting) => painting.paintingId))
								.size !== request.paintings.length
						)
							return yield* Effect.fail(
								new Error("A painting can appear only once in a batch."),
							);
						for (const painting of request.paintings) {
							const previous = state.tilePaintings.find(
								(value) => value.paintingId === painting.paintingId,
							);
							if (
								previous === undefined ||
								previous.updatedAtMs !== painting.expectedUpdatedAtMs
							)
								return yield* Effect.fail(
									new Error("Painting changed after it was read."),
								);
							if (previous.outputResourceId === null)
								return yield* Effect.fail(
									new Error(
										"A batch can only rebuild paintings with a saved output asset.",
									),
								);
						}
						const nowMs = yield* Clock.currentTimeMillis;
						const prepared = yield* Effect.forEach(request.paintings, (painting) =>
							preparePaintingFx(
								state,
								{
									...painting,
									projectId: request.projectId,
									expectedRevision: request.expectedRevision,
								},
								nowMs,
							),
						);
						return yield* commitPaintingsFx(state, prepared, nowMs);
					}),
				)
				.pipe(Effect.mapError((cause) => errorFn("bake-tile-paintings", cause)));
		const deleteTilePaintingFx: Operations["deleteTilePaintingFx"] = (candidate) =>
			operations
				.withPermits(1)(
					Effect.gen(function* () {
						const request = yield* Effect.try({
							try: () => deleteSchema.parse(candidate),
							catch: (cause) =>
								new Error("Painting delete request is invalid.", {
									cause,
								}),
						});
						const state = yield* readStateFx(request.projectId);
						const previous = state.tilePaintings.find(
							(painting) => painting.paintingId === request.paintingId,
						);
						if (
							state.project.revision !== request.expectedRevision ||
							previous?.updatedAtMs !== request.expectedUpdatedAtMs
						)
							return yield* Effect.fail(
								new Error("Project or painting changed before deletion."),
							);
						const target = yield* state.paths.tilePaintingFileFx(request.paintingId);
						if (!(yield* fs.exists(target)))
							return yield* Effect.fail(
								new Error("Painting file is missing. Refresh before deleting it."),
							);
						yield* writeProjectFileSetFx({
							filesystemWrite,
							root: state.paths.root,
							planFx: Effect.succeed({
								writes: [],
								deletes: [
									target,
								],
							}),
						});
						states.set(request.projectId, {
							...state,
							tilePaintings: state.tilePaintings.filter(
								(painting) => painting.paintingId !== request.paintingId,
							),
						});
					}),
				)
				.pipe(Effect.mapError((cause) => errorFn("delete-tile-painting", cause)));
		return {
			listTilePaintingsFx,
			readTilePaintingFx,
			saveTilePaintingFx,
			bakeTilePaintingsFx,
			deleteTilePaintingFx,
		} satisfies Operations;
	},
);
