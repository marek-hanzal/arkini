import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiMainSceneDragControllerFx } from "~/ui/pixi/drag/createPixiMainSceneDragControllerFx";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import { createPixiMainSceneDropPresentationFx } from "~/ui/pixi/drop/createPixiMainSceneDropPresentationFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

const previewState = vi.hoisted(() => ({
	actorKinds: new Map<string, "merge" | "move" | "reject" | "stack" | "store-input" | "swap">(),
	kind: "move" as "move" | "reject",
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

const mountController = ({
	interactionClaimByActorId = new Map(),
	targetItems = [],
}: {
	readonly interactionClaimByActorId?: ReadonlyMap<string, "activation-only" | "blocked">;
	readonly targetItems?: ReadonlyArray<TileActorItem>;
} = {}) => {
	previewState.kind = "move";
	previewState.actorKinds.clear();
	const actorEvents = new FakeEmitter();
	const stage = new FakeEmitter();
	const animateActor = vi.fn();
	const cancelAnimation = vi.fn();
	const finishCursorGrab = vi.fn();
	const startCursorGrab = vi.fn();
	const transientActorLayer = {
		addChild: vi.fn(),
	};
	const actor = {
		container: Object.assign(actorEvents, {
			destroyed: false,
			pivot: {
				x: 0,
				y: 0,
			},
			x: 10,
			y: 20,
			zIndex: 0,
		}),
		dragging: false,
		item,
		onPointerDown: null,
		size: 80,
	} as unknown as PixiTileActor;
	const actors = new Map([
		[
			item.id,
			actor,
		],
	]);
	for (const targetItem of targetItems) {
		actors.set(targetItem.id, {
			item: targetItem,
		} as PixiTileActor);
	}
	let currentCommandTarget: runTileDropAtom.Command["target"] = {
		kind: "unsupported" as const,
	};
	let currentDropTargetX = 1;
	let currentOccupant: TileActorItem | null = null;
	const magneticUpdates: Array<Parameters<PixiTileMagneticField["updateFx"]>[0]> = [];
	const onActivate = vi.fn();
	const onAcceptedDrop = vi.fn();
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
			} as unknown as PixiMainSceneActorStore,
			animator: {
				animateFx: (animation) =>
					Effect.sync(() => {
						animateActor(animation);
						animation.actor.container.x = animation.toX ?? animation.actor.container.x;
						animation.actor.container.y = animation.toY ?? animation.actor.container.y;
					}),
				cancelFx: () => Effect.sync(cancelAnimation),
				closeFx: Effect.void,
			} satisfies PixiActorAnimator,
			application: {
				app: {
					canvas: {
						releasePointerCapture: vi.fn(),
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
			game: {} as never,
			magneticField: {
				closeFx: Effect.void,
				pruneFx: Effect.void,
				resetFx: Effect.void,
				updateFx: (sample) =>
					Effect.sync(() => {
						magneticUpdates.push(sample);
					}),
			} satisfies PixiTileMagneticField,
			motion: {
				closeFx: Effect.void,
				enqueueFx: () => Effect.void,
				readSnapshotFx: Effect.succeed({
					interactionClaimByActorId,
					spawnCueByActorId: new Map(),
					unsettledQuantities: new Map(),
				}),
				startFx: Effect.void,
				syncQuantitiesFx: Effect.void,
			} satisfies PixiTileMotionRuntime,
			onAcceptedDrop,
			onActivate,
			onDrop: onDrop as never,
			surface: {
				readActorPoseFx: () =>
					Effect.succeed({
						layer: transientActorLayer,
						size: 80,
						x: 10,
						y: 20,
					}),
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
		animateActor,
		cancelAnimation,
		controller,
		dropPresentation,
		finishCursorGrab,
		magneticUpdates,
		onActivate,
		onAcceptedDrop,
		onDrop,
		setCommandTarget: (target: typeof currentCommandTarget) => {
			currentCommandTarget = target;
		},
		setDropTargetX: (x: number) => {
			currentDropTargetX = x;
		},
		setOccupant: (occupant: TileActorItem | null) => {
			currentOccupant = occupant;
		},
		startCursorGrab,
		stage,
		transientActorLayer,
	};
};

const flushMicrotasks = async () => {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
};

describe("Pixi main-scene drag controller", () => {
	it("snapshots Shift at release instead of retaining a pooled Pixi event", async () => {
		const { actorEvents, onActivate, stage } = mountController();
		actorEvents.emit("pointerdown", pointer(10, 20));
		const release = pointer(10, 20, true);
		stage.emit("pointerup", release);
		release.shiftKey = false;
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledWith(item, true, expect.anything());
	});

	it("allows click activation without transform ownership during a swap", async () => {
		const mounted = mountController({
			interactionClaimByActorId: new Map([
				[
					item.id,
					"activation-only",
				],
			]),
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(70, 80));
		mounted.stage.emit("pointerup", pointer(70, 80));
		await flushMicrotasks();

		expect(mounted.onActivate).toHaveBeenCalledWith(item, false, expect.anything());
		expect(mounted.onDrop).not.toHaveBeenCalled();
		expect(mounted.cancelAnimation).not.toHaveBeenCalled();
		expect(mounted.startCursorGrab).not.toHaveBeenCalled();
		expect(mounted.finishCursorGrab).not.toHaveBeenCalled();
		expect(mounted.magneticUpdates).toHaveLength(0);
		expect(mounted.transientActorLayer.addChild).not.toHaveBeenCalled();
		expect(mounted.actor.container.x).toBe(10);
		expect(mounted.actor.container.y).toBe(20);
	});

	it("exposes an exact pending command actor until the drop resolves", () => {
		const mounted = mountController();
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.stage.emit("pointerup", pointer(30, 20));

		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);
	});

	it("freezes the command target at release and suppresses callbacks after close", async () => {
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
		expect(second.onDrop).not.toHaveBeenCalled();
	});

	it("refreshes held feedback and settles a rejected release from its exact pose", async () => {
		const mounted = mountController();
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

		expect(mounted.onAcceptedDrop).not.toHaveBeenCalled();
		expect(mounted.actor.container.x).toBe(10);
		expect(mounted.actor.container.y).toBe(20);
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.actor.container.zIndex).toBe(0);
		expect(mounted.actor.container.cursor).toBe("grab");
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

	it("logs an accepted replay failure without misclassifying it as command failure", async () => {
		const mounted = mountController();
		const failure = new Error("replay failed");
		mounted.onAcceptedDrop.mockImplementationOnce(() => {
			throw failure;
		});
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(45, 20));
		mounted.stage.emit("pointerup", pointer(45, 20));
		await flushMicrotasks();

		expect(error).toHaveBeenCalledWith("Pixi tile drop completion failed.", failure);
		expect(mounted.onDrop).toHaveBeenCalledOnce();
	});
});
