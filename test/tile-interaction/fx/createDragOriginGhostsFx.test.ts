import { Effect } from "effect";
import { Container, RenderTexture, type Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createDragOriginGhostsFx } from "~/tile-interaction/fx/createDragOriginGhostsFx";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";
import type { AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import { createDragActor, item } from "~test/tile-interaction/fx/MainDragController.test/actors";

describe("drag origin ghosts", () => {
	it("keeps a non-interactive snapshot below actors until settlement completes", () => {
		const actor = createDragActor(item);
		const layer = new Container();
		layer.addChild(actor.container);
		const texture = RenderTexture.create({
			height: actor.size,
			width: actor.size,
		});
		const destroyTexture = vi.spyOn(texture, "destroy");
		const generateTexture = vi.fn(() => texture as Texture);
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
			readLocalActorIdsFx: () => Effect.succeed([]),
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
							generateTexture,
							resolution: 1,
						},
					},
				} as unknown as PixiApplicationOwner,
				surface,
			}),
		);

		Effect.runSync(ghosts.beginFx(actor));
		const ghost = layer.children[0];
		expect(generateTexture).toHaveBeenCalledOnce();
		expect(ghost?.label).toBe(`DragOriginGhost:${actor.item.id}:${actor.instanceId}`);
		expect(ghost?.eventMode).toBe("none");
		expect(ghost?.interactiveChildren).toBe(false);
		expect(layer.children[1]).toBe(actor.container);

		Effect.runSync(ghosts.settleFx(actor));
		expect(ghost?.destroyed).toBe(false);
		expect(tweens).toHaveLength(2);
		tweens[1]?.onCompleteFn?.();
		expect(ghost?.destroyed).toBe(true);
		expect(destroyTexture).toHaveBeenCalledExactlyOnceWith(true);
		expect(layer.children).toEqual([
			actor.container,
		]);
	});
});
