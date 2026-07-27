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
import { createPixiMainSceneDropPresentationFx } from "~/ui/pixi/drop/createPixiMainSceneDropPresentationFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

const previewState = vi.hoisted(() => ({
	actorKinds: new Map<
		string,
		"merge" | "move" | "reject" | "stack" | "store-input" | "store-inventory" | "swap"
	>(),
	kind: "move" as "ignored" | "move" | "reject" | "store-inventory" | "swap",
}));

vi.mock("~/bridge/tile/readTileDropPreviewFx", () => ({
	readTileDropPreviewFx: ({ target }: { readonly target: runTileDropAtom.Command["target"] }) =>
		Effect.succeed({
			kind:
				target.kind === "slot" && target.occupant !== null
					? (previewState.actorKinds.get(target.occupant.itemId) ?? previewState.kind)
					: previewState.kind,
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

interface FakePointerEvent {
	button: number;
	global: {
		x: number;
		y: number;
	};
	isPrimary: boolean;
	pointerId: number;
	shiftKey: boolean;
	stopPropagation: () => void;
}

const pointer = (x: number, y: number, shiftKey = false): FakePointerEvent => ({
	button: 0,
	global: {
		x,
		y,
	},
	isPrimary: true,
	pointerId: 1,
	shiftKey,
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

const createRunningGlow = () => ({
	alpha: 0,
	tint: 0xf05bb8,
	visible: false,
});

const mountController = ({
	interactionClaimByActorId = new Map(),
	targetItems = [],
}: {
	readonly interactionClaimByActorId?: ReadonlyMap<string, "activation-only" | "handoff">;
	readonly targetItems?: ReadonlyArray<TileActorItem>;
} = {}) => {
	previewState.kind = "move";
	previewState.actorKinds.clear();
	const actorEvents = new FakeEmitter();
	const stage = new FakeEmitter();
	const animateActor = vi.fn();
	const cancelAnimation = vi.fn();
	const cancelChannel = vi.fn();
	const finishCursorGrab = vi.fn();
	const startCursorGrab = vi.fn();
	const animations: PixiActorAnimation[] = [];
	const presentationWrites: PixiActorPresentationWrite[] = [];
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
		container: actorContainer,
		dragging: false,
		feedbackGlowPhase: null,
		instanceId: `test:${item.id}`,
		item,
		lifecycleFadeStarted: false,
		lifecycleIntentGeneration: 0,
		lifecycleTargetAlpha: 1,
		onPointerDown: null,
		runningGlow: createRunningGlow(),
		size: 80,
		workingGlowTint: 0xf05bb8,
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
			container: {
				destroyed: false,
			},
			feedbackGlowPhase: null,
			instanceId: `test:${targetItem.id}`,
			item: targetItem,
			runningGlow: createRunningGlow(),
			workingGlowTint: 0xf05bb8,
		} as PixiTileActor);
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
	let currentDropTargetX = 1;
	let currentOccupant: TileActorItem | null = null;
	const magneticUpdates: Array<Parameters<PixiTileMagneticField["updateFx"]>[0]> = [];
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
	const controller = Effect.runSync(
		createPixiMainSceneDragControllerFx({
			actorStore: {
				actors,
				canonicalItems,
			} as unknown as PixiMainSceneActorStore,
			animator: {
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
				setFx: (write) =>
					Effect.sync(() => {
						presentationWrites.push(write);
						if (write.channel !== "pose") return;
						write.actor.container.position.set(write.x, write.y);
						if (write.scale !== undefined) {
							write.actor.container.scale.set(write.scale);
						}
					}),
			} satisfies PixiActorAnimator,
			application: {
				app: {
					canvas: {
						releasePointerCapture,
						setPointerCapture: vi.fn(),
					},
				},
				frames: {
					invalidateFx: Effect.void,
				},
				stage,
			} as unknown as PixiApplicationOwner,
			cursorGrab: {
				closeFx: Effect.void,
				finishFx: () => Effect.sync(finishCursorGrab),
				startFx: () => Effect.sync(startCursorGrab),
			} satisfies PixiCursorGrabMotion,
			dropPresentation,
			game: {
				reportCriticalFailure,
			} as never,
			magneticField: {
				closeFx: Effect.void,
				pruneFx: Effect.void,
				releaseFx: () => Effect.void,
				resetFx: Effect.void,
				updateFx: (sample) =>
					Effect.sync(() => {
						magneticUpdates.push(sample);
					}),
			} satisfies PixiTileMagneticField,
			motion: {
				beginInteractionHandoffFx: (actorId) =>
					Effect.sync(() => beginInteractionHandoff(actorId)),
				closeFx: Effect.void,
				enqueueFx: () => Effect.void,
				readSnapshotFx: Effect.succeed({
					interactionClaimByActorId,
					retainedActorIds: new Set(interactionClaimByActorId.keys()),
					spawnCueByActorId: new Map(),
					unsettledInputSourceQuantities: new Map(),
					unsettledQuantities: new Map(),
				}),
				startFx: Effect.void,
				syncQuantitiesFx: Effect.void,
			} satisfies PixiTileMotionRuntime,
			onAcceptedDrop,
			onActivate,
			onDrop: onDrop as never,
			readAckTint: () => 0x57d7b2,
			surface: {
				readActorPoseFx: () => Effect.succeed(currentActorPose),
				readCommandTargetFx: () => Effect.succeed(currentCommandTarget),
				readDropTargetFx: () =>
					Effect.succeed({
						layout: {
							cellSize: 80,
							kind: "board",
							x: 0,
							y: 0,
						},
						x: currentDropTargetX,
						y: 0,
					}),
				readOccupantFx: () => Effect.succeed(currentOccupant),
				renderDropFeedbackFx: () => Effect.void,
				transientActorLayer,
			} as unknown as PixiMainSceneSurface,
		}),
	);
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
		finishCursorGrab,
		magneticUpdates,
		onActivate,
		onAcceptedDrop,
		onDrop,
		presentationWrites,
		releasePointerCapture,
		reportCriticalFailure,
		setActorPose: (pose: typeof currentActorPose) => {
			currentActorPose = pose;
		},
		setCommandTarget: (target: typeof currentCommandTarget) => {
			currentCommandTarget = target;
		},
		setDropTargetX: (x: number) => {
			currentDropTargetX = x;
		},
		setOccupant: (occupant: TileActorItem | null) => {
			currentOccupant = occupant;
		},
		setItem: (nextItem: TileActorItem) => {
			actor.item = nextItem;
		},
		startCursorGrab,
		stage,
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
	it("acknowledges activation synchronously before async command admission", () => {
		const mounted = mountController();
		mounted.onActivate.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("pointerup", pointer(10, 20));

		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.actor.feedbackGlowPhase).toBe("rising");
		expect(mounted.actor.runningGlow.tint).toBe(0x57d7b2);
		expect(mounted.presentationWrites).toContainEqual({
			actor: mounted.actor,
			channel: "glow-opacity",
			visible: true,
		});
		expect(mounted.animations).toContainEqual(
			expect.objectContaining({
				actor: mounted.actor,
				channel: "glow-opacity",
				durationMs: 110,
				ownerKey: `feedback-glow:${mounted.actor.instanceId}`,
				toRunningGlowAlpha: 0.82,
			}),
		);
	});

	it("snapshots Shift at release instead of retaining a pooled Pixi event", async () => {
		const { actorEvents, onActivate, stage } = mountController();
		actorEvents.emit("pointerdown", pointer(10, 20));
		const release = pointer(10, 20, true);
		stage.emit("pointerup", release);
		release.shiftKey = false;
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledWith(item, true, expect.anything());
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

		expect(mounted.onActivate).toHaveBeenCalledWith(item, false, expect.anything());
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.cancelAnimation).toHaveBeenCalledExactlyOnceWith(
			`feedback-glow:${mounted.actor.instanceId}`,
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

		expect(mounted.beginInteractionHandoff).toHaveBeenCalledWith(item.id);
		expect(mounted.actor.dragging).toBe(true);
		expect(mounted.actor.container.x).toBe(42);
		expect(mounted.actor.container.y).toBe(34);
		expect(mounted.startCursorGrab).toHaveBeenCalledOnce();

		mounted.stage.emit("pointerup", pointer(30, 20));
		await flushMicrotasks();
		expect(mounted.onActivate).not.toHaveBeenCalled();
		expect(mounted.onDrop).toHaveBeenCalledOnce();
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
			false,
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

	it("starts Inventory removal and receiver glow together before the drop Promise resolves", async () => {
		const inventory = createItem("runtime:inventory", 1);
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		const inventoryActor = {
			container: {
				destroyed: false,
			},
			feedbackGlowPhase: null,
			instanceId: `test:${inventory.id}`,
			item: inventory,
			runningGlow: createRunningGlow(),
			workingGlowTint: 0xf05bb8,
		} as PixiTileActor;
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
				channel: "glow-opacity",
				durationMs: 110,
				ownerKey: `feedback-glow:${inventoryActor.instanceId}`,
				toRunningGlowAlpha: 0.82,
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
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).feedback).toEqual([]);
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
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
			container: secondContainer,
			dragging: false,
			feedbackGlowPhase: null,
			instanceId: `test:${secondItem.id}`,
			item: secondItem,
			lifecycleFadeStarted: false,
			lifecycleIntentGeneration: 0,
			lifecycleTargetAlpha: 1,
			onPointerDown: null,
			runningGlow: createRunningGlow(),
			size: 80,
			workingGlowTint: 0xf05bb8,
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

	it("ignores a pending Inventory result after the controller closes", async () => {
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
		await flushMicrotasks();
		expect(second.onDrop).toHaveBeenCalledOnce();
		expect(second.onAcceptedDrop).not.toHaveBeenCalled();
	});

	it("refreshes held feedback and settles a rejected release from its exact pose", async () => {
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
		previewState.kind = "reject";
		Effect.runSync(mounted.controller.refreshPreviewFx);
		expect(mounted.actor.container.cursor).toBe("not-allowed");

		mounted.onDrop.mockResolvedValueOnce({
			kind: "reject",
		} as never);
		mounted.stage.emit("pointerup", pointer(45, 20));
		await flushMicrotasks();

		const settleAnimation = mounted.animations.at(-1);
		if (settleAnimation === undefined) throw new Error("Expected a settle animation.");
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

	it("keeps the origin available with a grab cursor during drag", () => {
		const mounted = mountController();
		previewState.kind = "ignored";

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));

		expect(mounted.actor.dragging).toBe(true);
		expect(mounted.actor.container.cursor).toBe("grab");
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

		expect(mounted.magneticUpdates[1]?.attractedActorId).toBe(eligible.id);
		expect(Array.from(mounted.magneticUpdates[1]?.eligibleAttractionActorIds ?? [])).toEqual([
			eligible.id,
		]);
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
