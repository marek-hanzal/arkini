// @vitest-environment jsdom

import { Effect } from "effect";
import { expect, it } from "vitest";
import { Container } from "pixi.js";

import {
	createActor,
	createActorMap,
	createItemMap,
	createActorStore,
	createApplication,
	createSurface,
	createRecordingMagneticField,
	firstBoardLocation,
	secondBoardLocation,
	inventoryLocation,
	palette,
} from "./createMotionRuntimeFx.test/fixture";
import { createActorAnimatorFx } from "~/tile-rendering/fx/createActorAnimatorFx";
import type { AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import { createMotionRuntimeFx } from "~/tile-motion/fx/createMotionRuntimeFx";
import { createDeliveryRuntimeFx } from "~/game-scene/fx/createDeliveryRuntimeFx";
import type { TileInputMotionCue } from "~/tile-presentation/type/TileMotionCue";

for (const phase of [
	"pending",
	"outbound",
	"fade-out",
	"fade-in",
	"return",
	"inventory-payload",
] as const) {
	it(`retires ${phase} input playback before canonical delivery takes the remainder`, () => {
		const source = createActor("runtime:source"),
			receiver = createActor("runtime:receiver");
		source.item = {
			...source.item,
			quantity: 7,
			location: firstBoardLocation,
		};
		source.currentVisual.item = source.item;
		source.container.position.set(100, 40);
		source.container.alpha = 1;
		receiver.item = {
			...receiver.item,
			location: secondBoardLocation,
		};
		receiver.container.position.set(200, 40);
		receiver.container.alpha = 1;
		const inventory = phase === "inventory-payload";
		const actorStore = createActorStore({
			actors: createActorMap(
				...(inventory
					? [
							receiver,
						]
					: [
							source,
							receiver,
						]),
			),
			canonicalItems: createItemMap(
				...(inventory
					? [
							receiver.item,
						]
					: [
							{
								...source.item,
								quantity: 2,
							},
							receiver.item,
						]),
			),
		});
		const application = createApplication();
		const magneticField = createRecordingMagneticField();
		const layer = new Container();
		const surface = createSurface({
			readLocationPose: (location) => ({
				layer,
				size: 80,
				x: location.position.x * 100,
				y: 40,
			}),
		});
		const tweens: Array<{
			props: Parameters<AnimationDriver["startTweenFx"]>[0];
			active: boolean;
		}> = [];
		const animator = Effect.runSync(
			createActorAnimatorFx({
				frames: application.frames,
				animationDriver: {
					closeFx: Effect.void,
					createSpringFx: () =>
						Effect.succeed({
							closeFx: Effect.void,
							setTargetFx: () => Effect.void,
						}),
					startTweenFx: (props) =>
						Effect.sync(() => {
							const tween = {
								props,
								active: true,
							};
							tweens.push(tween);
							return {
								stopFx: Effect.sync(() => {
									tween.active = false;
								}),
							};
						}),
				},
			}),
		);
		const runtime = Effect.runSync(
			createMotionRuntimeFx({
				actorStore,
				animator,
				application,
				magneticField,
				surface,
				readPaletteFn: () => palette,
				textures: {} as never,
			}),
		);
		const delivery = Effect.runSync(
			createDeliveryRuntimeFx({
				actorStore,
				animator,
				application,
				magneticField,
				surface,
				readPaletteFn: () => palette,
				textures: {} as never,
				particleTextures: {} as never,
				drag: {
					attachActorFx: () => Effect.void,
					detachActorFx: () => Effect.void,
				} as never,
			}),
		);
		const cue: TileInputMotionCue = {
			canonicalItemId: source.item.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: source.item.id,
			originLocation: firstBoardLocation,
			previousQuantity: 7,
			resultingQuantity: 2,
			sequence: 40,
			sourceActorId: source.item.id,
			staggerIndex: 0,
			storedQuantity: 5,
			targetActorId: receiver.item.id,
			targetLocation: secondBoardLocation,
			...(inventory
				? {
						sourceItem: {
							...source.item,
							location: inventoryLocation,
						},
					}
				: {}),
		};
		const finishTween = (tween: (typeof tweens)[number]) => {
			tween.props.onUpdateFn(1);
			tween.active = false;
			tween.props.onCompleteFn?.();
		};
		try {
			Effect.runSync(
				runtime.enqueueFx([
					cue,
				]),
			);
			Effect.runSync(runtime.syncPresentationFx);
			if (phase !== "pending") Effect.runSync(runtime.startFx);
			const outward = tweens.at(-1);
			if (phase !== "pending") {
				expect(outward).toBeDefined();
				outward!.props.onUpdateFn(0.25);
			}
			if (phase === "fade-out" || phase === "fade-in" || phase === "return" || inventory) {
				finishTween(outward!);
				if (phase === "fade-in" || phase === "return") finishTween(tweens.at(-1)!);
				if (phase === "return") finishTween(tweens.at(-1)!);
			}
			const payload = inventory ? surface.transientActorLayer.children[0] : null;
			// A queued sibling is obsolete too; an unrelated successor must remain runnable.
			Effect.runSync(
				runtime.enqueueFx([
					{
						...cue,
						sequence: 41,
						previousQuantity: 2,
						resultingQuantity: 1,
						storedQuantity: 1,
					},
					{
						kind: "spawn",
						sequence: 42,
						eventIndex: 0,
						staggerIndex: 0,
						actorId: receiver.item.id,
						originActorId: "runtime:producer",
						originLocation: firstBoardLocation,
						targetLocation: secondBoardLocation,
					},
				]),
			);
			Effect.runSync(
				actorStore.replaceCanonicalItemsFx([
					receiver.item,
				]),
			);
			const livePose = {
				x: source.container.x,
				y: source.container.y,
			};
			Effect.runSync(
				runtime.handoffDeliveriesFx(
					new Set([
						source.item.id,
					]),
				),
			);
			expect(
				Effect.runSync(runtime.readSnapshotFx).retainedActorIds.has(source.item.id),
			).toBe(false);
			expect(
				Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId.has(
					source.item.id,
				),
			).toBe(false);
			if (payload !== null) expect(payload.destroyed).toBe(true);
			else {
				expect(source.container.destroyed).toBe(false);
				expect(source.container).toMatchObject({
					...livePose,
					alpha: 1,
				});
				expect(source.lifecycleLayer.scale.x).toBe(1);
			}
			expect(Effect.runSync(magneticField.readActiveSourceActorIdsFx)).toEqual([]);
			Effect.runSync(
				delivery.syncFx([
					{
						item: {
							...source.item,
							quantity: 1,
						},
						from: firstBoardLocation,
						to: secondBoardLocation,
						generation: 0,
						phase: "outbound",
						remainingDurationMs: 500,
						targetActorId: receiver.item.id,
					},
				]),
			);
			Effect.runSync(runtime.syncPresentationFx);
			Effect.runSync(runtime.startFx);
			for (let i = 0; i < tweens.length && i < 100; i++) {
				const tween = tweens[i]!;
				if (tween.active) finishTween(tween);
			}
			Effect.runSync(delivery.syncFx([]));
			for (let i = 0; i < tweens.length && i < 100; i++) {
				const tween = tweens[i]!;
				if (tween.active) finishTween(tween);
			}
			expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds).toEqual(new Set());
			expect(receiver.container.destroyed).toBe(false);
			expect(receiver.container).toMatchObject({
				x: 200,
				y: 40,
			});
		} finally {
			Effect.runSync(delivery.closeFx);
			Effect.runSync(runtime.closeFx);
			Effect.runSync(animator.closeFx);
		}
	});
}
