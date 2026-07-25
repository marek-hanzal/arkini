import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiMainSceneDragControllerFx } from "~/ui/pixi/drag/createPixiMainSceneDragControllerFx";
import type { PixiCursorGrabMotion } from "~/ui/pixi/drag/PixiCursorGrabMotion";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

const previewState = vi.hoisted(() => ({
	kind: "move" as "move" | "reject",
}));

vi.mock("~/bridge/tile/readTileDropPreviewFx", () => ({
	readTileDropPreviewFx: () =>
		Effect.succeed({
			kind: previewState.kind,
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

const mountController = () => {
	previewState.kind = "move";
	const actorEvents = new FakeEmitter();
	const stage = new FakeEmitter();
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
	let currentCommandTarget = {
		kind: "unsupported" as const,
	};
	const onActivate = vi.fn();
	const onAcceptedDrop = vi.fn();
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
						animation.actor.container.x = animation.toX;
						animation.actor.container.y = animation.toY;
					}),
				cancelFx: () => Effect.void,
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
				finishFx: () => Effect.void,
				startFx: () => Effect.void,
			} satisfies PixiCursorGrabMotion,
			game: {} as never,
			magneticField: {
				closeFx: Effect.void,
				pruneFx: Effect.void,
				resetFx: Effect.void,
				updateFx: () => Effect.void,
			} satisfies PixiTileMagneticField,
			motion: {
				closeFx: Effect.void,
				enqueueFx: () => Effect.void,
				readSnapshotFx: Effect.succeed({
					ownedActorIds: new Set<string>(),
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
						x: 1,
						y: 0,
					}),
				readOccupantFx: () => Effect.succeed(null),
				renderDropFeedbackFx: () => Effect.void,
				transientActorLayer,
			} as unknown as PixiMainSceneSurface,
		}),
	);
	Effect.runSync(controller.attachActorFx(actor));
	return {
		actor,
		actorEvents,
		controller,
		onActivate,
		onAcceptedDrop,
		onDrop,
		setCommandTarget: (target: typeof currentCommandTarget) => {
			currentCommandTarget = target;
		},
		stage,
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
