import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createDragOriginGhostsFx } from "~/tile-interaction/fx/createDragOriginGhostsFx";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import { createDragActor, item } from "~test/tile-interaction/fx/MainDragController.test/actors";

describe("drag origin ghosts", () => {
	it("keeps a live non-interactive mirror below actors until settlement completes", () => {
		const actor = createDragActor(item);
		const layer = new Container();
		layer.addChild(actor.container);
		const render = vi.fn();
		const beforeRenderListeners = new Set<() => void>();
		const tweens: Array<Parameters<AnimationDriver["startTweenFx"]>[0]> = [];
		const animationDriver = {
			closeFx: Effect.void,
			createSpringFx: () => Effect.die("Unexpected spring."),
			startTweenFx: (tween) =>
				Effect.sync(() => {
					tweens.push(tween);
					return {
						stopFx: Effect.void,
					};
				}),
		} satisfies AnimationDriver;
		const surface = {
			readActorPoseFx: () =>
				Effect.succeed({
					layer,
					size: actor.size,
					x: 40,
					y: 80,
				}),
			readTargetFactsFx: () => Effect.die("Unexpected target read."),
			renderDropFeedbackFx: () => Effect.void,
			transientActorLayer: new Container(),
		} satisfies MainInteractionSurface;
		const ghosts = Effect.runSync(
			createDragOriginGhostsFx({
				animationDriver,
				application: {
					app: {
						renderer: {
							render,
							resolution: 1,
						},
					},
					frames: {
						addBeforeRenderListenerFx: (listenerFn: () => void) =>
							Effect.sync(() => {
								beforeRenderListeners.add(listenerFn);
								return () => beforeRenderListeners.delete(listenerFn);
							}),
					},
				} as unknown as PixiApplicationOwner,
				surface,
			}),
		);

		Effect.runSync(ghosts.beginFx(actor));
		const ghost = layer.children[0];
		expect(ghost?.label).toBe(`DragOriginGhost:${actor.item.id}:${actor.instanceId}`);
		expect(ghost?.eventMode).toBe("none");
		expect(ghost?.interactiveChildren).toBe(false);
		expect(layer.children[1]).toBe(actor.container);
		expect(beforeRenderListeners).toHaveLength(1);
		for (const listenerFn of beforeRenderListeners) listenerFn();
		expect(render).toHaveBeenCalledOnce();
		expect(render.mock.calls[0]?.[0]).toMatchObject({
			container: actor.container,
		});

		Effect.runSync(ghosts.settleFx(actor));
		expect(ghost?.destroyed).toBe(false);
		expect(tweens).toHaveLength(2);
		tweens[1]?.onCompleteFn?.();
		expect(ghost?.destroyed).toBe(true);
		expect(beforeRenderListeners).toHaveLength(0);
		expect(layer.children).toEqual([
			actor.container,
		]);
	});
});
