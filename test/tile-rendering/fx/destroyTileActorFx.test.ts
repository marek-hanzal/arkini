import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";
import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";
import { createMainActorStoreFx } from "~/tile-rendering/fx/createMainActorStoreFx";
import { destroyTileActorFx } from "~/tile-rendering/fx/destroyTileActorFx";

const createVisual = () => {
	const destroy = vi.fn();
	const container = {
		destroyed: false,
		destroy: (options: unknown) => {
			destroy(options);
			container.destroyed = true;
		},
	};
	return {
		destroy,
		visual: {
			container,
			readyListeners: new Set(),
			textureGeneration: 4,
			textureState: "loading",
		} as unknown as ActorVisual,
	};
};

describe("tile actor destruction", () => {
	it("cancels every visual revision and destroys one physical actor exactly once", () => {
		const current = createVisual();
		const pending = createVisual();
		const cancelCurrent = vi.fn();
		const cancelPending = vi.fn();
		current.visual.readyListeners.add({
			onCancelFn: cancelCurrent,
			onReadyFn: vi.fn(),
		});
		pending.visual.readyListeners.add({
			onCancelFn: cancelPending,
			onReadyFn: vi.fn(),
		});
		const destroy = vi.fn();
		const container = {
			destroyed: false,
			destroy: (options: unknown) => {
				destroy(options);
				container.destroyed = true;
			},
		};
		const actor = {
			container,
			currentVisual: current.visual,
			item: {
				id: "runtime:tile",
			} as TileActorItem,
			lifecycleIntentGeneration: 3,
			pendingVisual: pending.visual,
			visuals: new Set([
				current.visual,
				pending.visual,
			]),
			visualTransitionGeneration: 7,
		} as unknown as PixiTileActor;

		Effect.runSync(destroyTileActorFx(actor));
		Effect.runSync(destroyTileActorFx(actor));

		expect(actor.lifecycleIntentGeneration).toBe(4);
		expect(actor.visualTransitionGeneration).toBe(8);
		expect(actor.visuals.size).toBe(0);
		expect(actor.pendingVisual).toBeNull();
		expect(current.visual.textureState).toBe("destroyed");
		expect(pending.visual.textureState).toBe("destroyed");
		expect(current.visual.textureGeneration).toBe(5);
		expect(pending.visual.textureGeneration).toBe(5);
		expect(cancelCurrent).toHaveBeenCalledOnce();
		expect(cancelPending).toHaveBeenCalledOnce();
		expect(current.destroy).toHaveBeenCalledExactlyOnceWith({
			children: true,
		});
		expect(pending.destroy).toHaveBeenCalledExactlyOnceWith({
			children: true,
		});
		expect(destroy).toHaveBeenCalledExactlyOnceWith({
			children: true,
		});
	});

	it("makes late visual readiness completion a no-op after actor destruction", () => {
		const { visual } = createVisual();
		const ready = vi.fn();
		visual.readyListeners.add({
			onReadyFn: ready,
		});
		const actorContainer = {
			cursor: "grab",
			destroyed: false,
			eventMode: "static",
			off: vi.fn(),
			destroy: () => {
				actorContainer.destroyed = true;
			},
		};
		const actor = {
			container: actorContainer,
			currentVisual: visual,
			lifecycleIntentGeneration: 0,
			pendingVisual: null,
			visuals: new Set([
				visual,
			]),
			visualTransitionGeneration: 0,
		} as unknown as PixiTileActor;
		const staleGeneration = visual.textureGeneration;

		Effect.runSync(destroyTileActorFx(actor));
		Effect.runSync(
			runVisualReadinessFx({
				generation: staleGeneration,
				kind: "complete",
				visual,
			}),
		);

		expect(ready).not.toHaveBeenCalled();
		expect(visual.textureState).toBe("destroyed");
		expect(actor.container.destroyed).toBe(true);
	});

	it("retains a released exit actor until store teardown cancels its visual readiness", () => {
		const { visual } = createVisual();
		const ready = vi.fn();
		const canceled = vi.fn();
		visual.readyListeners.add({
			onCancelFn: canceled,
			onReadyFn: ready,
		});
		const actorContainer = {
			cursor: "grab",
			destroyed: false,
			eventMode: "static",
			off: vi.fn(),
			destroy: () => {
				actorContainer.destroyed = true;
			},
		};
		const onPointerDown = vi.fn();
		const actor = {
			container: actorContainer,
			currentVisual: visual,
			dragging: false,
			item: {
				id: "runtime:exiting",
			} as TileActorItem,
			lifecycleIntentGeneration: 0,
			onPointerDownFn: onPointerDown,
			pendingVisual: null,
			visuals: new Set([
				visual,
			]),
			visualTransitionGeneration: 0,
		} as unknown as PixiTileActor;
		const store = Effect.runSync(createMainActorStoreFx());
		const staleGeneration = visual.textureGeneration;

		Effect.runSync(store.setActorFx(actor));
		expect(Effect.runSync(store.releaseActorFx(actor.item.id))).toBe(actor);
		expect(store.actors.has(actor.item.id)).toBe(false);
		expect(actorContainer.off).toHaveBeenCalledExactlyOnceWith("pointerdown", onPointerDown);
		expect(actor.onPointerDownFn).toBeNull();
		expect(actorContainer.eventMode).toBe("none");
		Effect.runSync(store.closeFx);
		Effect.runSync(
			runVisualReadinessFx({
				generation: staleGeneration,
				kind: "complete",
				visual,
			}),
		);

		expect(canceled).toHaveBeenCalledOnce();
		expect(ready).not.toHaveBeenCalled();
		expect(visual.textureState).toBe("destroyed");
		expect(actor.container.destroyed).toBe(true);
	});

	it("destroys a stale exiting instance before publishing a replacement with the same runtime id", () => {
		const previousVisual = createVisual().visual;
		const replacementVisual = createVisual().visual;
		const createActor = (visual: ActorVisual, instanceId: string) => {
			const container = {
				cursor: "grab",
				destroyed: false,
				eventMode: "static",
				off: vi.fn(),
				destroy: () => {
					container.destroyed = true;
				},
			};
			return {
				container,
				currentVisual: visual,
				dragging: false,
				instanceId,
				item: {
					id: "runtime:replaced",
				} as TileActorItem,
				lifecycleIntentGeneration: 0,
				onPointerDownFn: null,
				pendingVisual: null,
				visuals: new Set([
					visual,
				]),
				visualTransitionGeneration: 0,
			} as unknown as PixiTileActor;
		};
		const previous = createActor(previousVisual, "instance:previous");
		const replacement = createActor(replacementVisual, "instance:replacement");
		const store = Effect.runSync(createMainActorStoreFx());

		Effect.runSync(store.setActorFx(previous));
		Effect.runSync(store.releaseActorFx(previous.item.id));
		expect(previous.container.destroyed).toBe(false);

		Effect.runSync(store.setActorFx(replacement));

		expect(previous.container.destroyed).toBe(true);
		expect(store.actors.get(replacement.item.id)).toBe(replacement);
		expect(replacement.container.destroyed).toBe(false);
		Effect.runSync(store.closeFx);
	});
});
