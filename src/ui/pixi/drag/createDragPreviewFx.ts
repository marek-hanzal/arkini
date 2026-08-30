import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { isSameTileActorLocationFn } from "~/ui/pixi/actor/fn/isSameTileActorLocationFn";
import { readTileDropPreviewFx } from "~/ui/pixi/drag/readTileDropPreviewFx";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import { readActorCursorFn } from "~/ui/pixi/actor/fn/readActorCursorFn";
import type { DragPreview } from "~/ui/pixi/drag/DragPreview";
import { readAttractionActorIdFn } from "~/ui/pixi/magnet/fn/readAttractionActorIdFn";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";

export namespace createDragPreviewFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly game: GameEngine;
		readonly surface: MainSurface;
	}
}

/** Creates stateless canonical source and engine-preview projection for main-scene dragging. */
export const createDragPreviewFx = Effect.fn("createDragPreviewFx")(function* ({
	actorStore,
	game,
	surface,
}: createDragPreviewFx.Props) {
	const readCurrentSourceFx: DragPreview["readCurrentSourceFx"] = Effect.fn(
		"DragPreview.readCurrentSourceFx",
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
			!isSameTileActorLocationFn(canonical.location, drag.sourceItem.location)
		) {
			return null;
		}
		return {
			...drag.actor.item,
			location: canonical.location,
			revision: canonical.revision,
		} satisfies TileActorItem;
	});

	const readPreviewKindFx: DragPreview["readPreviewKindFx"] = Effect.fn(
		"DragPreview.readPreviewKindFx",
	)(({ sourceItem, targetFacts }) =>
		readTileDropPreviewFx({
			game,
			sourceItemId: sourceItem.id,
			sourceLocation: sourceItem.location,
			sourceRevision: sourceItem.revision,
			target: targetFacts.commandTarget,
		}).pipe(Effect.map(({ kind }) => kind)),
	);

	const refreshAttractionEligibilityFx: DragPreview["refreshAttractionEligibilityFx"] = Effect.fn(
		"DragPreview.refreshAttractionEligibilityFx",
	)(function* ({ candidateActorIds, drag, sourceItem, targetFacts }) {
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
				isSameTileActorLocationFn(cached.source.location, sourceItem.location) &&
				cached.target.id === targetItem.id &&
				cached.target.revision === targetItem.revision &&
				isSameTileActorLocationFn(cached.target.location, targetItem.location)
			) {
				if (cached.eligible) eligibleActorIds.add(actorId);
				continue;
			}
			const previewKind =
				targetFacts.occupant?.id === targetItem.id &&
				targetFacts.occupant.revision === targetItem.revision &&
				isSameTileActorLocationFn(targetFacts.occupant.location, targetItem.location)
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
				readAttractionActorIdFn({
					previewKind,
					targetItem,
				}) !== null;
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

	const previewTargetFx: DragPreview["previewTargetFx"] = Effect.fn(
		"DragPreview.previewTargetFx",
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
			isSameTileActorLocationFn(drag.previewSource.location, sourceItem.location)
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
		drag.actor.container.cursor = readActorCursorFn({
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
	} satisfies DragPreview;
});
