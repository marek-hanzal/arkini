import { Effect } from "effect";
import { Application, Container } from "pixi.js";
import { vi } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type {
	ActorAnimation,
	ActorAnimator,
	PresentationWrite,
} from "~/tile-rendering/service/ActorAnimator";
import { createMainDragControllerFx } from "~/tile-interaction/fx/createMainDragControllerFx";
import type { CursorGrabMotion } from "~/tile-interaction/fx/createCursorGrabMotionFx";
import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";
import { createDropPresentationFx } from "~/tile-interaction/fx/createDropPresentationFx";
import { createDropSubmissionFx } from "~/tile-interaction/fx/createDropSubmissionFx";
import type { MotionRuntime } from "~/tile-motion/service/MotionRuntime";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { DragOriginGhosts } from "~/tile-interaction/type/DragOriginGhosts";
import {
	createDragActor,
	createItem as createTestItem,
	item as testItem,
} from "~test/tile-interaction/fx/MainDragController.test/actors";

export const item: TileActorItem = testItem;
export const createItem = (id: string, x: number) => createTestItem(id, x);

const previewState = vi.hoisted(() => ({
	actorKinds: new Map<string, "merge" | "move" | "reject" | "swap">(),
	kind: "move" as "ignored" | "move" | "reject" | "swap",
	reads: 0,
	readsByActorId: new Map<string, number>(),
}));

export const previewTestState = previewState;

const removalState = vi.hoisted(() => ({
	remove: vi.fn(),
}));

vi.mock("~/game-cheat/fx/removeCheatItemFx", () => ({
	removeCheatItemFx: (props: unknown) =>
		Effect.sync(() => {
			removalState.remove(props);
		}),
}));

vi.mock("~/tile-interaction/fx/readTileDropPreviewFx", () => ({
	readTileDropPreviewFx: ({ target }: { readonly target: DropItemCommand["target"] }) =>
		Effect.sync(() => {
			previewState.reads += 1;
			const actorId =
				target.kind === "slot" && target.occupant !== null ? target.occupant.itemId : null;
			if (actorId !== null) {
				previewState.readsByActorId.set(
					actorId,
					(previewState.readsByActorId.get(actorId) ?? 0) + 1,
				);
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
	readonly interactionClaimByActorId?: ReadonlyMap<string, "blocked">;
	readonly targetItems?: ReadonlyArray<TileActorItem>;
} = {}) => {
	previewState.kind = "move";
	previewState.actorKinds.clear();
	previewState.reads = 0;
	previewState.readsByActorId.clear();
	removalState.remove.mockClear();
	const stageContainer = new Container();
	const stage = new FakeEmitter(stageContainer);
	const animateActor = vi.fn();
	const cancelAnimation = vi.fn();
	const cancelChannel = vi.fn();
	const finishCursorGrab = vi.fn();
	const beginOriginGhost = vi.fn();
	const settleOriginGhost = vi.fn();
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
	let currentCommandTarget: DropItemCommand["target"] = {
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
	let currentTargetKind: "board" | null = "board";
	let currentOccupant: TileActorItem | null = null;
	let targetFactsFailure: unknown | null = null;
	const onActivate = vi.fn();
	const onSettledDrop = vi.fn();
	const reportCriticalFailureFn = vi.fn();
	const isPoseActive = vi.fn(() => false);
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
		exitingActors: new Set(),
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
		isChannelActiveFx: (_actor, channel) =>
			Effect.sync(() => channel === "pose" && isPoseActive()),
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
	const dragOriginGhosts = {
		beginFx: (ghostActor) => Effect.sync(() => beginOriginGhost(ghostActor)),
		closeFx: Effect.void,
		settleFx: (ghostActor) => Effect.sync(() => settleOriginGhost(ghostActor)),
	} satisfies DragOriginGhosts;
	const game = {
		getSnapshotFn: () => ({
			cheats: {
				enabled: cheatsEnabled,
			},
		}),
		reportCriticalFailureFn,
		runFx: (effect: Effect.Effect<unknown, unknown>) => effect,
	} as never;
	const motion = {
		cancelSpaceFx: () => Effect.void,
		handoffDeliveriesFx: () => Effect.void,
		closeFx: Effect.void,
		enqueueFx: () => Effect.void,
		readSnapshotFx: Effect.succeed({
			interactionClaimByActorId,
			retainedActorIds: new Set(interactionClaimByActorId.keys()),
			spawnCueByActorId: new Map(),
		}),
		startFx: Effect.void,
	} satisfies MotionRuntime;
	const surface = {
		readActorPoseFx: (actorItem: TileActorItem) =>
			Effect.succeed(actorPoses.get(actorItem.id) ?? currentActorPose),
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
		renderDropFeedbackFx: () => Effect.void,
		transientActorLayer,
	} satisfies MainInteractionSurface;
	const onRejectedDrop = vi.fn();
	const dropSubmission = Effect.runSync(
		createDropSubmissionFx({
			actorStore,
			animator,
			cursorGrab,
			dropPresentation,
			game,
			onSettledDropFn: onSettledDrop,
			onDropFn: onDrop as never,
			onRejectedDropFn: onRejectedDrop,
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
						addBeforeRenderListenerFx: () => Effect.succeed(() => {}),
						closeFx: Effect.void,
						invalidateFx: Effect.void,
						reportCriticalFailureFn: () => {},
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
				dragThreshold: 6,
				dragOriginGhosts,
				dropSubmission,
				game,
				motion,
				onActivateFn: onActivate,
				readAckTintFn: () => 0x57d7b2,
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
		isPoseActive,
		beginOriginGhost,
		canonicalItems,
		cancelAnimation,
		cancelChannel,
		controller,
		dropPresentation,
		dropSubmission,
		dropTargetReads,
		finishCursorGrab,
		flushFrame,
		keyboardTarget,
		onActivate,
		onSettledDrop,
		onDrop,
		onRejectedDrop,
		presentationWrites,
		releasePointerCapture,
		reportCriticalFailureFn,
		removeDraggedItem: removalState.remove,
		setActorPose: (pose: typeof currentActorPose) => {
			currentActorPose = pose;
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
		setTargetKind: (kind: "board" | null) => {
			currentTargetKind = kind;
		},
		setOccupant: (occupant: TileActorItem | null) => {
			currentOccupant = occupant;
		},
		setItem: (nextItem: TileActorItem) => {
			actor.item = nextItem;
		},
		setTargetFactsFailure: (cause: unknown | null) => {
			targetFactsFailure = cause;
		},
		startCursorGrab,
		settleOriginGhost,
		stage,
		transientActorLayer,
	};
};

export const setSwapTarget = (
	mounted: ReturnType<typeof mountController>,
	target: TileActorItem,
) => {
	previewState.actorKinds.set(target.id, "swap");
	mounted.setOccupant(target);
	mounted.setCommandTarget({
		kind: "slot",
		location: target.location,
		occupant: {
			itemId: target.id,
			revision: target.revision,
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
	if (animation.channel !== "pose" || animation.readPoseFn === undefined) {
		throw new Error("Expected a semantic pose animation.");
	}
	const pose = animation.readPoseFn(progress);
	animation.actor.container.position.set(pose.x, pose.y);
	if (pose.scale !== undefined) animation.actor.container.scale.set(pose.scale);
	return pose;
};
