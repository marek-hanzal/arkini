import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { isSameTileActorLocationFx } from "~/bridge/tile/isSameTileActorLocationFx";
import { readTileDropPreviewFx } from "~/bridge/tile/readTileDropPreviewFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import type { PixiMainSceneDragPreview } from "~/ui/pixi/drag/PixiMainSceneDragPreview";
import { readPixiTileAttractionActorIdFx } from "~/ui/pixi/magnet/readPixiTileAttractionActorIdFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace createPixiMainSceneDragPreviewFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly game: GameEngine;
		readonly surface: PixiMainSceneSurface;
	}
}

/** Creates stateless canonical source and engine-preview projection for main-scene dragging. */
export const createPixiMainSceneDragPreviewFx = Effect.fn("createPixiMainSceneDragPreviewFx")(
	function* ({ actorStore, game, surface }: createPixiMainSceneDragPreviewFx.Props) {
		const readCurrentSourceFx: PixiMainSceneDragPreview["readCurrentSourceFx"] = Effect.fn(
			"PixiMainSceneDragPreview.readCurrentSourceFx",
		)(function* (drag) {
			if (
				drag.actor.container.destroyed ||
				actorStore.actors.get(drag.sourceItem.id) !== drag.actor
			) {
				return null;
			}
			const canonical = actorStore.canonicalItems.get(drag.sourceItem.id);
			if (
				canonical === undefined ||
				!(yield* isSameTileActorLocationFx(canonical.location, drag.sourceItem.location))
			) {
				return null;
			}
			return {
				...drag.actor.item,
				location: canonical.location,
				revision: canonical.revision,
			} satisfies TileActorItem;
		});

		const readPreviewKindFx: PixiMainSceneDragPreview["readPreviewKindFx"] = Effect.fn(
			"PixiMainSceneDragPreview.readPreviewKindFx",
		)(({ sourceItem, targetFacts }) =>
			readTileDropPreviewFx({
				game,
				sourceItemId: sourceItem.id,
				sourceLocation: sourceItem.location,
				sourceRevision: sourceItem.revision,
				target: targetFacts.commandTarget,
			}).pipe(Effect.map(({ kind }) => kind)),
		);

		const refreshAttractionEligibilityFx: PixiMainSceneDragPreview["refreshAttractionEligibilityFx"] =
			Effect.fn("PixiMainSceneDragPreview.refreshAttractionEligibilityFx")(function* ({
				candidateActorIds,
				drag,
				sourceItem,
				targetFacts,
			}) {
				const activeCandidateActorIds = new Set(candidateActorIds);
				for (const actorId of drag.attractionEligibilityByActorId.keys()) {
					if (activeCandidateActorIds.has(actorId)) continue;
					drag.attractionEligibilityByActorId.delete(actorId);
				}
				const eligibleActorIds = new Set<string>();
				for (const actorId of candidateActorIds) {
					if (actorId === sourceItem.id) continue;
					const actor = actorStore.actors.get(actorId);
					const canonical = actorStore.canonicalItems.get(actorId);
					if (actor === undefined || actor.container.destroyed) {
						drag.attractionEligibilityByActorId.delete(actorId);
						continue;
					}
					const targetItem = {
						...actor.item,
						location: canonical?.location ?? actor.item.location,
						revision: canonical?.revision ?? actor.item.revision,
					} satisfies TileActorItem;
					const cached = drag.attractionEligibilityByActorId.get(actorId);
					if (
						cached !== undefined &&
						cached.source.id === sourceItem.id &&
						cached.source.revision === sourceItem.revision &&
						(yield* isSameTileActorLocationFx(
							cached.source.location,
							sourceItem.location,
						)) &&
						cached.target.id === targetItem.id &&
						cached.target.revision === targetItem.revision &&
						(yield* isSameTileActorLocationFx(
							cached.target.location,
							targetItem.location,
						))
					) {
						if (cached.eligible) eligibleActorIds.add(actorId);
						continue;
					}
					const previewKind =
						targetFacts.occupant?.id === targetItem.id &&
						targetFacts.occupant.revision === targetItem.revision &&
						(yield* isSameTileActorLocationFx(
							targetFacts.occupant.location,
							targetItem.location,
						))
							? drag.previewKind
							: (yield* readTileDropPreviewFx({
									game,
									sourceItemId: sourceItem.id,
									sourceLocation: sourceItem.location,
									sourceRevision: sourceItem.revision,
									target: {
										kind: "slot",
										location: targetItem.location,
										occupant: {
											itemId: targetItem.id,
											revision: targetItem.revision,
										},
									},
								})).kind;
					if (previewKind === null) continue;
					const eligible =
						(yield* readPixiTileAttractionActorIdFx({
							previewKind,
							targetItem,
						})) !== null;
					drag.attractionEligibilityByActorId.set(actorId, {
						eligible,
						source: {
							id: sourceItem.id,
							location: sourceItem.location,
							revision: sourceItem.revision,
						},
						target: {
							id: targetItem.id,
							location: targetItem.location,
							revision: targetItem.revision,
						},
					});
					if (eligible) eligibleActorIds.add(actorId);
				}
				drag.eligibleAttractionActorIds = eligibleActorIds;
			});

		const previewTargetFx: PixiMainSceneDragPreview["previewTargetFx"] = Effect.fn(
			"PixiMainSceneDragPreview.previewTargetFx",
		)(function* ({ drag, force = false, targetFacts }) {
			const sourceItem = yield* readCurrentSourceFx(drag);
			if (sourceItem === null) {
				drag.target = targetFacts.target;
				drag.targetKey = targetFacts.stableKey;
				drag.targetItem = null;
				drag.previewKind = null;
				drag.previewSource = null;
				yield* surface.renderDropFeedbackFx(null, null);
				return null;
			}
			if (
				!force &&
				drag.targetKey === targetFacts.stableKey &&
				drag.previewSource !== null &&
				drag.previewSource.id === sourceItem.id &&
				drag.previewSource.revision === sourceItem.revision &&
				(yield* isSameTileActorLocationFx(drag.previewSource.location, sourceItem.location))
			) {
				return sourceItem;
			}
			const kind = yield* readPreviewKindFx({
				sourceItem,
				targetFacts,
			});
			drag.target = targetFacts.target;
			drag.targetKey = targetFacts.stableKey;
			drag.targetItem = targetFacts.occupant;
			drag.previewKind = kind;
			drag.previewSource = {
				id: sourceItem.id,
				location: sourceItem.location,
				revision: sourceItem.revision,
			};
			drag.actor.container.cursor = yield* readPixiTileActorCursorFx({
				dragPolicy: "main-target-presence",
				hasDropTarget: targetFacts.target !== null,
				phase: "dragging",
				previewKind: kind,
				running: sourceItem.running,
			});
			yield* surface.renderDropFeedbackFx(targetFacts.target, kind);
			return sourceItem;
		});

		return {
			previewTargetFx,
			readCurrentSourceFx,
			readPreviewKindFx,
			refreshAttractionEligibilityFx,
		} satisfies PixiMainSceneDragPreview;
	},
);
