import { Effect } from "effect";
import type { FederatedPointerEvent } from "pixi.js";
import { match } from "ts-pattern";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { removeCheatItemFx as removeEngineCheatItemFx } from "~/engine/cheat/write/removeCheatItemFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { PointerDragThreshold } from "~/ui/drag/PointerDragThreshold";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readActorCursorFn } from "~/ui/pixi/actor/fn/readActorCursorFn";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { burstFeedbackParticlesFx } from "~/ui/pixi/animation/burstFeedbackParticlesFx";
import type { CursorGrabMotion } from "~/tile-interaction/fx/createCursorGrabMotionFx";
import { readPointerOffsetFn } from "~/tile-interaction/fn/readPointerOffsetFn";
import { readTileDropPreviewFx } from "~/tile-interaction/fx/readTileDropPreviewFx";
import { setDraggedActorPoseFx } from "~/tile-interaction/fx/setDraggedActorPoseFx";
import { settleDraggedActorFx } from "~/tile-interaction/fx/settleDraggedActorFx";
import type { DropSubmission } from "~/tile-interaction/fx/createDropSubmissionFx";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import type { MotionRuntime } from "~/tile-motion/service/MotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import { isSameTileActorLocationFn } from "~/ui/pixi/actor/fn/isSameTileActorLocationFn";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { MainActivationIntent } from "~/tile-interaction/type/MainActivationIntent";

export interface MainDragController {
	readonly attachActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly cancelInteractionFx: Effect.Effect<void>;
	readonly detachActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	/** Coalesces canonical/layout invalidation onto the current drag frame slot. */
	readonly requestRefreshFx: Effect.Effect<void>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}

interface Props {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly application: PixiApplicationOwner;
	readonly cursorGrab: CursorGrabMotion;
	readonly dropSubmission: DropSubmission;
	readonly game: GameEngine;
	readonly magneticField: MagneticField;
	readonly motion: MotionRuntime;
	readonly onActivate: (
		item: TileActorItem,
		intent: MainActivationIntent,
		origin: HTMLElement,
	) => void | PromiseLike<void>;
	readonly readAckTint: () => number;
	readonly surface: MainInteractionSurface;
}

type MainInteractionTargetFacts = Effect.Success<
	ReturnType<MainInteractionSurface["readTargetFactsFx"]>
>;
type MainInteractionDropTarget = NonNullable<MainInteractionTargetFacts["target"]>;

interface ActiveDragBase {
	readonly actor: PixiTileActor;
	readonly activationIntent: MainActivationIntent;
	readonly pointerId: number;
	readonly pressX: number;
	readonly pressY: number;
	readonly sourceItem: TileActorItem;
	readonly startX: number;
	readonly startY: number;
	attractionEligibilityByActorId: Map<
		string,
		{
			readonly eligible: boolean;
			readonly source: Pick<TileActorItem, "id" | "location" | "revision">;
			readonly target: Pick<TileActorItem, "id" | "location" | "revision">;
		}
	>;
	eligibleAttractionActorIds: ReadonlySet<string>;
	lastPointerX: number;
	lastPointerY: number;
	previewKind: readTileDropPreviewFx.Result["kind"] | null;
	previewSource: Pick<TileActorItem, "id" | "location" | "revision"> | null;
	target: MainInteractionDropTarget | null;
	targetKey: string;
	targetItem: TileActorItem | null;
}

interface MotionHandoffGesture extends ActiveDragBase {
	readonly mode: "motion-handoff";
	readonly phase: "pressed";
}

interface ActivationOnlyGesture extends ActiveDragBase {
	readonly mode: "activation-only";
	readonly phase: "pressed";
}

interface MovableGesture extends ActiveDragBase {
	readonly mode: "drag";
	phase: "dragging" | "pressed";
}

type ActiveDrag = ActivationOnlyGesture | MotionHandoffGesture | MovableGesture;

interface DragPreview {
	readonly previewTargetFx: (props: {
		readonly drag: ActiveDrag;
		readonly force?: boolean;
		readonly targetFacts: MainInteractionTargetFacts;
	}) => Effect.Effect<TileActorItem | null>;
	readonly readCurrentSourceFx: (drag: ActiveDrag) => Effect.Effect<TileActorItem | null>;
	readonly readPreviewKindFx: (props: {
		readonly sourceItem: TileActorItem;
		readonly targetFacts: MainInteractionTargetFacts;
	}) => Effect.Effect<readTileDropPreviewFx.Result["kind"]>;
	readonly refreshAttractionEligibilityFx: (props: {
		readonly candidateActorIds: ReadonlyArray<string>;
		readonly drag: ActiveDrag;
		readonly sourceItem: TileActorItem;
		readonly targetFacts: MainInteractionTargetFacts;
	}) => Effect.Effect<void>;
}

const readAttractionActorIdFn = ({
	previewKind,
	targetItem,
}: {
	readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
	readonly targetItem: TileActorItem | null;
}): string | null => {
	if (targetItem === null) return null;
	return match(previewKind)
		.with(null, () => null)
		.with(
			DropItemResultKind.Merge,
			DropItemResultKind.Stack,
			DropItemResultKind.StoreInput,
			() => targetItem.id,
		)
		.with(
			DropItemResultKind.Ignored,
			DropItemResultKind.Move,
			DropItemResultKind.Reject,
			DropItemResultKind.StoreInventory,
			DropItemResultKind.Swap,
			() => null,
		)
		.exhaustive();
};

const createDragPreviewFx = Effect.fn("createMainDragControllerFx.createDragPreviewFx")(function* ({
	actorStore,
	game,
	surface,
}: Pick<Props, "actorStore" | "game" | "surface">) {
	const readCurrentSourceFx: DragPreview["readCurrentSourceFx"] = Effect.fn(
		"DragPreview.readCurrentSourceFx",
	)(function* (drag) {
		if (
			drag.actor.container.destroyed ||
			actorStore.actors.get(drag.sourceItem.id) !== drag.actor
		) {
			return null;
		}
		const canonical = actorStore.canonicalItems.get(drag.sourceItem.id);
		if (
			canonical === undefined ||
			!isSameTileActorLocationFn(canonical.location, drag.sourceItem.location)
		) {
			return null;
		}
		return {
			...drag.actor.item,
			location: canonical.location,
			revision: canonical.revision,
		} satisfies TileActorItem;
	});

	const readPreviewKindFx: DragPreview["readPreviewKindFx"] = Effect.fn(
		"DragPreview.readPreviewKindFx",
	)(({ sourceItem, targetFacts }) =>
		readTileDropPreviewFx({
			game,
			sourceItemId: sourceItem.id,
			sourceLocation: sourceItem.location,
			sourceRevision: sourceItem.revision,
			target: targetFacts.commandTarget,
		}).pipe(Effect.map(({ kind }) => kind)),
	);

	const refreshAttractionEligibilityFx: DragPreview["refreshAttractionEligibilityFx"] = Effect.fn(
		"DragPreview.refreshAttractionEligibilityFx",
	)(function* ({ candidateActorIds, drag, sourceItem, targetFacts }) {
		const activeCandidateActorIds = new Set(candidateActorIds);
		for (const actorId of drag.attractionEligibilityByActorId.keys()) {
			if (activeCandidateActorIds.has(actorId)) continue;
			drag.attractionEligibilityByActorId.delete(actorId);
		}
		const eligibleActorIds = new Set<string>();
		for (const actorId of candidateActorIds) {
			if (actorId === sourceItem.id) continue;
			const actor = actorStore.actors.get(actorId);
			const canonical = actorStore.canonicalItems.get(actorId);
			if (actor === undefined || actor.container.destroyed) {
				drag.attractionEligibilityByActorId.delete(actorId);
				continue;
			}
			const targetItem = {
				...actor.item,
				location: canonical?.location ?? actor.item.location,
				revision: canonical?.revision ?? actor.item.revision,
			} satisfies TileActorItem;
			const cached = drag.attractionEligibilityByActorId.get(actorId);
			if (
				cached !== undefined &&
				cached.source.id === sourceItem.id &&
				cached.source.revision === sourceItem.revision &&
				isSameTileActorLocationFn(cached.source.location, sourceItem.location) &&
				cached.target.id === targetItem.id &&
				cached.target.revision === targetItem.revision &&
				isSameTileActorLocationFn(cached.target.location, targetItem.location)
			) {
				if (cached.eligible) eligibleActorIds.add(actorId);
				continue;
			}
			const previewKind =
				targetFacts.occupant?.id === targetItem.id &&
				targetFacts.occupant.revision === targetItem.revision &&
				isSameTileActorLocationFn(targetFacts.occupant.location, targetItem.location)
					? drag.previewKind
					: (yield* readTileDropPreviewFx({
							game,
							sourceItemId: sourceItem.id,
							sourceLocation: sourceItem.location,
							sourceRevision: sourceItem.revision,
							target: {
								kind: "slot",
								location: targetItem.location,
								occupant: {
									itemId: targetItem.id,
									revision: targetItem.revision,
								},
							},
						})).kind;
			if (previewKind === null) continue;
			const eligible =
				readAttractionActorIdFn({
					previewKind,
					targetItem,
				}) !== null;
			drag.attractionEligibilityByActorId.set(actorId, {
				eligible,
				source: {
					id: sourceItem.id,
					location: sourceItem.location,
					revision: sourceItem.revision,
				},
				target: {
					id: targetItem.id,
					location: targetItem.location,
					revision: targetItem.revision,
				},
			});
			if (eligible) eligibleActorIds.add(actorId);
		}
		drag.eligibleAttractionActorIds = eligibleActorIds;
	});

	const previewTargetFx: DragPreview["previewTargetFx"] = Effect.fn(
		"DragPreview.previewTargetFx",
	)(function* ({ drag, force = false, targetFacts }) {
		const sourceItem = yield* readCurrentSourceFx(drag);
		if (sourceItem === null) {
			drag.target = targetFacts.target;
			drag.targetKey = targetFacts.stableKey;
			drag.targetItem = null;
			drag.previewKind = null;
			drag.previewSource = null;
			yield* surface.renderDropFeedbackFx(null, null);
			return null;
		}
		if (
			!force &&
			drag.targetKey === targetFacts.stableKey &&
			drag.previewSource !== null &&
			drag.previewSource.id === sourceItem.id &&
			drag.previewSource.revision === sourceItem.revision &&
			isSameTileActorLocationFn(drag.previewSource.location, sourceItem.location)
		) {
			return sourceItem;
		}
		const kind = yield* readPreviewKindFx({
			sourceItem,
			targetFacts,
		});
		drag.target = targetFacts.target;
		drag.targetKey = targetFacts.stableKey;
		drag.targetItem = targetFacts.occupant;
		drag.previewKind = kind;
		drag.previewSource = {
			id: sourceItem.id,
			location: sourceItem.location,
			revision: sourceItem.revision,
		};
		drag.actor.container.cursor = readActorCursorFn({
			dragPolicy: "main-target-presence",
			hasDropTarget: targetFacts.target !== null,
			phase: "dragging",
			previewKind: kind,
			running: sourceItem.running,
		});
		yield* surface.renderDropFeedbackFx(targetFacts.target, kind);
		return sourceItem;
	});

	return {
		previewTargetFx,
		readCurrentSourceFx,
		readPreviewKindFx,
		refreshAttractionEligibilityFx,
	} satisfies DragPreview;
});

interface PointerSample {
	readonly pointerId: number;
	readonly x: number;
	readonly y: number;
}

const createPointerSamplerFx = Effect.fn("createMainDragControllerFx.createPointerSamplerFx")(
	function* ({
		frames,
		onApply,
	}: {
		readonly frames: DemandFrameLoop;
		readonly onApply: (sample: PointerSample) => void;
	}) {
		let cancelScheduled: (() => void) | null = null;
		let pendingSample: PointerSample | null = null;

		const cancel = () => {
			pendingSample = null;
			cancelScheduled?.();
			cancelScheduled = null;
		};

		const requestFrameFx = Effect.gen(function* () {
			if (cancelScheduled !== null) return;
			cancelScheduled = yield* frames.scheduleFx(() => {
				cancelScheduled = null;
				const latest = pendingSample;
				pendingSample = null;
				if (latest !== null) onApply(latest);
			});
		});

		return {
			cancelFx: Effect.sync(cancel),
			flushFx: Effect.fn("PointerSampler.flushFx")((sample?: PointerSample) =>
				Effect.sync(() => {
					const latest = sample ?? pendingSample;
					cancel();
					if (latest !== null) onApply(latest);
				}),
			),
			scheduleFallbackFx: Effect.fn("PointerSampler.scheduleFallbackFx")(
				(sample: PointerSample) =>
					Effect.gen(function* () {
						pendingSample ??= sample;
						yield* requestFrameFx;
					}),
			),
			scheduleFx: Effect.fn("PointerSampler.scheduleFx")((sample: PointerSample) =>
				Effect.gen(function* () {
					pendingSample = sample;
					yield* requestFrameFx;
				}),
			),
		};
	},
);

const readInventoryShortcutFx = Effect.fn("createMainDragControllerFx.readInventoryShortcutFx")(
	function* ({
		actorStore,
		drag,
		preview,
		surface,
	}: {
		readonly actorStore: MainActorStore;
		readonly drag: ActiveDrag;
		readonly preview: DragPreview;
		readonly surface: MainInteractionSurface;
	}) {
		const inventoryActor = Array.from(actorStore.actors.values()).find(
			(actor) =>
				actor !== drag.actor &&
				!actor.container.destroyed &&
				actor.item.itemType === "inventory",
		);
		if (inventoryActor === undefined) return null;
		const pose = yield* surface.readActorPoseFx(inventoryActor.item);
		if (pose === null) return null;
		const targetFacts = yield* surface.readTargetFactsFx(
			pose.x + pose.size / 2,
			pose.y + pose.size / 2,
		);
		if (targetFacts.target === null) return null;
		const sourceItem = yield* preview.readCurrentSourceFx(drag);
		if (sourceItem === null) return null;
		const kind = yield* preview.readPreviewKindFx({
			sourceItem,
			targetFacts,
		});
		if (
			kind !== DropItemResultKind.StoreInventory ||
			targetFacts.occupant?.id !== inventoryActor.item.id
		) {
			return null;
		}
		return {
			actor: drag.actor,
			commandTarget: targetFacts.commandTarget,
			previewKind: kind,
			shortcutReceiver: {
				actor: inventoryActor,
				pose,
			},
			sourceItem,
			targetItem: targetFacts.occupant,
		} satisfies Parameters<DropSubmission["submitFx"]>[0];
	},
);

const updateMagneticFieldFx = Effect.fn("createMainDragControllerFx.updateMagneticFieldFx")(
	function* ({
		actor,
		candidateActorIds,
		eligibleAttractionActorIds,
		field,
		previewKind,
		sourceDirection,
		sourceItem,
		targetItem,
	}: {
		readonly actor: PixiTileActor;
		readonly candidateActorIds: ReadonlyArray<string>;
		readonly eligibleAttractionActorIds: ReadonlySet<string>;
		readonly field: MagneticField;
		readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
		readonly sourceDirection: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly sourceItem: TileActorItem;
		readonly targetItem: TileActorItem | null;
	}) {
		const attractedActorId = readAttractionActorIdFn({
			previewKind,
			targetItem,
		});
		yield* field.updateFx({
			attractedActorId,
			candidateActorIds,
			eligibleAttractionActorIds,
			sourceActorId: sourceItem.id,
			sourceInstanceId: actor.instanceId,
			sourceDirection,
			sourceX: actor.container.x - actor.container.pivot.x * actor.container.scale.x,
			sourceY: actor.container.y - actor.container.pivot.y * actor.container.scale.y,
		});
	},
);

const removeCheatItemFx = Effect.fn("createMainDragControllerFx.removeCheatItemFx")(
	({ game, sourceItem }: { readonly game: GameEngine; readonly sourceItem: TileActorItem }) =>
		game
			.runFx(
				removeEngineCheatItemFx({
					itemId: sourceItem.id,
					revision: sourceItem.revision,
				}),
			)
			.pipe(
				Effect.as(true),
				Effect.catch(() => Effect.succeed(false)),
			),
);

/**
 * Owns one main-scene pointer gesture from press through activation or drop release.
 *
 * Press-time identity anchors the gesture, while the release command rebases to the latest
 * canonical revision of that same actor at that same location. This lets an engine-committed
 * incoming stack update a held item without turning the eventual drop into a stale command.
 * Geometry drives presentation only; the engine preview and command remain the authority for
 * every drop outcome. A submitted drop retains only its exact source actor and immediately
 * releases the scene-wide gesture slot.
 */
export const createMainDragControllerFx = Effect.fn("createMainDragControllerFx")(function* ({
	actorStore,
	animator,
	application,
	cursorGrab,
	dropSubmission,
	game,
	magneticField,
	motion,
	onActivate,
	readAckTint,
	surface,
}: Props) {
	let activeDrag: ActiveDrag | null = null;
	let closed = false;
	let interactionBlocked = false;
	let thresholdCrossed = false;

	const dragPreview = yield* createDragPreviewFx({
		actorStore,
		game,
		surface,
	});
	const pointerSampler = yield* createPointerSamplerFx({
		frames: application.frames,
		onApply: (sample) => applyPointerMoveSafely(sample),
	});

	const settleActor = (actor: PixiTileActor) => {
		RendererRuntime.runSync(
			settleDraggedActorFx({
				actor,
				animator,
				surface,
			}),
		);
	};

	const releaseDragPointer = (pointerId: number) => {
		try {
			application.app.canvas.releasePointerCapture(pointerId);
		} catch {
			// Capture may already be released by the browser.
		}
	};

	const cancelDrag = (drag: ActiveDrag) => {
		RendererRuntime.runSync(pointerSampler.cancelFx);
		activeDrag = null;
		releaseDragPointer(drag.pointerId);
		if (drag.mode !== "drag") return;
		RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
		RendererRuntime.runSync(magneticField.resetFx);
		RendererRuntime.runSync(cursorGrab.finishFx(drag.actor));
		settleActor(drag.actor);
	};

	const cancelInteraction = () => {
		if (activeDrag === null) return;
		cancelDrag(activeDrag);
	};

	const detachActor = (actor: PixiTileActor) => {
		if (actor.onPointerDown !== null) {
			actor.container.off("pointerdown", actor.onPointerDown);
			actor.onPointerDown = null;
		}
		if (activeDrag?.actor !== actor) return;
		RendererRuntime.runSync(pointerSampler.cancelFx);
		const drag = activeDrag;
		activeDrag = null;
		releaseDragPointer(drag.pointerId);
		if (drag.mode !== "drag") {
			actor.container.cursor = "default";
			return;
		}
		RendererRuntime.runSync(surface.renderDropFeedbackFx(null, null));
		RendererRuntime.runSync(magneticField.resetFx);
		RendererRuntime.runSync(cursorGrab.finishFx(actor));
		actor.dragging = false;
		actor.container.cursor = "default";
	};

	const applyPointerMove = (sample: PointerSample) => {
		const event = {
			global: {
				x: sample.x,
				y: sample.y,
			},
			pointerId: sample.pointerId,
		};
		const pointer = readPointerOffsetFn(event, activeDrag);
		if (pointer === null) return;
		let { drag } = pointer;
		const { offsetX, offsetY } = pointer;
		let cursorGrabPointer = {
			x: drag.pressX,
			y: drag.pressY,
		};
		if (drag.phase === "pressed" && !thresholdCrossed) return;
		if (drag.phase === "pressed" && drag.mode === "activation-only") {
			activeDrag = null;
			releaseDragPointer(drag.pointerId);
			return;
		}
		if (drag.phase === "pressed" && drag.mode === "motion-handoff") {
			const actorStillCanonicalBeforeHandoff =
				actorStore.actors.get(drag.sourceItem.id) === drag.actor &&
				actorStore.canonicalItems.has(drag.sourceItem.id) &&
				!drag.actor.container.destroyed;
			if (!actorStillCanonicalBeforeHandoff) {
				activeDrag = null;
				releaseDragPointer(drag.pointerId);
				return;
			}
			const handedOff = RendererRuntime.runSync(
				motion.beginInteractionHandoffFx(drag.sourceItem.id),
			);
			const remainingClaim = RendererRuntime.runSync(
				motion.readSnapshotFx,
			).interactionClaimByActorId.get(drag.sourceItem.id);
			const actorStillCanonicalAfterHandoff =
				actorStore.actors.get(drag.sourceItem.id) === drag.actor &&
				actorStore.canonicalItems.has(drag.sourceItem.id) &&
				!drag.actor.container.destroyed;
			if (
				!actorStillCanonicalAfterHandoff ||
				(!handedOff && remainingClaim !== undefined) ||
				remainingClaim === "activation-only"
			) {
				activeDrag = null;
				releaseDragPointer(drag.pointerId);
				return;
			}
			drag = {
				...drag,
				mode: "drag",
				phase: "pressed",
				startX: drag.actor.container.x - offsetX,
				startY: drag.actor.container.y - offsetY,
			};
			activeDrag = drag;
			// The actor kept moving after the press. Its rebased pose stays at the live handoff
			// frame, so the grab spring must meet the current pointer rather than the old press.
			cursorGrabPointer = {
				x: sample.x,
				y: sample.y,
			};
		}
		if (drag.phase === "pressed") {
			drag.phase = "dragging";
			const sourceItem = RendererRuntime.runSync(dragPreview.readCurrentSourceFx(drag));
			if (sourceItem === null) {
				cancelDrag(drag);
				return;
			}
			drag.actor.dragging = true;
			drag.actor.container.cursor = "grabbing";
			surface.transientActorLayer.addChild(drag.actor.container);
			drag.actor.container.zIndex = 10_000;
			RendererRuntime.runSync(animator.cancelChannelFx(drag.actor, "pose"));
			RendererRuntime.runSync(cursorGrab.startFx(drag.actor, cursorGrabPointer));
		}
		RendererRuntime.runSync(
			setDraggedActorPoseFx({
				actor: drag.actor,
				animator,
				x: drag.startX + offsetX,
				y: drag.startY + offsetY,
			}),
		);
		const targetFacts = RendererRuntime.runSync(surface.readTargetFactsFx(sample.x, sample.y));
		const sourceItem = RendererRuntime.runSync(
			dragPreview.previewTargetFx({
				drag,
				targetFacts,
			}),
		);
		if (sourceItem === null) {
			cancelDrag(drag);
			return;
		}
		const pointerTravel = {
			x: sample.x - drag.lastPointerX,
			y: sample.y - drag.lastPointerY,
		};
		const pointerTravelMagnitude = Math.hypot(pointerTravel.x, pointerTravel.y);
		const sourceWidth = drag.actor.size * drag.actor.container.scale.x;
		const sourceHeight = drag.actor.size * drag.actor.container.scale.y;
		const sourceX =
			drag.actor.container.x - drag.actor.container.pivot.x * drag.actor.container.scale.x;
		const sourceY =
			drag.actor.container.y - drag.actor.container.pivot.y * drag.actor.container.scale.y;
		const localCandidateActorIds = RendererRuntime.runSync(
			surface.readLocalActorIdsFx({
				excludeActorId: sourceItem.id,
				height: sourceHeight,
				paddingRatio: 1.5,
				width: sourceWidth,
				x: sourceX,
				y: sourceY,
			}),
		);
		const candidateActorIds = Array.from(
			new Set([
				...localCandidateActorIds,
				...RendererRuntime.runSync(magneticField.readActiveSourceActorIdsFx),
				...(targetFacts.occupant === null
					? []
					: [
							targetFacts.occupant.id,
						]),
			]),
		).filter((actorId) => actorId !== sourceItem.id);
		RendererRuntime.runSync(
			dragPreview.refreshAttractionEligibilityFx({
				candidateActorIds,
				drag,
				sourceItem,
				targetFacts,
			}),
		);
		RendererRuntime.runSync(
			updateMagneticFieldFx({
				actor: drag.actor,
				candidateActorIds,
				eligibleAttractionActorIds: drag.eligibleAttractionActorIds,
				field: magneticField,
				previewKind: drag.previewKind,
				sourceDirection:
					pointerTravelMagnitude <= 0.001
						? null
						: {
								x: pointerTravel.x / pointerTravelMagnitude,
								y: pointerTravel.y / pointerTravelMagnitude,
							},
				sourceItem,
				targetItem: drag.targetItem,
			}),
		);
		RendererRuntime.runSync(magneticField.flushFx);
		drag.lastPointerX = sample.x;
		drag.lastPointerY = sample.y;
	};

	const recordThresholdCrossing = (sample: PointerSample) => {
		const drag = activeDrag;
		if (
			thresholdCrossed ||
			drag === null ||
			drag.pointerId !== sample.pointerId ||
			drag.phase !== "pressed"
		) {
			return;
		}
		thresholdCrossed =
			Math.hypot(sample.x - drag.pressX, sample.y - drag.pressY) >= PointerDragThreshold;
	};

	const recoverPointerFailure = (cause: unknown, fallbackDrag?: ActiveDrag) => {
		const drag = activeDrag ?? fallbackDrag ?? null;
		if (drag !== null) {
			try {
				cancelDrag(drag);
			} catch {
				RendererRuntime.runSync(pointerSampler.cancelFx);
				activeDrag = null;
				drag.actor.dragging = false;
				drag.actor.container.cursor = "default";
			}
		} else {
			RendererRuntime.runSync(pointerSampler.cancelFx);
		}
		game.reportCriticalFailure("game-presentation", cause);
	};

	const applyPointerMoveSafely = (sample: PointerSample) => {
		try {
			applyPointerMove(sample);
		} catch (cause) {
			recoverPointerFailure(cause);
		}
	};

	const onPointerMove = (event: FederatedPointerEvent) => {
		const drag = activeDrag;
		if (drag === null || event.pointerId !== drag.pointerId) return;
		const sample = {
			pointerId: event.pointerId,
			x: event.global.x,
			y: event.global.y,
		};
		recordThresholdCrossing(sample);
		RendererRuntime.runSync(pointerSampler.scheduleFx(sample));
	};

	const finishPointer = (event: FederatedPointerEvent) => {
		const pendingDrag = activeDrag;
		if (pendingDrag === null || event.pointerId !== pendingDrag.pointerId) {
			return;
		}
		const releaseSample = {
			pointerId: event.pointerId,
			x: event.global.x,
			y: event.global.y,
		};
		recordThresholdCrossing(releaseSample);
		RendererRuntime.runSync(pointerSampler.flushFx(releaseSample));
		const drag = activeDrag;
		if (drag === null || event.pointerId !== drag.pointerId) return;
		releaseDragPointer(event.pointerId);
		if (drag.phase === "pressed") {
			activeDrag = null;
			const currentActor = actorStore.actors.get(drag.sourceItem.id);
			if (currentActor === undefined || currentActor.container.destroyed) return;
			try {
				RendererRuntime.runSync(
					burstFeedbackParticlesFx({
						actor: currentActor,
						animator,
						tint: readAckTint(),
					}),
				);
			} catch (cause) {
				game.reportCriticalFailure("game-presentation", cause);
			}
			void Promise.resolve()
				.then(() => {
					if (closed) return;
					const currentItem = actorStore.actors.get(drag.sourceItem.id)?.item;
					if (currentItem === undefined) return;
					return onActivate(currentItem, drag.activationIntent, application.app.canvas);
				})
				.catch((cause) => {
					if (closed) return;
					game.reportCriticalFailure("game-presentation", cause);
				});
			return;
		}
		try {
			const targetFacts = RendererRuntime.runSync(
				surface.readTargetFactsFx(event.global.x, event.global.y),
			);
			// Canonical state may have changed beneath a held pointer while the target
			// coordinates stayed stable. Freeze fresh release-time preview facts.
			const sourceItem = RendererRuntime.runSync(
				dragPreview.previewTargetFx({
					drag,
					force: true,
					targetFacts,
				}),
			);
			if (sourceItem === null) {
				cancelDrag(drag);
				return;
			}
			activeDrag = null;
			RendererRuntime.runSync(
				dropSubmission.submitFx({
					actor: drag.actor,
					commandTarget: targetFacts.commandTarget,
					previewKind: drag.previewKind,
					sourceItem,
					targetItem: drag.targetItem,
				}),
			);
		} catch (cause) {
			recoverPointerFailure(cause, drag);
		}
	};

	const cancelPointer = (event: FederatedPointerEvent) => {
		const drag = activeDrag;
		if (drag === null || event.pointerId !== drag.pointerId) {
			return;
		}
		cancelDrag(drag);
	};

	const storeDraggedItemInInventory = (event: KeyboardEvent) => {
		if (
			closed ||
			event.repeat ||
			event.key.toLowerCase() !== "i" ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey
		) {
			return;
		}
		RendererRuntime.runSync(pointerSampler.flushFx());
		const drag = activeDrag;
		if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") {
			return;
		}
		event.preventDefault();
		event.stopImmediatePropagation();
		let submission: Parameters<DropSubmission["submitFx"]>[0] | null;
		try {
			submission = RendererRuntime.runSync(
				readInventoryShortcutFx({
					actorStore,
					drag,
					preview: dragPreview,
					surface,
				}),
			);
		} catch (cause) {
			recoverPointerFailure(cause);
			return;
		}
		if (submission === null) return;
		releaseDragPointer(drag.pointerId);
		RendererRuntime.runSync(pointerSampler.cancelFx);
		activeDrag = null;
		RendererRuntime.runSync(dropSubmission.submitFx(submission));
	};

	const removeDraggedItem = (event: KeyboardEvent) => {
		if (
			closed ||
			event.repeat ||
			event.key.toLowerCase() !== "d" ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			!game.getSnapshot().cheats.enabled
		) {
			return;
		}
		RendererRuntime.runSync(pointerSampler.flushFx());
		const drag = activeDrag;
		if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") {
			return;
		}
		const sourceItem = RendererRuntime.runSync(dragPreview.readCurrentSourceFx(drag));
		if (sourceItem === null) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		cancelDrag(drag);
		void RendererRuntime.runPromise(
			removeCheatItemFx({
				game,
				sourceItem,
			}),
		).catch((cause) => {
			if (closed) return;
			game.reportCriticalFailure("game-presentation", cause);
		});
	};

	const unsubscribeSourceMembership = yield* magneticField.subscribeSourceMembershipFx(
		(sourceKind) => {
			const drag = activeDrag;
			if (
				sourceKind !== "motion" ||
				drag === null ||
				drag.mode !== "drag" ||
				drag.phase !== "dragging"
			) {
				return;
			}
			RendererRuntime.runSync(
				pointerSampler.scheduleFallbackFx({
					pointerId: drag.pointerId,
					x: drag.lastPointerX,
					y: drag.lastPointerY,
				}),
			);
		},
	);

	application.stage.on("globalpointermove", onPointerMove);
	application.stage.on("pointerup", finishPointer);
	application.stage.on("pointerupoutside", finishPointer);
	application.stage.on("pointercancel", cancelPointer);
	const keyboardTarget = typeof window === "undefined" ? null : window;
	keyboardTarget?.addEventListener("keydown", storeDraggedItemInInventory, {
		capture: true,
	});
	keyboardTarget?.addEventListener("keydown", removeDraggedItem, {
		capture: true,
	});

	return {
		attachActorFx: Effect.fn("MainDragController.attachActorFx")((actor) =>
			Effect.gen(function* () {
				if (actor.onPointerDown !== null) {
					actor.container.off("pointerdown", actor.onPointerDown);
				}
				actor.container.eventMode = "static";
				actor.container.cursor = readActorCursorFn({
					phase: "idle",
					previewKind: null,
					running: actor.item.running,
				});
				const onPointerDown = (event: FederatedPointerEvent) => {
					const motionSnapshot = RendererRuntime.runSync(motion.readSnapshotFx);
					const motionClaim = motionSnapshot.interactionClaimByActorId.get(actor.item.id);
					const needsMotionHandoff = motionClaim === "handoff";
					const gestureMode =
						event.button === 2 || motionClaim === "activation-only"
							? "activation-only"
							: needsMotionHandoff
								? "motion-handoff"
								: "drag";
					if (
						closed ||
						interactionBlocked ||
						activeDrag !== null ||
						RendererRuntime.runSync(dropSubmission.isPendingActorFx(actor.item.id)) ||
						!event.isPrimary ||
						(event.button !== 0 && event.button !== 2)
					) {
						return;
					}
					event.stopPropagation();
					if (gestureMode === "drag") {
						RendererRuntime.runSync(animator.cancelFx(actor.item.id));
					}
					try {
						application.app.canvas.setPointerCapture(event.pointerId);
					} catch {
						// Pixi still receives in-canvas pointer events without DOM capture.
					}
					activeDrag = {
						activationIntent:
							event.button === 2
								? "detail"
								: event.shiftKey
									? "split-stack"
									: event.ctrlKey && !event.altKey && !event.metaKey
										? "fill-default-line-queue"
										: "primary",
						actor,
						attractionEligibilityByActorId: new Map(),
						eligibleAttractionActorIds: new Set(),
						pointerId: event.pointerId,
						pressX: event.global.x,
						pressY: event.global.y,
						lastPointerX: event.global.x,
						lastPointerY: event.global.y,
						previewKind: null,
						previewSource: null,
						mode: gestureMode,
						phase: "pressed",
						sourceItem: actor.item,
						startX: actor.container.x,
						startY: actor.container.y,
						target: null,
						targetKey: "unresolved",
						targetItem: null,
					};
					thresholdCrossed = false;
				};
				actor.onPointerDown = onPointerDown;
				actor.container.on("pointerdown", onPointerDown);
			}),
		),
		cancelInteractionFx: Effect.sync(() => cancelInteraction()),
		detachActorFx: Effect.fn("MainDragController.detachActorFx")((actor) =>
			Effect.sync(() => detachActor(actor)),
		),
		requestRefreshFx: Effect.gen(function* () {
			const drag = activeDrag;
			if (drag === null || drag.mode !== "drag" || drag.phase !== "dragging") return;
			yield* pointerSampler.scheduleFallbackFx({
				pointerId: drag.pointerId,
				x: drag.lastPointerX,
				y: drag.lastPointerY,
			});
		}),
		setInteractionBlockedFx: Effect.fn("MainDragController.setInteractionBlockedFx")(
			(blocked) =>
				Effect.sync(() => {
					interactionBlocked = blocked;
					if (blocked) cancelInteraction();
				}),
		),
		closeFx: Effect.gen(function* () {
			if (closed) return;
			closed = true;
			unsubscribeSourceMembership();
			cancelInteraction();
			yield* pointerSampler.cancelFx;
			application.stage.off("globalpointermove", onPointerMove);
			application.stage.off("pointerup", finishPointer);
			application.stage.off("pointerupoutside", finishPointer);
			application.stage.off("pointercancel", cancelPointer);
			keyboardTarget?.removeEventListener("keydown", storeDraggedItemInInventory, {
				capture: true,
			});
			keyboardTarget?.removeEventListener("keydown", removeDraggedItem, {
				capture: true,
			});
			for (const actor of actorStore.actors.values()) {
				detachActor(actor);
			}
		}),
	} satisfies MainDragController;
});
