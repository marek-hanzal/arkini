import { Effect } from "effect";
import { vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiActorAnimation,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiMainSceneDragControllerFx } from "~/ui/pixi/drag/createPixiMainSceneDragControllerFx";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import { createPixiMainSceneDropPresentationFx } from "~/ui/pixi/drop/createPixiMainSceneDropPresentationFx";
import { createPixiMainSceneDropSubmissionFx } from "~/ui/pixi/drop/createPixiMainSceneDropSubmissionFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

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

export class FakeEmitter {
	private readonly listeners = new Map<string, Set<(event: FakePointerEvent) => void>>();

	on(name: string, listener: (event: FakePointerEvent) => void) {
		const listeners = this.listeners.get(name) ?? new Set();
		listeners.add(listener);
		this.listeners.set(name, listeners);
	}

	off(name: string, listener: (event: FakePointerEvent) => void) {
		this.listeners.get(name)?.delete(listener);
	}

	emit(name: string, event: FakePointerEvent) {
		for (const listener of this.listeners.get(name) ?? []) listener(event);
	}
}

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

interface FakePointerEvent {
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

export const item = {
	id: "runtime:log",
	itemId: "log",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision: "revision:log",
	running: false,
	activityEffect: false,
	sourceUrl: "resource:log",
	title: "Log",
} as TileActorItem;

export const createItem = (id: string, x: number) =>
	({
		...item,
		id,
		itemId: id,
		location: {
			...item.location,
			position: {
				x,
				y: 0,
			},
		},
		revision: `revision:${id}`,
		title: id,
	}) as TileActorItem;

export const createActivityParticles = () => ({
	centerX: 40,
	container: {
		visible: false,
	},
	feedbackPhase: null,
	lastProgress: 0,
	lightSurface: false,
	particles: [
		{
			alphaScale: 1,
			particle: {
				alpha: 0,
				tint: 0,
				x: 0,
				y: 0,
			},
			phaseOffset: 0,
			spreadOffset: 0,
			speedCycles: 1,
			waveOffset: 0,
		},
	],
	startY: 68,
	topHalfWidth: 24,
	topY: -18,
	workingTint: 0xf05bb8,
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
	const actorEvents = new FakeEmitter();
	const stage = new FakeEmitter();
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
	const animations: PixiActorAnimation[] = [];
	const presentationWrites: PixiActorPresentationWrite[] = [];
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
	const transientActorLayer = {
		addChild: vi.fn(),
	};
	const actorContainer = Object.assign(actorEvents, {
		cursor: "grab",
		destroyed: false,
		pivot: {
			x: 0,
			y: 0,
		},
		position: {
			set(x: number, y: number) {
				actorContainer.x = x;
				actorContainer.y = y;
			},
		},
		scale: {
			set(value: number) {
				this.x = value;
				this.y = value;
			},
			x: 1,
			y: 1,
		},
		x: 10,
		y: 20,
		zIndex: 0,
	});
	const actor = {
		activityParticles: createActivityParticles(),
		container: actorContainer,
		dragging: false,
		instanceId: `test:${item.id}`,
		item,
		lifecycleFadeStarted: false,
		lifecycleIntentGeneration: 0,
		lifecycleTargetAlpha: 1,
		onPointerDown: null,
		size: 80,
	} as unknown as PixiTileActor;
	const actors = new Map([
		[
			item.id,
			actor,
		],
	]);
	const canonicalItems = new Map([
		[
			item.id,
			item,
		],
	]);
	for (const targetItem of targetItems) {
		actors.set(targetItem.id, {
			activityParticles: createActivityParticles(),
			container: {
				destroyed: false,
			},
			instanceId: `test:${targetItem.id}`,
			item: targetItem,
		} as unknown as PixiTileActor);
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
	const magneticUpdates: Array<Parameters<PixiTileMagneticField["updateFx"]>[0]> = [];
	const targetRedirects: Array<Parameters<PixiTileMotionRuntime["redirectTargetFx"]>[0]> = [];
	const onActivate = vi.fn();
	const onAcceptedDrop = vi.fn();
	const reportCriticalFailure = vi.fn();
	const beginInteractionHandoff = vi.fn((_actorId: string) => true);
	const releasePointerCapture = vi.fn();
	const dropPresentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
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
	} as unknown as PixiMainSceneActorStore;
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
	} satisfies PixiActorAnimator;
	const cursorGrab = {
		closeFx: Effect.void,
		finishFx: () => Effect.sync(finishCursorGrab),
		startFx: (actor, pointer) => Effect.sync(() => startCursorGrab(actor, pointer)),
	} satisfies PixiCursorGrabMotion;
	const game = {
		getSnapshot: () => ({
			cheats: {
				enabled: cheatsEnabled,
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
	} satisfies PixiTileMagneticField;
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
	} satisfies PixiTileMotionRuntime;
	const surface = {
		readActorPoseFx: (actorItem: TileActorItem) =>
			Effect.succeed(actorPoses.get(actorItem.id) ?? currentActorPose),
		readLocalActorIdsFx: (bounds: Parameters<PixiMainSceneSurface["readLocalActorIdsFx"]>[0]) =>
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
									layout: {
										cellSize: 80,
										kind: currentTargetKind,
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
	} as unknown as PixiMainSceneSurface;
	const dropSubmission = Effect.runSync(
		createPixiMainSceneDropSubmissionFx({
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
	let controller: PixiMainSceneDragController;
	try {
		controller = Effect.runSync(
			createPixiMainSceneDragControllerFx({
				actorStore,
				animator,
				application: {
					app: {
						canvas: {
							releasePointerCapture,
							setPointerCapture: vi.fn(),
						},
					},
					frames: {
						invalidateFx: Effect.void,
						scheduleFx: (work: () => void) =>
							Effect.sync(() => {
								scheduledFrameWork = work;
								return () => {
									if (scheduledFrameWork === work) scheduledFrameWork = null;
								};
							}),
					},
					stage,
				} as unknown as PixiApplicationOwner,
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

export const flushMicrotasks = async () => {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
};

export const samplePoseAnimation = (animation: PixiActorAnimation, progress: number) => {
	if (animation.channel !== "pose" || animation.readPose === undefined) {
		throw new Error("Expected a semantic pose animation.");
	}
	const pose = animation.readPose(progress);
	animation.actor.container.position.set(pose.x, pose.y);
	if (pose.scale !== undefined) animation.actor.container.scale.set(pose.scale);
	return pose;
};
