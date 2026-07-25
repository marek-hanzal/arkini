import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readCommittedTileReplacementsFx } from "~/bridge/tile/motion/readCommittedTileReplacementsFx";
import { readCommittedTileSwapMotionCueFx } from "~/bridge/tile/motion/readCommittedTileSwapMotionCueFx";
import { readTileMotionCuesFx } from "~/bridge/tile/motion/readTileMotionCuesFx";
import { readTileActorsFx } from "~/bridge/tile/readTileActorsFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneReconciler } from "~/ui/pixi/scene/PixiMainSceneReconciler";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import { renderPixiTileSemanticListFx } from "~/ui/pixi/semantic/renderPixiTileSemanticListFx";

export namespace createPixiMainSceneReconcilerFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly drag: PixiMainSceneDragController;
		readonly game: GameEngine;
		readonly magneticField: PixiTileMagneticField;
		readonly motion: PixiTileMotionRuntime;
		readonly readPalette: () => PixiScenePalette;
		readonly semanticHost: HTMLElement;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

const sameLocation = (left: TileActorItem["location"], right: TileActorItem["location"]) =>
	JSON.stringify(left) === JSON.stringify(right);

const sameVisual = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.title === right.title &&
	left.quantity === right.quantity &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.running === right.running &&
	left.primaryAction.kind === right.primaryAction.kind &&
	(left.primaryAction.kind !== "start-default-line" ||
		(right.primaryAction.kind === "start-default-line" &&
			left.primaryAction.lineId === right.primaryAction.lineId));

/** Consumes canonical transitions into retained actors while motion owns presentation lag. */
export const createPixiMainSceneReconcilerFx = Effect.fn("createPixiMainSceneReconcilerFx")(
	function* ({
		actorStore,
		animator,
		application,
		drag,
		game,
		magneticField,
		motion,
		readPalette,
		semanticHost,
		surface,
		textures,
	}: createPixiMainSceneReconcilerFx.Props) {
		const processedCueKeys = new Set<string>();
		const processedReplacementKeys = new Set<string>();
		let exitGeneration = 0;
		let closed = false;

		const retainNewestKeys = (keys: Set<string>, maximumSize = 256) => {
			while (keys.size > maximumSize) {
				const oldest = keys.values().next().value;
				if (oldest === undefined) return;
				keys.delete(oldest);
			}
		};

		const refreshActor = (actor: NonNullable<ReturnType<typeof actorStore.actors.get>>) => {
			const pose = RendererRuntime.runSync(surface.readActorPoseFx(actor.item));
			if (pose === null) return;
			RendererRuntime.runSync(
				updatePixiTileActorFx({
					actor,
					frames: application.frames,
					item: actor.item,
					palette: readPalette(),
					size: pose.size,
					textures,
				}),
			);
		};

		const reconcileFx = Effect.fn("PixiMainSceneReconciler.reconcileFx")(function* (
			transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
		) {
			if (closed) return;
			const nextItems = game.readOrThrow(
				readTileActorsFx({
					game,
					runtime: transition.runtime,
					surface: "main",
				}),
			);
			yield* actorStore.replaceCanonicalItemsFx(nextItems);
			const compiledCues = [
				...RendererRuntime.runSync(readTileMotionCuesFx(transition)),
			];
			const replacements = RendererRuntime.runSync(
				readCommittedTileReplacementsFx({
					game,
					transition,
				}),
			);
			const swapCandidate = yield* drag.readSwapCandidateFx;
			if (swapCandidate !== null) {
				const swapCue = RendererRuntime.runSync(
					readCommittedTileSwapMotionCueFx({
						...swapCandidate,
						transition,
					}),
				);
				if (swapCue !== null) {
					compiledCues.push(swapCue);
					yield* drag.clearSwapCandidateFx;
				}
			}
			const incomingCues = compiledCues.filter((cue) => {
				const key = `${cue.sequence}:${cue.eventIndex}`;
				if (processedCueKeys.has(key)) return false;
				processedCueKeys.add(key);
				retainNewestKeys(processedCueKeys);
				return true;
			});
			yield* motion.enqueueFx(incomingCues);
			const motionSnapshot = yield* motion.readSnapshotFx;
			const visibleItems = new Map(
				nextItems.flatMap((item) =>
					RendererRuntime.runSync(surface.readActorPoseFx(item)) === null
						? []
						: [
								[
									item.id,
									item,
								],
							],
				),
			);

			for (const [id, actor] of actorStore.actors) {
				if (visibleItems.has(id) || motionSnapshot.ownedActorIds.has(id)) continue;
				yield* drag.detachActorFx(actor);
				yield* actorStore.deleteActorFx(id);
				yield* animator.cancelFx(id);
				exitGeneration += 1;
				yield* animator.animateFx({
					actor,
					animationKey: `exit:${id}:${exitGeneration}`,
					durationMs: 220,
					onComplete: () => {
						actor.textureGeneration += 1;
						actor.container.destroy({
							children: true,
						});
					},
					toAlpha: 0,
					toScale: 0.76,
					toX: actor.container.x,
					toY: actor.container.y,
				});
			}

			for (const item of visibleItems.values()) {
				const pose = RendererRuntime.runSync(surface.readActorPoseFx(item));
				if (pose === null) continue;
				const hiddenQuantity = motionSnapshot.unsettledQuantities.get(item.id) ?? 0;
				const displayItem =
					hiddenQuantity === 0
						? item
						: {
								...item,
								quantity: Math.max(1, item.quantity - hiddenQuantity),
							};
				const actor = actorStore.actors.get(item.id);
				if (actor === undefined) {
					const created = RendererRuntime.runSync(
						createPixiTileActorFx({
							frames: application.frames,
							item: displayItem,
							palette: readPalette(),
							textures,
						}),
					);
					yield* actorStore.setActorFx(created);
					pose.layer.addChild(created.container);
					const spawnCue = motionSnapshot.spawnCueByActorId.get(item.id);
					const spawnOrigin =
						spawnCue === undefined
							? null
							: RendererRuntime.runSync(
									surface.readLocationPoseFx(spawnCue.originLocation),
								);
					created.container.x = spawnOrigin?.x ?? pose.x;
					created.container.y = spawnOrigin?.y ?? pose.y;
					created.container.alpha = 0;
					created.container.scale.set(spawnCue === undefined ? 0.82 : 1);
					yield* drag.attachActorFx(created);
					yield* updatePixiTileActorFx({
						actor: created,
						frames: application.frames,
						item: displayItem,
						palette: readPalette(),
						size: pose.size,
						textures,
					});
					if (spawnCue === undefined) {
						yield* animator.animateFx({
							actor: created,
							durationMs: 260,
							toAlpha: 1,
							toScale: 1,
							toX: pose.x,
							toY: pose.y,
						});
					}
					continue;
				}

				const moved = !sameLocation(actor.item.location, item.location);
				const visualChanged = !sameVisual(actor.item, displayItem);
				const sizeChanged = actor.size !== pose.size;
				if (visualChanged || sizeChanged) {
					yield* updatePixiTileActorFx({
						actor,
						frames: application.frames,
						item: displayItem,
						palette: readPalette(),
						size: pose.size,
						textures,
					});
				} else {
					actor.item = displayItem;
				}
				if (actor.dragging || motionSnapshot.ownedActorIds.has(item.id)) continue;
				pose.layer.addChild(actor.container);
				if (
					moved ||
					actor.container.x !== pose.x ||
					actor.container.y !== pose.y ||
					sizeChanged
				) {
					yield* animator.animateFx({
						actor,
						durationMs: yield* readPixiTileTravelDurationMsFx({
							fromX: actor.container.x,
							fromY: actor.container.y,
							tileSize: pose.size,
							toX: pose.x,
							toY: pose.y,
						}),
						toX: pose.x,
						toY: pose.y,
					});
				}
			}

			for (const replacement of replacements) {
				if (processedReplacementKeys.has(replacement.key)) continue;
				const canonical = actorStore.canonicalItems.get(replacement.actorId);
				const pose =
					canonical === undefined
						? null
						: RendererRuntime.runSync(surface.readActorPoseFx(canonical));
				if (canonical === undefined || pose === null) continue;
				processedReplacementKeys.add(replacement.key);
				retainNewestKeys(processedReplacementKeys);
				const outgoing = RendererRuntime.runSync(
					createPixiTileActorFx({
						frames: application.frames,
						item: {
							...canonical,
							...replacement.previous,
							quantity: replacement.previousQuantity,
						},
						palette: readPalette(),
						textures,
					}),
				);
				outgoing.container.eventMode = "none";
				surface.transientActorLayer.addChild(outgoing.container);
				outgoing.container.x = pose.x;
				outgoing.container.y = pose.y;
				yield* updatePixiTileActorFx({
					actor: outgoing,
					frames: application.frames,
					item: outgoing.item,
					palette: readPalette(),
					size: pose.size,
					textures,
				});
				yield* animator.animateFx({
					actor: outgoing,
					animationKey: `replacement:${replacement.key}`,
					durationMs: 280,
					onComplete: () => {
						outgoing.textureGeneration += 1;
						outgoing.container.destroy({
							children: true,
						});
					},
					toAlpha: 0,
					toX: pose.x,
					toY: pose.y,
				});
			}
			yield* drag.refreshPreviewFx;
			yield* magneticField.pruneFx;
			yield* motion.syncQuantitiesFx;
			yield* motion.startFx;
			yield* renderPixiTileSemanticListFx({
				host: semanticHost,
				items: visibleItems.values(),
			});
		});

		return {
			reconcileFx,
			refreshVisualsFx: Effect.sync(() => {
				for (const actor of actorStore.actors.values()) refreshActor(actor);
			}),
			closeFx: Effect.sync(() => {
				closed = true;
				processedCueKeys.clear();
				processedReplacementKeys.clear();
				semanticHost.replaceChildren();
			}),
		} satisfies PixiMainSceneReconciler;
	},
);
