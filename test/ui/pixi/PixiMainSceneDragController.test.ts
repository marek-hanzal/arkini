import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

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

class FakeEmitter {
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

const keyboard = (key: string): FakeKeyboardEvent => ({
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

const pointer = (x: number, y: number, button = 0): FakePointerEvent => ({
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

const item = {
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

const createItem = (id: string, x: number) =>
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

const createActivityParticles = () => ({
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

const mountController = ({
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

const flushMicrotasks = async () => {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
};

const samplePoseAnimation = (animation: PixiActorAnimation, progress: number) => {
	if (animation.channel !== "pose" || animation.readPose === undefined) {
		throw new Error("Expected a semantic pose animation.");
	}
	const pose = animation.readPose(progress);
	animation.actor.container.position.set(pose.x, pose.y);
	if (pose.scale !== undefined) animation.actor.container.scale.set(pose.scale);
	return pose;
};

describe("Pixi main-scene drag controller", () => {
	it("coalesces a raw pointer burst into one latest-sample drag update", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));

		mounted.stage.emit("globalpointermove", pointer(20, 20));
		mounted.stage.emit("globalpointermove", pointer(35, 20));
		mounted.stage.emit("globalpointermove", pointer(70, 20));

		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.magneticUpdates).toEqual([]);
		mounted.flushFrame();

		expect(mounted.actor.dragging).toBe(true);
		expect(mounted.actor.container.x).toBe(70);
		expect(mounted.magneticUpdates).toHaveLength(1);
	});

	it("latches a raw threshold crossing even when the latest frame sample returns below it", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));

		mounted.stage.emit("globalpointermove", pointer(70, 20));
		mounted.stage.emit("globalpointermove", pointer(12, 20));
		mounted.flushFrame();

		expect(mounted.actor.dragging).toBe(true);
		expect(mounted.actor.container.x).toBe(12);
	});

	it("latches a raw threshold crossing through an exact release below the threshold", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));

		mounted.stage.emit("globalpointermove", pointer(70, 20));
		mounted.stage.emit("globalpointermove", pointer(12, 20));
		mounted.stage.emit("pointerup", pointer(12, 20));

		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});

	it("cleans up a scheduled drag failure before reporting it", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(mounted.actor.dragging).toBe(true);

		mounted.reportCriticalFailure.mockImplementationOnce(() => {
			expect(mounted.actor.dragging).toBe(false);
			expect(mounted.finishCursorGrab).toHaveBeenCalledOnce();
		});
		const failure = new Error("target facts failed");
		mounted.setTargetFactsFailure(failure);
		mounted.stage.emit("globalpointermove", pointer(40, 20));
		mounted.flushFrame();

		expect(mounted.reportCriticalFailure).toHaveBeenCalledExactlyOnceWith(
			"game-presentation",
			failure,
		);
	});

	it("refreshes a stable target preview when exact source facts change", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(previewState.reads).toBe(1);

		const nextItem = {
			...item,
			revision: "revision:log:updated",
		} satisfies TileActorItem;
		mounted.canonicalItems.set(item.id, nextItem);
		mounted.setItem(nextItem);
		mounted.stage.emit("globalpointermove", pointer(31, 20));
		mounted.flushFrame();

		expect(previewState.reads).toBe(2);
	});

	it("flushes the exact release coordinates before submitting and cancels the stale frame", () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("globalpointermove", pointer(55, 20));

		mounted.stage.emit("pointerup", pointer(90, 35));

		expect(mounted.actor.container).toMatchObject({
			x: 90,
			y: 35,
		});
		expect(mounted.dropTargetReads.at(-1)).toEqual({
			x: 90,
			y: 35,
		});
		expect(mounted.onDrop).toHaveBeenCalledOnce();
		const updateCount = mounted.magneticUpdates.length;
		mounted.flushFrame();
		expect(mounted.magneticUpdates).toHaveLength(updateCount);
	});

	it.each([
		"pointer-cancel",
		"detach",
		"block",
		"close",
	] as const)("cancels stale scheduled pointer work on %s", (action) => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(70, 20));

		switch (action) {
			case "pointer-cancel":
				mounted.stage.emit("pointercancel", pointer(70, 20));
				break;
			case "detach":
				Effect.runSync(mounted.controller.detachActorFx(mounted.actor));
				break;
			case "block":
				Effect.runSync(mounted.controller.setInteractionBlockedFx(true));
				break;
			case "close":
				Effect.runSync(mounted.controller.closeFx);
				break;
		}
		mounted.flushFrame();

		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.magneticUpdates).toEqual([]);
		expect(mounted.onDrop).not.toHaveBeenCalled();
	});

	it("restores interaction state when a presentation owner hands an actor back", () => {
		const mounted = mountController();

		Effect.runSync(mounted.controller.detachActorFx(mounted.actor));
		mounted.actor.container.eventMode = "none";
		mounted.actor.container.cursor = "default";
		Effect.runSync(mounted.controller.attachActorFx(mounted.actor));

		expect(mounted.actor.container.eventMode).toBe("static");
		expect(mounted.actor.container.cursor).toBe("grab");
		expect(mounted.actor.onPointerDown).not.toBeNull();
	});

	it("acknowledges activation synchronously before async command admission", () => {
		const mounted = mountController();
		mounted.onActivate.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));

		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.actor.activityParticles.feedbackPhase).toBe("burst");
		expect(mounted.presentationWrites).toContainEqual({
			actor: mounted.actor,
			channel: "activity-particles",
			reset: true,
			visible: true,
		});
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "activity-particles",
				durationMs: 720,
				ownerKey: `activity-particles:${mounted.actor.instanceId}`,
			}),
		);
		const burst = mounted.animations.find(
			(animation) =>
				animation.actor === mounted.actor && animation.channel === "activity-particles",
		);
		if (burst?.channel === "activity-particles") burst.render(0.5);
		const tint = mounted.actor.activityParticles.particles[0]?.particle.tint ?? 0;
		const red = (tint >> 16) & 0xff;
		const green = (tint >> 8) & 0xff;
		const blue = tint & 0xff;
		expect(green).toBeGreaterThan(blue);
		expect(blue).toBeGreaterThan(red);
	});

	it("opens Item Detail with right click and requests a stack split with Shift+left click", async () => {
		const { actorEvents, onActivate, stage } = mountController();
		const rightClick = pointer(10, 20, 2);
		actorEvents.emit("pointerdown", rightClick);
		stage.emit("pointerup", rightClick);
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledWith(item, "detail", expect.anything());

		const shiftedLeftClick = pointer(10, 20);
		shiftedLeftClick.shiftKey = true;
		actorEvents.emit("pointerdown", shiftedLeftClick);
		stage.emit("pointerup", shiftedLeftClick);
		await flushMicrotasks();

		expect(onActivate).toHaveBeenLastCalledWith(item, "split-stack", expect.anything());
	});

	it("captures exactly Ctrl+primary as one fill activation at release", async () => {
		const mounted = mountController();
		const controlClick = pointer(10, 20);
		controlClick.ctrlKey = true;

		mounted.actorEvents.emit("pointerdown", controlClick);
		mounted.stage.emit("pointerup", pointer(10, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledExactlyOnceWith(
			item,
			"fill-default-line-queue",
			expect.anything(),
		);

		const controlDrag = pointer(10, 20);
		controlDrag.ctrlKey = true;
		mounted.actorEvents.emit("pointerdown", controlDrag);
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledOnce();
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});

	it("does not alias additional modifiers to the Ctrl-click fill action", async () => {
		const mounted = mountController();
		const controlMetaClick = pointer(10, 20);
		controlMetaClick.ctrlKey = true;
		controlMetaClick.metaKey = true;
		mounted.actorEvents.emit("pointerdown", controlMetaClick);
		mounted.stage.emit("pointerup", pointer(10, 20));
		await flushMicrotasks();

		const controlShiftClick = pointer(10, 20);
		controlShiftClick.ctrlKey = true;
		controlShiftClick.shiftKey = true;
		mounted.actorEvents.emit("pointerdown", controlShiftClick);
		mounted.stage.emit("pointerup", pointer(10, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenNthCalledWith(1, item, "primary", expect.anything());
		expect(mounted.onActivate).toHaveBeenNthCalledWith(
			2,
			item,
			"split-stack",
			expect.anything(),
		);
	});

	it("allows click activation without taking transform ownership during canonical motion", async () => {
		const mounted = mountController({
			interactionClaimByActorId: new Map([
				[
					item.id,
					"handoff",
				],
			]),
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(13, 23));
		mounted.stage.emit("pointerup", pointer(13, 23));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledWith(item, "primary", expect.anything());
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.cancelAnimation).toHaveBeenCalledExactlyOnceWith(
			`activity-particles:${mounted.actor.instanceId}`,
		);
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.finishCursorGrab).not.toHaveBeenCalled();
		expect(mounted.magneticUpdates).toHaveLength(0);
		expect(mounted.transientActorLayer.addChild).not.toHaveBeenCalled();
		expect(mounted.actor.container.x).toBe(10);
		expect(mounted.actor.container.y).toBe(20);
		expect(mounted.beginInteractionHandoff).not.toHaveBeenCalled();
	});

	it("supersedes canonical motion at drag threshold without jumping from the live pose", async () => {
		const mounted = mountController({
			interactionClaimByActorId: new Map([
				[
					item.id,
					"handoff",
				],
			]),
		});
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.actor.container.x = 42;
		mounted.actor.container.y = 34;
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();

		expect(mounted.beginInteractionHandoff).toHaveBeenCalledWith(item.id);
		expect(mounted.actor.dragging).toBe(true);
		expect(mounted.actor.container.x).toBe(42);
		expect(mounted.actor.container.y).toBe(34);
		expect(mounted.startCursorGrab).toHaveBeenCalledExactlyOnceWith(mounted.actor, {
			x: 30,
			y: 20,
		});

		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();
		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});

	it("does not count the first pointer movement twice when settling a regular pickup", () => {
		const mounted = mountController();

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(210, 120));
		mounted.flushFrame();

		expect(mounted.actor.container.x).toBe(210);
		expect(mounted.actor.container.y).toBe(120);
		expect(mounted.startCursorGrab).toHaveBeenCalledExactlyOnceWith(mounted.actor, {
			x: 10,
			y: 20,
		});
	});

	it.each([
		"move",
		"swap",
	] as const)("keeps the grab cursor while a %s is being submitted", async (kind) => {
		const mounted = mountController();
		previewState.kind = kind;
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));

		expect(mounted.actor.container.cursor).toBe("grab");
		await flushMicrotasks();
	});

	it("does not reinterpret a failed motion handoff drag as a click", async () => {
		const claims = new Map<string, "activation-only" | "handoff">([
			[
				item.id,
				"handoff",
			],
		]);
		const mounted = mountController({
			interactionClaimByActorId: claims,
		});
		mounted.beginInteractionHandoff.mockReturnValueOnce(false);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		claims.set(item.id, "activation-only");
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
	});

	it.each([
		"spawn",
		"swap",
	] as const)("does not promote an exiting actor when %s completes between press and drag threshold", async () => {
		const claims = new Map<string, "activation-only" | "handoff">([
			[
				item.id,
				"handoff",
			],
		]);
		const mounted = mountController({
			interactionClaimByActorId: claims,
		});
		mounted.beginInteractionHandoff.mockReturnValueOnce(false);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		claims.delete(item.id);
		mounted.actors.delete(item.id);
		mounted.canonicalItems.delete(item.id);
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.beginInteractionHandoff).not.toHaveBeenCalled();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.transientActorLayer.addChild).not.toHaveBeenCalled();
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).not.toHaveBeenCalled();
	});

	it("leaves an active motion cue intact when its canonical actor disappears after press", async () => {
		const claims = new Map<string, "activation-only" | "handoff">([
			[
				item.id,
				"handoff",
			],
		]);
		const mounted = mountController({
			interactionClaimByActorId: claims,
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.canonicalItems.delete(item.id);
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.actors.get(item.id)).toBe(mounted.actor);
		expect(claims.get(item.id)).toBe("handoff");
		expect(mounted.beginInteractionHandoff).not.toHaveBeenCalled();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).not.toHaveBeenCalled();
	});

	it("admits click activation while a presentation claim keeps the actor non-draggable", async () => {
		const claims = new Map<string, "activation-only" | "handoff">([
			[
				item.id,
				"activation-only",
			],
		]);
		const mounted = mountController({
			interactionClaimByActorId: claims,
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));
		await flushMicrotasks();
		expect(mounted.onActivate).toHaveBeenCalledOnce();

		claims.delete(item.id);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledTimes(2);
	});

	it("cancels drag intent without mutating a presentation-retained actor", async () => {
		const mounted = mountController({
			interactionClaimByActorId: new Map([
				[
					item.id,
					"activation-only",
				],
			]),
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.cancelAnimation).not.toHaveBeenCalled();
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.transientActorLayer.addChild).not.toHaveBeenCalled();
	});

	it("activates the latest projected item and immediately admits another click", async () => {
		const mounted = mountController();
		let resolveFirstActivation: (() => void) | undefined;
		mounted.onActivate.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveFirstActivation = resolve;
				}),
		);
		const completedInstantRun = {
			...item,
			revision: "revision:log:instant-complete",
			running: false,
		} satisfies TileActorItem;

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));
		mounted.setItem(completedInstantRun);
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledWith(
			completedInstantRun,
			"primary",
			expect.anything(),
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledTimes(2);
		resolveFirstActivation?.();
	});

	it("submits on pointer release and retains the exact pending actor until resolution", () => {
		const mounted = mountController();
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));

		expect(mounted.onDrop).toHaveBeenCalledOnce();
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);
	});

	it("starts Inventory removal and receiver particles together before the drop Promise resolves", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		const inventoryActor = {
			activityParticles: createActivityParticles(),
			container: {
				destroyed: false,
			},
			instanceId: `test:${inventory.id}`,
			item: inventory,
		} as unknown as PixiTileActor;
		mounted.actors.set(inventory.id, inventoryActor);
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
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));

		expect(mounted.actor.lifecycleIntentGeneration).toBe(1);
		expect(mounted.actor.lifecycleTargetAlpha).toBe(0);
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "lifecycle-opacity",
				durationMs: 260,
				ownerKey: `actor-alpha:${mounted.actor.instanceId}`,
				toAlpha: 0,
			}),
		);
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: inventoryActor,
				channel: "activity-particles",
				durationMs: 720,
				ownerKey: `activity-particles:${inventoryActor.instanceId}`,
			}),
		);
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);
		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();

		resolveDrop({
			inventory: {
				itemId: inventory.id,
				location: inventory.location,
				revision: inventory.revision,
			},
			kind: "store-inventory",
			source: {
				canonicalItemId: item.itemId,
				current: null,
				itemId: item.id,
				previousLocation: item.location,
				previousQuantity: item.quantity,
				previousRevision: item.revision,
			},
		});
		await flushMicrotasks();

		expect(mounted.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(mounted.targetRedirects).toEqual([
			{
				sourceActorId: item.id,
				targetActorId: inventory.id,
				targetLocation: inventory.location,
			},
		]);
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).feedback).toEqual([]);
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
	});

	it("rebases a held stack to its latest canonical revision before an Inventory release", () => {
		const inventory = {
			...createItem("runtime:inventory", 1),
			itemType: "inventory",
		} as TileActorItem;
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
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
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		const canonicalStack = {
			...item,
			quantity: 2,
			revision: "revision:log:incoming-stacked",
		} satisfies TileActorItem;
		mounted.canonicalItems.set(item.id, canonicalStack);
		mounted.setItem({
			...canonicalStack,
			// The incoming payload remains visually hidden until physical contact.
			quantity: 1,
		});
		mounted.stage.emit("pointerup", pointer(30, 20));

		expect(mounted.onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: item.id,
				sourceLocation: item.location,
				sourceRevision: canonicalStack.revision,
			}),
		);
		expect(
			mounted.animations.some(
				(animation) =>
					animation.actor === mounted.actor &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 0,
			),
		).toBe(true);
	});

	it("sends a held item to the physical Inventory with i and retains it through travel and fade", async () => {
		const inventory = {
			...createItem("runtime:inventory", 2),
			itemType: "inventory",
		} as TileActorItem;
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		const inventoryActor = mounted.actors.get(inventory.id);
		if (inventoryActor === undefined) throw new Error("Expected the Inventory actor.");
		mounted.setItemActorPose(inventory.id, {
			layer: mounted.transientActorLayer,
			size: 80,
			x: 170,
			y: 20,
		});
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
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const keyEvent = keyboard("i");
		mounted.keyboardTarget.emit(keyEvent);

		expect(keyEvent.preventDefault).toHaveBeenCalledOnce();
		expect(keyEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.onDrop).toHaveBeenCalledOnce();
		expect(mounted.onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				target: {
					kind: "slot",
					location: inventory.location,
					occupant: {
						itemId: inventory.id,
						revision: inventory.revision,
					},
				},
			}),
		);
		const travel = mounted.animations.find(
			(animation) =>
				animation.channel === "pose" &&
				animation.ownerKey === `inventory-shortcut-travel:${mounted.actor.instanceId}`,
		);
		expect(travel).toBeDefined();
		expect(
			mounted.animations.some((animation) => animation.channel === "lifecycle-opacity"),
		).toBe(false);

		resolveDrop({
			inventory: {
				itemId: inventory.id,
				location: inventory.location,
				revision: inventory.revision,
			},
			kind: "store-inventory",
			source: {
				canonicalItemId: item.itemId,
				current: null,
				itemId: item.id,
				previousLocation: item.location,
				previousQuantity: item.quantity,
				previousRevision: item.revision,
			},
		});
		await flushMicrotasks();

		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
		expect(mounted.targetRedirects).toEqual([
			{
				sourceActorId: item.id,
				targetActorId: inventory.id,
				targetLocation: inventory.location,
			},
		]);
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);

		travel?.onComplete?.();
		const fade = mounted.animations.find(
			(animation) =>
				animation.actor === mounted.actor && animation.channel === "lifecycle-opacity",
		);
		expect(fade).toEqual(
			expect.objectContaining({
				durationMs: 260,
				toAlpha: 0,
			}),
		);
		expect(
			mounted.animations.some(
				(animation) =>
					animation.actor === inventoryActor &&
					animation.channel === "activity-particles",
			),
		).toBe(true);
		fade?.onComplete?.();

		expect(mounted.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set(),
		);
		expect(mounted.actor.dragging).toBe(false);
		fade?.onCancel?.();
		expect(mounted.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(mounted.targetRedirects).toHaveLength(1);
	});

	it("consumes i and leaves an active drag untouched when Inventory storage is unavailable", () => {
		const mounted = mountController();

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const keyEvent = keyboard("i");
		mounted.keyboardTarget.emit(keyEvent);

		expect(keyEvent.preventDefault).toHaveBeenCalledOnce();
		expect(keyEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.actor.dragging).toBe(true);

		mounted.stage.emit("pointerup", pointer(30, 20));
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});

	it("removes the held item through the Cheat command with d when this Game enabled cheats", async () => {
		const mounted = mountController({
			cheatsEnabled: true,
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const keyEvent = keyboard("d");
		mounted.keyboardTarget.emit(keyEvent);
		await flushMicrotasks();

		expect(keyEvent.preventDefault).toHaveBeenCalledOnce();
		expect(keyEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
		expect(mounted.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(mounted.removeDraggedItem).toHaveBeenCalledWith({
			game: expect.anything(),
			itemId: item.id,
			revision: item.revision,
		});
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.actor.dragging).toBe(false);
	});

	it("leaves d unclaimed and the held item untouched when this Game disabled cheats", () => {
		const mounted = mountController();

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		const keyEvent = keyboard("d");
		mounted.keyboardTarget.emit(keyEvent);

		expect(keyEvent.preventDefault).not.toHaveBeenCalled();
		expect(keyEvent.stopImmediatePropagation).not.toHaveBeenCalled();
		expect(mounted.removeDraggedItem).not.toHaveBeenCalled();
		expect(mounted.actor.dragging).toBe(true);

		mounted.stage.emit("pointerup", pointer(30, 20));
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});

	it("starts a one-item stack exit at release and keeps it hidden after full consumption", async () => {
		const target = createItem("runtime:target-log", 1);
		const mounted = mountController({
			targetItems: [
				target,
			],
		});
		previewState.actorKinds.set(target.id, "stack");
		mounted.setOccupant(target);
		mounted.setCommandTarget({
			kind: "slot",
			location: target.location,
			occupant: {
				itemId: target.id,
				revision: target.revision,
			},
		});
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));

		expect(mounted.actor.lifecycleTargetAlpha).toBe(0);
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "lifecycle-opacity",
				toAlpha: 0,
			}),
		);

		resolveDrop({
			kind: "stack",
			transferredQuantity: 1,
			source: {
				canonicalItemId: item.itemId,
				current: null,
				itemId: item.id,
				previousLocation: item.location,
				previousQuantity: 1,
				previousRevision: item.revision,
			},
			target: {
				canonicalItemId: target.itemId,
				current: {
					canonicalItemId: target.itemId,
					itemId: target.id,
					location: target.location,
					quantity: 2,
					revision: "revision:target-stacked",
				},
				itemId: target.id,
				previousLocation: target.location,
				previousQuantity: 1,
				previousRevision: target.revision,
			},
		});
		await flushMicrotasks();

		expect(mounted.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(mounted.targetRedirects).toEqual([
			{
				sourceActorId: item.id,
				targetActorId: target.id,
				targetLocation: target.location,
			},
		]);
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).hiddenActorIds).toEqual(
			new Set([
				item.id,
			]),
		);
	});

	it("releases the board gesture while an Inventory drop is still pending", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const secondItem = createItem("runtime:second-log", 2);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
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
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		const pendingSourcePointer = pointer(10, 20);
		mounted.actorEvents.emit("pointerdown", pendingSourcePointer);
		expect(pendingSourcePointer.stopPropagation).not.toHaveBeenCalled();

		const secondEvents = new FakeEmitter();
		const secondContainer = Object.assign(secondEvents, {
			cursor: "grab",
			destroyed: false,
			pivot: {
				x: 0,
				y: 0,
			},
			position: {
				set(x: number, y: number) {
					secondContainer.x = x;
					secondContainer.y = y;
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
			x: 170,
			y: 20,
			zIndex: 0,
		});
		const secondActor = {
			activityParticles: createActivityParticles(),
			container: secondContainer,
			dragging: false,
			instanceId: `test:${secondItem.id}`,
			item: secondItem,
			lifecycleFadeStarted: false,
			lifecycleIntentGeneration: 0,
			lifecycleTargetAlpha: 1,
			onPointerDown: null,
			size: 80,
		} as unknown as PixiTileActor;
		mounted.actors.set(secondItem.id, secondActor);
		mounted.canonicalItems.set(secondItem.id, secondItem);
		Effect.runSync(mounted.controller.attachActorFx(secondActor));

		const secondPointer = {
			...pointer(170, 20),
			pointerId: 2,
		};
		secondEvents.emit("pointerdown", secondPointer);
		expect(secondPointer.stopPropagation).toHaveBeenCalledOnce();
		mounted.stage.emit("globalpointermove", {
			...pointer(190, 20),
			pointerId: 2,
		});
		mounted.flushFrame();
		expect(secondActor.dragging).toBe(true);
		mounted.stage.emit("pointerup", {
			...pointer(190, 20),
			pointerId: 2,
		});
		await flushMicrotasks();

		expect(mounted.onDrop).toHaveBeenCalledTimes(2);
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);
	});

	it("restores only the surviving optimistic Inventory actor after a rejected drop", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
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
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		resolveDrop({
			kind: "reject",
		} as runTileDropAtom.Result);
		await flushMicrotasks();

		expect(mounted.actor.lifecycleIntentGeneration).toBe(2);
		expect(mounted.actor.lifecycleTargetAlpha).toBe(1);
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "lifecycle-opacity",
				durationMs: 160,
				ownerKey: `actor-alpha:${mounted.actor.instanceId}`,
				toAlpha: 1,
			}),
		);
		expect(
			mounted.animations.some(
				(animation) => animation.actor === mounted.actor && animation.channel === "pose",
			),
		).toBe(true);
	});

	it("restores the optimistic Inventory fade after an ignored result", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
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
		mounted.onDrop.mockResolvedValueOnce({
			kind: "ignored",
		} as never);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.actor.lifecycleTargetAlpha).toBe(1);
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "lifecycle-opacity",
				durationMs: 160,
				toAlpha: 1,
			}),
		);
		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
	});

	it("restores and settles the optimistic Inventory actor after a command error", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
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
		const cause = new Error("drop failed");
		mounted.onDrop.mockRejectedValueOnce(cause);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();

		expect(mounted.reportCriticalFailure).toHaveBeenCalledWith("game-presentation", cause);
		expect(mounted.actor.lifecycleTargetAlpha).toBe(1);
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "lifecycle-opacity",
				durationMs: 160,
				toAlpha: 1,
			}),
		);
		expect(
			mounted.animations.some(
				(animation) => animation.actor === mounted.actor && animation.channel === "pose",
			),
		).toBe(true);
	});

	it("does not let a stale rejected result restore a superseded actor lifecycle", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
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
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		mounted.actor.lifecycleIntentGeneration += 1;
		mounted.actor.lifecycleTargetAlpha = 0;
		resolveDrop({
			kind: "reject",
		} as runTileDropAtom.Result);
		await flushMicrotasks();

		expect(mounted.actor.lifecycleIntentGeneration).toBe(2);
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
	});

	it("does not let a stale drop callback touch a replacement actor instance", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
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
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		const replacement = {
			...mounted.actor,
			dragging: true,
			instanceId: "test:replacement",
		} satisfies PixiTileActor;
		mounted.actors.set(item.id, replacement);
		resolveDrop({
			kind: "reject",
		} as runTileDropAtom.Result);
		await flushMicrotasks();

		expect(replacement.dragging).toBe(true);
		expect(mounted.animations.some((animation) => animation.actor === replacement)).toBe(false);
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
	});

	it("ignores a pending Inventory result after the scene owners close", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController();
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
		let resolveDrop!: (result: runTileDropAtom.Result) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<runTileDropAtom.Result>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));
		await Promise.resolve();
		expect(mounted.onDrop).toHaveBeenCalledOnce();
		Effect.runSync(mounted.controller.closeFx);
		Effect.runSync(mounted.dropSubmission.closeFx);
		resolveDrop({
			kind: "reject",
		} as runTileDropAtom.Result);
		await flushMicrotasks();

		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
	});

	it("freezes the command target and admits it before a later close", async () => {
		const first = mountController();
		const releaseTarget = {
			kind: "unsupported" as const,
		};
		first.setCommandTarget(releaseTarget);
		first.actorEvents.emit("pointerdown", pointer(10, 20));
		first.stage.emit("globalpointermove", pointer(30, 20));
		first.stage.emit("pointerup", pointer(30, 20));
		first.setCommandTarget({
			kind: "unsupported",
		});
		await flushMicrotasks();

		expect(first.onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				target: releaseTarget,
			}),
		);
		expect(first.onAcceptedDrop).toHaveBeenCalledOnce();
		expect(first.actor.dragging).toBe(false);
		expect(first.actor.container.zIndex).toBe(0);

		const second = mountController();
		second.actorEvents.emit("pointerdown", pointer(10, 20));
		second.stage.emit("globalpointermove", pointer(30, 20));
		second.stage.emit("pointerup", pointer(30, 20));
		Effect.runSync(second.controller.closeFx);
		Effect.runSync(second.dropSubmission.closeFx);
		await flushMicrotasks();
		expect(second.onDrop).toHaveBeenCalledOnce();
		expect(second.onAcceptedDrop).not.toHaveBeenCalled();
	});

	it("settles a rejected release from its exact pose", async () => {
		const mounted = mountController();
		const canonicalLayer = {
			addChild: vi.fn(),
		};
		mounted.setActorPose({
			layer: canonicalLayer,
			size: 80,
			x: 10,
			y: 20,
		});
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.flushFrame();

		mounted.onDrop.mockResolvedValueOnce({
			kind: "reject",
		} as never);
		mounted.stage.emit("pointerup", pointer(45, 20));
		await flushMicrotasks();

		const settleAnimation = mounted.animations.at(-1);
		if (settleAnimation === undefined) throw new Error("Expected a settle animation.");
		expect(settleAnimation).toMatchObject({
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
		});
		expect(settleAnimation.durationMs).toBeLessThan(280);
		expect(mounted.transientActorLayer.addChild).toHaveBeenLastCalledWith(
			mounted.actor.container,
		);
		expect(canonicalLayer.addChild).not.toHaveBeenCalled();
		samplePoseAnimation(settleAnimation, 1);
		settleAnimation.onComplete?.();
		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
		expect(canonicalLayer.addChild).toHaveBeenCalledOnce();
		expect(canonicalLayer.addChild).toHaveBeenCalledWith(mounted.actor.container);
		expect(mounted.actor.container.x).toBe(10);
		expect(mounted.actor.container.y).toBe(20);
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.actor.container.zIndex).toBe(0);
		expect(mounted.actor.container.cursor).toBe("grab");
	});

	it.each([
		"ignored",
		"move",
		"reject",
		"swap",
	] as const)("keeps one grabbing cursor anywhere inside the Board for %s preview", (kind) => {
		const mounted = mountController();
		previewState.kind = kind;

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.flushFrame();

		expect(mounted.actor.dragging).toBe(true);
		expect(mounted.actor.container.cursor).toBe("grabbing");
	});

	it.each([
		"move",
		"reject",
	] as const)("keeps one grabbing cursor over a Toolbar target for %s preview", (kind) => {
		const mounted = mountController();
		previewState.kind = kind;
		mounted.setTargetKind("toolbar");

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.flushFrame();

		expect(mounted.actor.container.cursor).toBe("grabbing");
	});

	it("uses not-allowed only when no main-scene drop target exists", () => {
		const mounted = mountController();
		previewState.kind = "move";
		mounted.setTargetKind(null);

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.flushFrame();

		expect(mounted.actor.container.cursor).toBe("not-allowed");
	});

	it("retargets a running settle from its live frame without a resize or completion snap", async () => {
		const mounted = mountController();
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.onDrop.mockResolvedValueOnce({
			kind: "reject",
		} as never);
		mounted.stage.emit("pointerup", pointer(45, 20));
		await flushMicrotasks();

		const settleAnimation = mounted.animations.at(-1);
		if (settleAnimation === undefined) throw new Error("Expected a settle animation.");
		const beforeResize = samplePoseAnimation(settleAnimation, 0.4);
		expect(beforeResize).toEqual({
			scale: 1,
			x: 31,
			y: 20,
		});

		mounted.setActorPose({
			layer: mounted.transientActorLayer,
			size: 120,
			x: 200,
			y: 100,
		});
		expect(samplePoseAnimation(settleAnimation, 0.4)).toEqual(beforeResize);
		const afterResize = samplePoseAnimation(settleAnimation, 0.7);
		expect(afterResize.scale).toBeCloseTo(1.25);
		expect(afterResize.x).toBeCloseTo(115.5);
		expect(afterResize.y).toBeCloseTo(60);
		const destination = samplePoseAnimation(settleAnimation, 1);
		expect(destination).toEqual({
			scale: 1.5,
			x: 200,
			y: 100,
		});
		settleAnimation.onComplete?.();
		expect(mounted.actor.container).toMatchObject({
			x: destination.x,
			y: destination.y,
		});
		expect(mounted.actor.container.scale.x).toBe(destination.scale);
	});

	it("derives neutral responders from engine previews before attracting the hovered target", () => {
		const eligible = createItem("runtime:eligible", 1);
		const invalid = createItem("runtime:invalid", 2);
		const mounted = mountController({
			targetItems: [
				eligible,
				invalid,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		previewState.actorKinds.set(invalid.id, "swap");
		mounted.setDropTargetX(3);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();

		expect(mounted.magneticUpdates[0]?.attractedActorId).toBeNull();
		expect(Array.from(mounted.magneticUpdates[0]?.eligibleAttractionActorIds ?? [])).toEqual([
			eligible.id,
		]);

		mounted.setDropTargetX(1);
		mounted.setOccupant(eligible);
		mounted.setCommandTarget({
			kind: "slot",
			location: eligible.location,
			occupant: {
				itemId: eligible.id,
				revision: eligible.revision,
			},
		});
		mounted.stage.emit("globalpointermove", pointer(40, 20));
		mounted.flushFrame();

		expect(mounted.magneticUpdates[1]?.attractedActorId).toBe(eligible.id);
		expect(
			Array.from(mounted.magneticUpdates.at(-1)?.eligibleAttractionActorIds ?? []),
		).toEqual([
			eligible.id,
		]);
	});

	it("coalesces a stationary drag refresh when a compatible motion source enters", () => {
		const moving = createItem("runtime:moving", 8);
		const mounted = mountController({
			targetItems: [
				moving,
			],
		});
		previewState.actorKinds.set(moving.id, "merge");
		mounted.setLocalActorIds([]);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(previewState.readsByActorId.get(moving.id)).toBeUndefined();

		const targetReadCount = mounted.dropTargetReads.length;
		mounted.stage.emit("globalpointermove", pointer(35, 20));
		mounted.stage.emit("globalpointermove", pointer(40, 20));
		mounted.setActiveMagneticSourceActorIds([
			moving.id,
		]);
		mounted.triggerSourceMembership("motion");
		mounted.flushFrame();

		expect(mounted.dropTargetReads).toHaveLength(targetReadCount + 1);
		expect(previewState.readsByActorId.get(moving.id)).toBe(1);
		expect(
			Array.from(mounted.magneticUpdates.at(-1)?.eligibleAttractionActorIds ?? []),
		).toContain(moving.id);
	});

	it("requests a padded live-source neighborhood and always includes the exact target", () => {
		const eligible = createItem("runtime:eligible", 8);
		const moving = createItem("runtime:moving", 9);
		const mounted = mountController({
			targetItems: [
				eligible,
				moving,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		previewState.actorKinds.set(moving.id, "merge");
		mounted.setLocalActorIds([]);
		mounted.setActiveMagneticSourceActorIds([
			item.id,
			moving.id,
		]);
		mounted.setOccupant(eligible);
		mounted.setCommandTarget({
			kind: "slot",
			location: eligible.location,
			occupant: {
				itemId: eligible.id,
				revision: eligible.revision,
			},
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();

		expect(mounted.localActorReads).toEqual([
			{
				excludeActorId: item.id,
				height: 80,
				paddingRatio: 1.5,
				width: 80,
				x: 30,
				y: 20,
			},
		]);
		expect(mounted.magneticUpdates[0]?.candidateActorIds).toEqual([
			moving.id,
			eligible.id,
		]);
		expect(mounted.flushMagneticField).toHaveBeenCalledOnce();
	});

	it("caches positive and negative local eligibility, then prunes actors that leave", () => {
		const eligible = createItem("runtime:eligible", 1);
		const invalid = createItem("runtime:invalid", 2);
		const mounted = mountController({
			targetItems: [
				eligible,
				invalid,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		previewState.actorKinds.set(invalid.id, "swap");
		mounted.setLocalActorIds([
			eligible.id,
			invalid.id,
		]);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));

		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		mounted.stage.emit("globalpointermove", pointer(31, 20));
		mounted.flushFrame();
		expect(previewState.readsByActorId.get(eligible.id)).toBe(1);
		expect(previewState.readsByActorId.get(invalid.id)).toBe(1);

		mounted.setLocalActorIds([
			invalid.id,
		]);
		mounted.stage.emit("globalpointermove", pointer(32, 20));
		mounted.flushFrame();
		mounted.setLocalActorIds([
			eligible.id,
		]);
		mounted.stage.emit("globalpointermove", pointer(33, 20));
		mounted.flushFrame();

		expect(previewState.readsByActorId.get(eligible.id)).toBe(2);
		expect(previewState.readsByActorId.get(invalid.id)).toBe(1);
	});

	it("does not cache a failed local eligibility preview", () => {
		const eligible = createItem("runtime:eligible", 1);
		const mounted = mountController({
			targetItems: [
				eligible,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		previewState.failureActorIds.add(eligible.id);
		mounted.setLocalActorIds([
			eligible.id,
		]);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.reportCriticalFailure).toHaveBeenCalledOnce();

		previewState.failureActorIds.delete(eligible.id);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(31, 20));
		mounted.flushFrame();

		expect(previewState.readsByActorId.get(eligible.id)).toBe(2);
		expect(
			Array.from(mounted.magneticUpdates.at(-1)?.eligibleAttractionActorIds ?? []),
		).toEqual([
			eligible.id,
		]);
	});

	it("refreshes a stationary pointer target when its canonical identity changes", () => {
		const eligible = createItem("runtime:eligible", 1);
		const mounted = mountController({
			targetItems: [
				eligible,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(mounted.magneticUpdates[0]?.attractedActorId).toBeNull();

		mounted.setOccupant(eligible);
		mounted.setCommandTarget({
			kind: "slot",
			location: eligible.location,
			occupant: {
				itemId: eligible.id,
				revision: eligible.revision,
			},
		});
		Effect.runSync(mounted.controller.requestRefreshFx);
		mounted.flushFrame();

		expect(mounted.magneticUpdates[1]?.attractedActorId).toBe(eligible.id);
	});

	it("reports an accepted replay failure without misclassifying it as command failure", async () => {
		const mounted = mountController();
		const failure = new Error("replay failed");
		mounted.onAcceptedDrop.mockImplementationOnce(() => {
			throw failure;
		});
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.stage.emit("pointerup", pointer(45, 20));
		await flushMicrotasks();

		expect(mounted.reportCriticalFailure).toHaveBeenCalledWith("game-presentation", failure);
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});
});
