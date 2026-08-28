import { Effect } from "effect";
import { Application, Container } from "pixi.js";
import { vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type {
	ActorAnimation,
	ActorAnimator,
	PresentationWrite,
} from "~/ui/pixi/animation/ActorAnimator";
import { createMainDragControllerFx } from "~/ui/pixi/drag/createMainDragControllerFx";
import type { CursorGrabMotion } from "~/ui/pixi/drag/CursorGrabMotion";
import type { MainDragController } from "~/ui/pixi/drag/MainDragController";
import { createDropPresentationFx } from "~/ui/pixi/drop/createDropPresentationFx";
import { createDropSubmissionFx } from "~/ui/pixi/drop/createDropSubmissionFx";
import type { MagneticField } from "~/ui/pixi/magnet/MagneticField";
import type { MotionRuntime } from "~/ui/pixi/motion/MotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";
import {
	createDragActor,
	createItem as createTestItem,
	item as testItem,
} from "~test/ui/pixi/MainDragController.test/actors";

export const item: TileActorItem = testItem;
export const createItem = (id: string, x: number) => createTestItem(id, x);

const previewState = vi.hoisted(() => ({
	actorKinds: new Map<
		string,
		"merge" | "move" | "reject" | "stack" | "store-input" | "store-inventory" | "swap"
	>(),
	failureActorIds: new Set<string>(),
	kind: "move" as "ignored" | "move" | "reject" | "store-inventory" | "swap",
	reads: 0,
	readsByActorId: new Map<string, number>(),
}));

export const previewTestState = previewState;

const removalState = vi.hoisted(() => ({
	remove: vi.fn(),
}));

vi.mock("~/bridge/cheat/removeDraggedCheatItemFx", () => ({
	removeDraggedCheatItemFx: (props: unknown) =>
		Effect.sync(() => {
			removalState.remove(props);
			return true;
		}),
}));

vi.mock("~/bridge/tile/readTileDropPreviewFx", () => ({
	readTileDropPreviewFx: ({ target }: { readonly target: runTileDropAtom.Command["target"] }) =>
		Effect.sync(() => {
			previewState.reads += 1;
			const actorId =
				target.kind === "slot" && target.occupant !== null ? target.occupant.itemId : null;
			if (actorId !== null) {
				previewState.readsByActorId.set(
					actorId,
					(previewState.readsByActorId.get(actorId) ?? 0) + 1,
				);
				if (previewState.failureActorIds.has(actorId)) {
					throw new Error(`preview failed:${actorId}`);
				}
			}
			return {
				kind:
					target.kind === "slot" && target.occupant !== null
						? (previewState.actorKinds.get(target.occupant.itemId) ?? previewState.kind)
						: previewState.kind,
			};
		}),
}));

interface FakeKeyboardEvent {
	altKey: boolean;
	ctrlKey: boolean;
	key: string;
	metaKey: boolean;
	preventDefault: () => void;
	repeat: boolean;
	stopImmediatePropagation: () => void;
}

class FakeKeyboardTarget {
	private readonly listeners = new Set<(event: FakeKeyboardEvent) => void>();

	addEventListener(_name: string, listener: (event: FakeKeyboardEvent) => void) {
		this.listeners.add(listener);
	}

	removeEventListener(_name: string, listener: (event: FakeKeyboardEvent) => void) {
		this.listeners.delete(listener);
	}

	emit(event: FakeKeyboardEvent) {
		for (const listener of this.listeners) listener(event);
	}
}

export const keyboard = (key: string): FakeKeyboardEvent => ({
	altKey: false,
	ctrlKey: false,
	key,
	metaKey: false,
	preventDefault: vi.fn(),
	repeat: false,
	stopImmediatePropagation: vi.fn(),
});

export interface FakePointerEvent {
	altKey: boolean;
	button: number;
	ctrlKey: boolean;
	global: {
		x: number;
		y: number;
	};
	isPrimary: boolean;
	metaKey: boolean;
	pointerId: number;
	shiftKey: boolean;
	stopPropagation: () => void;
}

export class FakeEmitter {
	constructor(readonly container = new Container()) {}

	emit(name: string, event: FakePointerEvent) {
		Reflect.apply(this.container.emit, this.container, [
			name,
			event,
		]);
	}
}

export const pointer = (x: number, y: number, button = 0): FakePointerEvent => ({
	altKey: false,
	button,
	ctrlKey: false,
	global: {
		x,
		y,
	},
	isPrimary: true,
	metaKey: false,
	pointerId: 1,
	shiftKey: false,
	stopPropagation: vi.fn(),
});

export const mountController = ({
	cheatsEnabled = false,
	interactionClaimByActorId = new Map(),
	targetItems = [],
}: {
	readonly cheatsEnabled?: boolean;
	readonly interactionClaimByActorId?: ReadonlyMap<string, "activation-only" | "handoff">;
	readonly targetItems?: ReadonlyArray<TileActorItem>;
} = {}) => {
	previewState.kind = "move";
	previewState.actorKinds.clear();
	previewState.failureActorIds.clear();
	previewState.reads = 0;
	previewState.readsByActorId.clear();
	removalState.remove.mockClear();
	const stageContainer = new Container();
	const stage = new FakeEmitter(stageContainer);
	const animateActor = vi.fn();
	const cancelAnimation = vi.fn();
	const cancelChannel = vi.fn();
	const finishCursorGrab = vi.fn();
	const flushMagneticField = vi.fn();
	const startCursorGrab = vi.fn();
	let scheduledFrameWork: (() => void) | null = null;
	const flushFrame = () => {
		const work = scheduledFrameWork;
		scheduledFrameWork = null;
		work?.();
	};
	const animations: ActorAnimation[] = [];
	const presentationWrites: PresentationWrite[] = [];
	const dropTargetReads: Array<{
		readonly x: number;
		readonly y: number;
	}> = [];
	const localActorReads: Array<{
		readonly excludeActorId?: string;
		readonly height: number;
		readonly paddingRatio?: number;
		readonly width: number;
		readonly x: number;
		readonly y: number;
	}> = [];
	const transientActorLayer = new Container();
	vi.spyOn(transientActorLayer, "addChild");
	const actor = createDragActor(item);
	const actorEvents = new FakeEmitter(actor.container);
	const actors = new Map([
		[
			item.id,
			actor,
		],
	]);
	const canonicalItems = new Map<string, TileActorItem>([
		[
			item.id,
			item,
		],
	]);
	for (const targetItem of targetItems) {
		actors.set(targetItem.id, createDragActor(targetItem));
		canonicalItems.set(targetItem.id, targetItem);
	}
	let currentCommandTarget: runTileDropAtom.Command["target"] = {
		kind: "unsupported" as const,
	};
	let currentActorPose = {
		layer: transientActorLayer,
		size: 80,
		x: 10,
		y: 20,
	};
	const actorPoses = new Map<string, typeof currentActorPose>();
	let currentDropTargetX = 1;
	let activeMagneticSourceActorIds: ReadonlyArray<string> = [];
	let sourceMembershipListener: ((sourceKind: "drag" | "motion") => void) | null = null;
	let currentLocalActorIds: ReadonlyArray<string> | null = null;
	let currentTargetKind: "board" | "toolbar" | null = "board";
	let currentOccupant: TileActorItem | null = null;
	let targetFactsFailure: unknown | null = null;
	const magneticUpdates: Array<Parameters<MagneticField["updateFx"]>[0]> = [];
	const targetRedirects: Array<Parameters<MotionRuntime["redirectTargetFx"]>[0]> = [];
	const onActivate = vi.fn();
	const onAcceptedDrop = vi.fn();
	const reportCriticalFailure = vi.fn();
	const beginInteractionHandoff = vi.fn((_actorId: string) => true);
	const releasePointerCapture = vi.fn();
	const dropPresentation = Effect.runSync(createDropPresentationFx());
	const onDrop = vi.fn(() =>
		Promise.resolve({
			kind: "move" as const,
		}),
	);
	const keyboardTarget = new FakeKeyboardTarget();
	const hadWindow = Object.hasOwn(globalThis, "window");
	const previousWindow = globalThis.window;
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: keyboardTarget,
	});
	const actorStore = {
		actors,
		canonicalItems,
		closeFx: Effect.void,
		deleteActorFx: (actorId) =>
			Effect.sync(() => {
				const deleted = actors.get(actorId) ?? null;
				actors.delete(actorId);
				return deleted;
			}),
		destroyExitingActorFx: (exitingActor) =>
			Effect.sync(() => {
				exitingActor.container.destroy({
					children: true,
				});
			}),
		readActorFx: (actorId) => Effect.sync(() => actors.get(actorId) ?? null),
		readCanonicalItemFx: (actorId) => Effect.sync(() => canonicalItems.get(actorId) ?? null),
		readCanonicalOccupantFx: () => Effect.succeed(null),
		readCanonicalOccupantsFx: () => Effect.succeed([]),
		releaseActorFx: (actorId) =>
			Effect.sync(() => {
				const released = actors.get(actorId) ?? null;
				actors.delete(actorId);
				return released;
			}),
		replaceCanonicalItemsFx: (items) =>
			Effect.sync(() => {
				canonicalItems.clear();
				for (const canonicalItem of items) {
					canonicalItems.set(canonicalItem.id, canonicalItem);
				}
			}),
		setActorFx: (nextActor) =>
			Effect.sync(() => {
				actors.set(nextActor.item.id, nextActor);
			}),
	} satisfies MainActorStore;
	const animator = {
		animateFx: (animation) =>
			Effect.sync(() => {
				animations.push(animation);
				animateActor(animation);
			}),
		cancelActorFx: () => Effect.void,
		cancelChannelFx: (animationActor, channel) =>
			Effect.sync(() => {
				cancelChannel(animationActor, channel);
			}),
		cancelFx: (ownerKey) =>
			Effect.sync(() => {
				cancelAnimation(ownerKey);
			}),
		closeFx: Effect.void,
		isChannelActiveFx: () => Effect.succeed(false),
		setFx: (write) =>
			Effect.sync(() => {
				presentationWrites.push(write);
				if (write.channel === "activity-particles") {
					write.actor.activityParticles.container.visible = write.visible;
					return;
				}
				if (write.channel !== "pose") return;
				write.actor.container.position.set(write.x, write.y);
				if (write.scale !== undefined) {
					write.actor.container.scale.set(write.scale);
				}
			}),
	} satisfies ActorAnimator;
	const cursorGrab = {
		closeFx: Effect.void,
		finishFx: () => Effect.sync(finishCursorGrab),
		startFx: (actor, pointer) => Effect.sync(() => startCursorGrab(actor, pointer)),
	} satisfies CursorGrabMotion;
	const game = {
		getTransitionSnapshot: () => ({
			runtime: {
				cheats: {
					enabled: cheatsEnabled,
				},
			},
		}),
		reportCriticalFailure,
	} as never;
	const magneticField = {
		closeFx: Effect.void,
		flushFx: Effect.sync(flushMagneticField),
		pruneFx: Effect.void,
		readActiveSourceActorIdsFx: Effect.sync(() => activeMagneticSourceActorIds),
		releaseFx: () => Effect.void,
		releaseSourcesFx: () => Effect.void,
		resetFx: Effect.void,
		subscribeSourceMembershipFx: (listen) =>
			Effect.sync(() => {
				sourceMembershipListener = listen;
				return () => {
					if (sourceMembershipListener === listen) sourceMembershipListener = null;
				};
			}),
		updateFx: (sample) =>
			Effect.sync(() => {
				magneticUpdates.push(sample);
			}),
	} satisfies MagneticField;
	const motion = {
		beginInteractionHandoffFx: (actorId) => Effect.sync(() => beginInteractionHandoff(actorId)),
		closeFx: Effect.void,
		enqueueFx: () => Effect.void,
		redirectTargetFx: (redirect) =>
			Effect.sync(() => {
				targetRedirects.push(redirect);
			}),
		readSnapshotFx: Effect.succeed({
			interactionClaimByActorId,
			retainedActorIds: new Set(interactionClaimByActorId.keys()),
			spawnCueByActorId: new Map(),
			quantityPresentationByActorId: new Map(),
		}),
		startFx: Effect.void,
		syncPresentationFx: Effect.void,
	} satisfies MotionRuntime;
	const surface = {
		closeFx: Effect.void,
		readActorPoseFx: (actorItem: TileActorItem) =>
			Effect.succeed(actorPoses.get(actorItem.id) ?? currentActorPose),
		readLocalActorIdsFx: (bounds: Parameters<MainSurface["readLocalActorIdsFx"]>[0]) =>
			Effect.sync(() => {
				localActorReads.push(bounds);
				return currentLocalActorIds ?? Array.from(actors.keys());
			}),
		readTargetFactsFx: (x: number, y: number) =>
			Effect.sync(() => {
				if (targetFactsFailure !== null) throw targetFactsFailure;
				dropTargetReads.push({
					x,
					y,
				});
				return {
					commandTarget: currentCommandTarget,
					occupant: currentOccupant,
					stableKey: `${currentDropTargetX}:${currentOccupant?.id ?? "empty"}:${currentOccupant?.revision ?? "none"}`,
					target:
						currentTargetKind !== null
							? {
									kind: "slot" as const,
									layout: {
										cellSize: 80,
										columns: 10,
										height: 80,
										kind: currentTargetKind,
										rows: 1,
										width: 800,
										x: 0,
										y: 0,
									},
									x: currentDropTargetX,
									y: 0,
								}
							: null,
				};
			}),
		readLocationPoseFx: () => Effect.succeed(currentActorPose),
		redrawFx: Effect.void,
		renderDropFeedbackFx: () => Effect.void,
		setPaletteFx: () => Effect.void,
		setTransitionFx: () => Effect.void,
		transientActorLayer,
	} satisfies MainSurface;
	const dropSubmission = Effect.runSync(
		createDropSubmissionFx({
			actorStore,
			animator,
			cursorGrab,
			dropPresentation,
			game,
			magneticField,
			motion,
			onAcceptedDrop,
			onDrop: onDrop as never,
			surface,
		}),
	);
	const pixiApplication: PixiApplicationOwner["app"] = Object.create(Application.prototype);
	Object.defineProperty(pixiApplication, "canvas", {
		configurable: true,
		value: {
			releasePointerCapture,
			setPointerCapture: vi.fn(),
		},
	});
	let controller: MainDragController;
	try {
		controller = Effect.runSync(
			createMainDragControllerFx({
				actorStore,
				animator,
				application: {
					addResizeListenerFx: () => Effect.succeed(() => {}),
					app: pixiApplication,
					closeFx: Effect.void,
					frames: {
						closeFx: Effect.void,
						invalidateFx: Effect.void,
						reportCriticalFailure: () => {},
						scheduleAfterRenderFx: () => Effect.succeed(() => {}),
						scheduleFx: (work: () => void) =>
							Effect.sync(() => {
								scheduledFrameWork = work;
								return () => {
									if (scheduledFrameWork === work) scheduledFrameWork = null;
								};
							}),
					},
					stage: stageContainer,
				} satisfies PixiApplicationOwner,
				cursorGrab,
				dropSubmission,
				game,
				magneticField,
				motion,
				onActivate,
				readAckTint: () => 0x57d7b2,
				surface,
			}),
		);
	} finally {
		if (hadWindow) {
			Object.defineProperty(globalThis, "window", {
				configurable: true,
				value: previousWindow,
			});
		} else {
			Reflect.deleteProperty(globalThis, "window");
		}
	}
	Effect.runSync(controller.attachActorFx(actor));
	return {
		actor,
		actorEvents,
		actors,
		animations,
		animateActor,
		beginInteractionHandoff,
		canonicalItems,
		cancelAnimation,
		cancelChannel,
		controller,
		dropPresentation,
		dropSubmission,
		dropTargetReads,
		finishCursorGrab,
		flushMagneticField,
		flushFrame,
		keyboardTarget,
		localActorReads,
		magneticUpdates,
		onActivate,
		onAcceptedDrop,
		onDrop,
		presentationWrites,
		releasePointerCapture,
		reportCriticalFailure,
		removeDraggedItem: removalState.remove,
		setActorPose: (pose: typeof currentActorPose) => {
			currentActorPose = pose;
		},
		setActiveMagneticSourceActorIds: (actorIds: ReadonlyArray<string>) => {
			activeMagneticSourceActorIds = actorIds;
		},
		triggerSourceMembership: (sourceKind: "drag" | "motion") => {
			sourceMembershipListener?.(sourceKind);
		},
		setItemActorPose: (itemId: string, pose: typeof currentActorPose) => {
			actorPoses.set(itemId, pose);
		},
		setCommandTarget: (target: typeof currentCommandTarget) => {
			currentCommandTarget = target;
		},
		setDropTargetX: (x: number) => {
			currentDropTargetX = x;
		},
		setTargetKind: (kind: "board" | "toolbar" | null) => {
			currentTargetKind = kind;
		},
		setOccupant: (occupant: TileActorItem | null) => {
			currentOccupant = occupant;
		},
		setItem: (nextItem: TileActorItem) => {
			actor.item = nextItem;
		},
		setLocalActorIds: (actorIds: ReadonlyArray<string>) => {
			currentLocalActorIds = actorIds;
		},
		setTargetFactsFailure: (cause: unknown | null) => {
			targetFactsFailure = cause;
		},
		startCursorGrab,
		stage,
		targetRedirects,
		transientActorLayer,
	};
};

export const setOrdinaryInventoryTarget = (
	mounted: ReturnType<typeof mountController>,
	inventory: TileActorItem,
) => {
	previewState.actorKinds.set(inventory.id, "store-inventory");
	mounted.setOccupant(inventory);
	mounted.setCommandTarget({
		kind: "slot",
		location: inventory.location,
		occupant: {
			itemId: inventory.id,
			revision: inventory.revision,
		},
	});
};

export const releaseOrdinaryDrag = (mounted: ReturnType<typeof mountController>) => {
	mounted.actorEvents.emit("pointerdown", pointer(10, 20));
	mounted.stage.emit("globalpointermove", pointer(30, 20));
	mounted.stage.emit("pointerup", pointer(30, 20));
};

export const flushMicrotasks = async () => {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
};

export const samplePoseAnimation = (animation: ActorAnimation, progress: number) => {
	if (animation.channel !== "pose" || animation.readPose === undefined) {
		throw new Error("Expected a semantic pose animation.");
	}
	const pose = animation.readPose(progress);
	animation.actor.container.position.set(pose.x, pose.y);
	if (pose.scale !== undefined) animation.actor.container.scale.set(pose.scale);
	return pose;
};
