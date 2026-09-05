// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { expect, it, vi } from "vitest";

import {
	createActor,
	createActorMap,
	createActorStore,
	createApplication,
	createSurface,
	createRecordingAnimator,
	createRecordingMagneticField,
	firstBoardLocation,
	palette,
} from "~test/tile-motion/fx/createMotionRuntimeFx.test/fixture";
import { createDeliveryRuntimeFx } from "~/game-scene/fx/createDeliveryRuntimeFx";
import type { TileDelivery } from "~/game-scene/fx/readTileDeliveriesFx";

it("reveals a Toolbar return that settled while the other endpoint was off-screen", () => {
	const actor = createActor("runtime:returning-material");
	const toolbar = {
		scope: "toolbar",
		position: {
			x: 0,
			y: 0,
		},
	} as const;
	actor.container.position.set(100, 40);
	const actorStore = createActorStore({
		actors: createActorMap(actor),
	});
	const application = createApplication();
	const layer = new Container();
	let currentSpace = 0;
	const surface = createSurface({
		readLocationPose: (location) =>
			location.scope === "board" && location.space !== currentSpace
				? null
				: {
						layer,
						size: 80,
						x: location.position.x * 100,
						y: 40,
					},
	});
	const attachActorFx = vi.fn(() => Effect.void);
	const runtime = Effect.runSync(
		createDeliveryRuntimeFx({
			actorStore,
			animator: createRecordingAnimator({
				animations: [],
			}),
			application,
			magneticField: createRecordingMagneticField(),
			surface,
			readPaletteFn: () => palette,
			textures: {} as never,
			particleTextures: {} as never,
			drag: {
				attachActorFx,
				detachActorFx: () => Effect.void,
			} as never,
		}),
	);
	const returning: TileDelivery = {
		from: firstBoardLocation,
		generation: 1,
		item: actor.item,
		phase: "returning",
		remainingDurationMs: 500,
		to: toolbar,
	};
	try {
		Effect.runSync(
			runtime.syncFx([
				returning,
			]),
		);
		currentSpace = 1;
		Effect.runSync(
			runtime.syncFx([
				returning,
			]),
		);
		expect(actor.container.visible).toBe(false);
		Effect.runSync(
			actorStore.replaceCanonicalItemsFx([
				{
					...actor.item,
					location: toolbar,
				},
			]),
		);
		Effect.runSync(runtime.syncFx([]));
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.size).toBe(0);
		expect(actorStore.actors.get(actor.item.id)).toBe(actor);
		expect(attachActorFx).toHaveBeenCalledWith(actor);
		expect(actor.container.visible).toBe(true);
	} finally {
		Effect.runSync(runtime.closeFx);
	}
});
