// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import "~test/ui/pixi/PixiTileMotionRuntime.test/fixture";
import { readPixiTileMotionOriginFx } from "~/ui/pixi/motion/readPixiTileMotionOriginFx";
import { runPixiInputMotionFx } from "~/ui/pixi/motion/runPixiInputMotionFx";

import {
	createActorMap,
	createActorStore,
	createApplication,
	createItemMap,
	createSurface,
	firstBoardLocation,
	secondBoardLocation,
	testPalette,
	createItem,
	createActor,
	createRecordingAnimator,
	createRecordingMagneticField,
	readPoseAnimation,
	samplePoseAnimation,
	advanceInputRemainderFlash,
	type TileMotionCue,
	type PixiTileActor,
	type PixiActorAnimation,
} from "~test/ui/pixi/PixiTileMotionRuntime.test/fixture";

describe("Pixi direct input remainder", () => {
	it("returns a directly dropped input remainder with the same physical actor", () => {
		const source = createActor("runtime:dragged-input-source");
		const owner = createActor("runtime:dragged-input-owner");
		source.item = {
			...createItem(source.item.id, firstBoardLocation),
			badgeCount: 8,
			quantity: 8,
		};
		source.currentVisual.item = source.item;
		owner.item = createItem(owner.item.id, secondBoardLocation);
		source.container.alpha = 1;
		source.container.eventMode = "static";
		source.container.position.set(280, 40);
		source.offsetLayer.position.set(6, -4);
		owner.container.position.set(300, 40);
		const actorLayer = new Container();
		const transientActorLayer = new Container();
		transientActorLayer.addChild(source.container);
		actorLayer.addChild(owner.container);
		const actors = createActorMap(source, owner);
		const canonicalItems = createItemMap(
			{
				...source.item,
				badgeCount: 7,
				quantity: 7,
			},
			owner.item,
		);
		const animations: PixiActorAnimation[] = [];
		const completed = vi.fn();
		const transients: PixiTileActor[] = [];
		const home = {
			layer: actorLayer,
			size: 80,
			x: 100,
			y: 40,
		};
		const target = {
			layer: actorLayer,
			size: 80,
			x: 300,
			y: 40,
		};
		const application = createApplication();
		const surface = createSurface({
			readLocationPose: (location) => (location === firstBoardLocation ? home : target),
			transientActorLayer,
		});
		const effectivePoseBeforeSetup = {
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		};
		const origin = Effect.runSync(
			readPixiTileMotionOriginFx({
				originActor: source,
				originLocation: firstBoardLocation,
				surface,
			}),
		);
		if (origin === null) throw new Error("Expected the dragged actor origin.");
		const cue = {
			canonicalItemId: source.item.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: source.item.id,
			originLocation: firstBoardLocation,
			previousQuantity: 8,
			storedQuantity: 1,
			resultingQuantity: 7,
			sequence: 42,
			sourceActorId: source.item.id,
			staggerIndex: 0,
			targetActorId: owner.item.id,
			targetLocation: secondBoardLocation,
		} satisfies TileMotionCue;

		Effect.runSync(
			runPixiInputMotionFx({
				actorStore: createActorStore({
					actors,
					canonicalItems,
				}),
				animator: createRecordingAnimator({
					animations,
				}),
				application,
				cue,
				cueKey: "42:0",
				delayMs: 0,
				magneticField: createRecordingMagneticField(),
				onComplete: completed,
				onRemainderRevealed: () => {
					source.item = {
						...source.item,
						badgeCount: 7,
						quantity: 7,
					};
					source.currentVisual.item = source.item;
				},
				onPayloadCreated: (actor) => {
					transients.push(actor);
				},
				origin,
				readPalette: () => testPalette,
				readSourceSurvives: () => true,
				surface,
				target,
				textures: {} as never,
			}),
		);

		expect(transients).toEqual([]);
		expect(source.item.quantity).toBe(8);
		expect(source.item.badgeCount).toBe(8);
		expect({
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeSetup);
		expect(source.container).toMatchObject({
			alpha: 1,
			eventMode: "none",
			parent: transientActorLayer,
			x: 280,
			y: 40,
		});
		const delivery = readPoseAnimation(animations, source);
		samplePoseAnimation(delivery, 1);
		delivery.onComplete?.();
		advanceInputRemainderFlash({
			actor: source,
			animations,
			cueKey: "42:0",
		});

		const returned = animations
			.filter(
				(animation) =>
					animation.actor === source &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:42:0",
			)
			.at(-1);
		if (returned?.channel !== "pose") throw new Error("Expected the input remainder return.");
		expect(samplePoseAnimation(returned, 0.5)).toMatchObject({
			x: 200,
			y: 40,
		});
		expect(samplePoseAnimation(returned, 1)).toEqual({
			scale: 1,
			x: home.x,
			y: home.y,
		});
		const effectivePoseBeforeCompletion = {
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		};
		returned.onComplete?.();

		expect(source.container.destroyed).toBe(false);
		expect(source.container).toMatchObject({
			alpha: 1,
			eventMode: "static",
			parent: actorLayer,
			x: 100,
			y: 40,
		});
		expect({
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeCompletion);
		expect(source.item.quantity).toBe(7);
		expect(completed).toHaveBeenCalledOnce();
	});
});
