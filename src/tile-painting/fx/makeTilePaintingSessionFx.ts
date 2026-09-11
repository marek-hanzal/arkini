import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import { changeTilePaintingHistoryFn } from "~/tile-painting/fn/changeTilePaintingHistoryFn";
import { createTilePaintingImageFx } from "~/tile-painting/fx/createTilePaintingImageFx";
import { prepareTilePaintingBakeFx } from "~/tile-painting/fx/prepareTilePaintingBakeFx";
import { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import type { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";

export namespace makeTilePaintingSessionFx {
	export interface Brush {
		readonly size: number;
		readonly opacity: number;
		readonly hardness: number;
		readonly shape: "circle" | "square" | "image";
		readonly brushImageId: string | null;
	}
	export interface View {
		readonly zoom: number;
		readonly panX: number;
		readonly panY: number;
	}
	export interface UiSnapshot {
		readonly paintingId: string;
		readonly document: TilePaintingDocumentSchema.Type;
		readonly dirty: boolean;
		readonly busy: boolean;
		readonly error: string | null;
		readonly canUndo: boolean;
		readonly canRedo: boolean;
		readonly outputResourceId: string | null;
		readonly activeLayerId: string | null;
		readonly paintAllLayers: boolean;
		readonly tool: "reveal" | "hide" | "smooth" | "scatter";
		readonly brush: Brush;
		readonly scatterSpacing: number;
		readonly previewOpacity: number;
		readonly referenceOnly: boolean;
	}
	export interface Snapshot extends UiSnapshot {
		readonly view: View;
	}
	export interface Output {
		readonly readFn: () => Snapshot;
		readonly readSessionFn: () => UiSnapshot;
		readonly subscribeFn: (listenerFn: () => void) => () => void;
		readonly editFx: (document: TilePaintingDocumentSchema.Type) => Effect.Effect<void>;
		readonly undoFx: Effect.Effect<void>;
		readonly redoFx: Effect.Effect<void>;
		readonly discardFx: Effect.Effect<void>;
		readonly saveFx: (
			outputResourceId?: string,
		) => Effect.Effect<boolean, never, ProjectRepository | AtomRegistry.AtomRegistry>;
		readonly addImageFx: (
			source: ResourceSchema.Type,
			applyFn: (
				document: TilePaintingDocumentSchema.Type,
				imageId: string,
			) => TilePaintingDocumentSchema.Type,
		) => Effect.Effect<boolean>;
		readonly setViewFx: (view: View) => Effect.Effect<void>;
		readonly setActiveLayerIdFx: (id: string | null) => Effect.Effect<void>;
		readonly setPaintAllLayersFx: (all: boolean) => Effect.Effect<void>;
		readonly setToolFx: (tool: UiSnapshot["tool"]) => Effect.Effect<void>;
		readonly setBrushFx: (brush: Brush) => Effect.Effect<void>;
		readonly setScatterSpacingFx: (spacing: number) => Effect.Effect<void>;
		readonly setPreviewOpacityFx: (opacity: number) => Effect.Effect<void>;
		readonly setReferenceOnlyFx: (only: boolean) => Effect.Effect<void>;
		readonly setErrorFx: (message: string | null) => Effect.Effect<void>;
		readonly activateFx: Effect.Effect<void>;
		readonly closeFx: Effect.Effect<void>;
	}
}

/** Owns the synchronous painting transaction boundary; React only subscribes to its projections. */
export const makeTilePaintingSessionFx = Effect.fn("makeTilePaintingSessionFx")(function* ({
	loaded,
	project,
}: {
	readonly loaded: TilePaintingSchema.Type;
	readonly project: Project;
}): Effect.fn.Return<makeTilePaintingSessionFx.Output> {
	let history: changeTilePaintingHistoryFn.History = {
		past: [],
		present: loaded.document,
		future: [],
	};
	let saved = loaded;
	let selectedLayerId: string | null = loaded.document.layers.at(-1)?.id ?? null;
	let active = true;
	let epoch = 0;
	let storedBrush: makeTilePaintingSessionFx.Brush = {
		size: 80,
		opacity: 1,
		hardness: 0.65,
		shape: "circle",
		brushImageId: null,
	};
	const listeners = new Set<() => void>();
	let ui: makeTilePaintingSessionFx.UiSnapshot = {
		paintingId: loaded.paintingId,
		document: loaded.document,
		dirty: false,
		busy: false,
		error: null,
		canUndo: false,
		canRedo: false,
		outputResourceId: loaded.outputResourceId,
		activeLayerId: loaded.document.layers.at(-1)?.id ?? null,
		paintAllLayers: false,
		tool: "reveal",
		brush: storedBrush,
		scatterSpacing: 40,
		previewOpacity: 1,
		referenceOnly: false,
	};
	let snapshot: makeTilePaintingSessionFx.Snapshot = {
		...ui,
		view: {
			zoom: 1,
			panX: 0,
			panY: 0,
		},
	};
	const publishFx = (patch: Partial<makeTilePaintingSessionFx.UiSnapshot> = {}) =>
		Effect.sync(() => {
			ui = {
				...ui,
				...patch,
				activeLayerId: history.present.layers.some((layer) => layer.id === selectedLayerId)
					? selectedLayerId
					: (history.present.layers.at(-1)?.id ?? null),
				document: history.present,
				dirty: history.present !== saved.document,
				canUndo: history.past.length > 0,
				canRedo: history.future.length > 0,
				outputResourceId: saved.outputResourceId,
				brush:
					storedBrush.brushImageId !== null &&
					!history.present.images.some((image) => image.id === storedBrush.brushImageId)
						? {
								...storedBrush,
								brushImageId: null,
							}
						: storedBrush,
			};
			snapshot = {
				...ui,
				view: snapshot.view,
			};
			for (const listenerFn of listeners) listenerFn();
		});
	const changeHistoryFx = (action: changeTilePaintingHistoryFn.Action) =>
		Effect.gen(function* () {
			if (!active || ui.busy) return;
			const next = changeTilePaintingHistoryFn(history, action);
			if (next === history) return;
			history = next;
			yield* publishFx();
		});
	const settingsFx = (patch: Partial<makeTilePaintingSessionFx.UiSnapshot>) =>
		Effect.gen(function* () {
			if (active) yield* publishFx(patch);
		});
	const finishFx = (started: number) =>
		Effect.gen(function* () {
			if (active && epoch === started)
				yield* publishFx({
					busy: false,
				});
		});
	const errorFx = (cause: Cause.Cause<unknown>, started: number) =>
		Effect.gen(function* () {
			if (active && epoch === started) {
				const error = Cause.squash(cause);
				yield* publishFx({
					error: error instanceof Error ? error.message : String(error),
				});
			}
			return false;
		});
	return {
		readFn: () => snapshot,
		readSessionFn: () => ui,
		subscribeFn: (listenerFn) => {
			listeners.add(listenerFn);
			return () => {
				listeners.delete(listenerFn);
			};
		},
		editFx: (document) =>
			changeHistoryFx({
				type: "edit",
				document,
			}),
		undoFx: changeHistoryFx({
			type: "undo",
		}),
		redoFx: changeHistoryFx({
			type: "redo",
		}),
		discardFx: Effect.gen(function* () {
			if (!active || ui.busy) return;
			history = {
				past: [],
				present: saved.document,
				future: [],
			};
			yield* publishFx();
		}),
		setViewFx: (view) =>
			Effect.sync(() => {
				if (
					!active ||
					(snapshot.view.zoom === view.zoom &&
						snapshot.view.panX === view.panX &&
						snapshot.view.panY === view.panY)
				)
					return;
				snapshot = {
					...snapshot,
					view,
				};
				for (const listenerFn of listeners) listenerFn();
			}),
		setActiveLayerIdFx: (activeLayerId) =>
			Effect.gen(function* () {
				if (!active) return;
				selectedLayerId = activeLayerId;
				yield* publishFx();
			}),
		setPaintAllLayersFx: (paintAllLayers) =>
			settingsFx({
				paintAllLayers,
			}),
		setToolFx: (tool) =>
			settingsFx({
				tool,
			}),
		setBrushFx: (brush) =>
			Effect.gen(function* () {
				if (!active) return;
				storedBrush = brush;
				yield* publishFx();
			}),
		setScatterSpacingFx: (scatterSpacing) =>
			settingsFx({
				scatterSpacing,
			}),
		setPreviewOpacityFx: (previewOpacity) =>
			settingsFx({
				previewOpacity,
			}),
		setReferenceOnlyFx: (referenceOnly) =>
			settingsFx({
				referenceOnly,
			}),
		setErrorFx: (error) =>
			settingsFx({
				error,
			}),
		activateFx: Effect.sync(() => {
			active = true;
		}),
		// Closing invalidates local delivery, while an admitted filesystem commit may still
		// complete and publish its canonical project snapshot to other mounted surfaces.
		closeFx: Effect.gen(function* () {
			active = false;
			epoch += 1;
			yield* publishFx({
				busy: false,
			});
		}),
		saveFx: (outputResourceId) =>
			Effect.gen(function* () {
				if (!active || ui.busy) return false;
				const parsed = TilePaintingDocumentSchema.safeParse(history.present);
				if (!parsed.success) {
					yield* publishFx({
						error: parsed.error.issues[0]?.message ?? "Invalid painting.",
					});
					return false;
				}
				const started = epoch;
				const startingHistory = history;
				const startingSaved = saved;
				yield* publishFx({
					busy: true,
					error: null,
				});
				return yield* Effect.gen(function* () {
					const result = yield* Effect.exit(
						Effect.gen(function* () {
							const currentProject =
								(yield* Atom.get(EditorProjectAtom(loaded.projectId))) ?? project;
							const repository = yield* ProjectRepository;
							const prepared =
								outputResourceId === undefined
									? {
											document: startingHistory.present,
											bakedPng: undefined,
										}
									: yield* prepareTilePaintingBakeFx({
											document: startingHistory.present,
											resources: currentProject.resources,
											outputResourceId,
										});
							const committed = yield* repository.saveTilePaintingFx({
								projectId: loaded.projectId,
								paintingId: loaded.paintingId,
								expectedRevision: currentProject.revision,
								expectedUpdatedAtMs: startingSaved.updatedAtMs,
								document: prepared.document,
								...(outputResourceId === undefined
									? {}
									: {
											outputResourceId,
											bakedPng: prepared.bakedPng,
										}),
							});
							yield* publishEditorProjectFx(loaded.projectId, {
								project: committed.project,
							});
							return {
								...committed,
								savedDocument: prepared.document,
							};
						}),
					);
					if (Exit.isFailure(result)) return yield* errorFx(result.cause, started);
					if (!active || epoch !== started) return false;
					saved = {
						...result.value.painting,
						document: result.value.savedDocument,
					};
					history = changeTilePaintingHistoryFn(startingHistory, {
						type: "edit",
						document: result.value.savedDocument,
					});
					yield* publishFx();
					return true;
				}).pipe(Effect.ensuring(finishFx(started)));
			}),
		addImageFx: (source, applyFn) =>
			Effect.gen(function* () {
				if (!active || ui.busy) return false;
				const started = epoch;
				yield* publishFx({
					busy: true,
					error: null,
				});
				return yield* Effect.gen(function* () {
					const result = yield* Effect.exit(
						Effect.gen(function* () {
							const image = yield* createTilePaintingImageFx(source);
							if (!active || epoch !== started) return false;
							const current = history.present;
							const existing = current.images.find(
								(candidate) =>
									candidate.sourceResourceId === image.sourceResourceId &&
									candidate.png === image.png,
							);
							const next = yield* Effect.sync(() =>
								applyFn(
									existing === undefined
										? {
												...current,
												images: [
													...current.images,
													image,
												],
											}
										: current,
									existing?.id ?? image.id,
								),
							);
							const parsed = TilePaintingDocumentSchema.safeParse(next);
							if (!parsed.success)
								return yield* Effect.fail(
									new Error(
										parsed.error.issues[0]?.message ?? "Invalid painting.",
									),
								);
							history = changeTilePaintingHistoryFn(history, {
								type: "edit",
								document: next,
							});
							yield* publishFx();
							return true;
						}),
					);
					return Exit.isFailure(result)
						? yield* errorFx(result.cause, started)
						: result.value;
				}).pipe(Effect.ensuring(finishFx(started)));
			}),
	};
});
