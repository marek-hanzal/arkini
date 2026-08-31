import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { isSameTileActorLocationFn } from "~/tile-rendering/fn/isSameTileActorLocationFn";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { readTileDropPreviewFx } from "~/tile-interaction/fx/readTileDropPreviewFx";
import type {
	MainInteractionSurface,
	MainInteractionTargetFacts as TargetFacts,
} from "~/tile-interaction/type/MainInteractionSurface";

export namespace createMainDragPreviewFx {
	export interface State {
		readonly actor: PixiTileActor;
		readonly sourceItem: TileActorItem;
		attractionEligibilityByActorId: Map<
			string,
			{
				readonly eligible: boolean;
				readonly source: Pick<TileActorItem, "id" | "location" | "revision">;
				readonly target: Pick<TileActorItem, "id" | "location" | "revision">;
			}
		>;
		eligibleAttractionActorIds: ReadonlySet<string>;
		previewKind: readTileDropPreviewFx.Result["kind"] | null;
		previewSource: Pick<TileActorItem, "id" | "location" | "revision"> | null;
		target: NonNullable<TargetFacts["target"]> | null;
		targetKey: string;
		targetItem: TileActorItem | null;
	}

	export interface Output {
		readonly previewTargetFx: (props: {
			readonly drag: State;
			readonly force?: boolean;
			readonly targetFacts: TargetFacts;
		}) => Effect.Effect<TileActorItem | null, never, never>;
		readonly readAttractionActorIdFn: (props: {
			readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
			readonly targetItem: TileActorItem | null;
		}) => string | null;
		readonly readCurrentSourceFx: (
			drag: State,
		) => Effect.Effect<TileActorItem | null, never, never>;
		readonly readPreviewKindFx: (props: {
			readonly sourceItem: TileActorItem;
			readonly targetFacts: TargetFacts;
		}) => Effect.Effect<readTileDropPreviewFx.Result["kind"], never, never>;
		readonly refreshAttractionEligibilityFx: (props: {
			readonly candidateActorIds: ReadonlyArray<string>;
			readonly drag: State;
			readonly sourceItem: TileActorItem;
			readonly targetFacts: TargetFacts;
		}) => Effect.Effect<void, never, never>;
	}
}

interface Props {
	readonly actorStore: MainActorStore;
	readonly game: GameEngine;
	readonly surface: MainInteractionSurface;
}

const readAttractionActorIdFn = ({
	previewKind,
	targetItem,
}: {
	readonly previewKind: readTileDropPreviewFx.Result["kind"] | null;
	readonly targetItem: TileActorItem | null;
}): string | null => {
	if (targetItem === null) return null;
	return match(previewKind)
		.with(null, () => null)
		.with(
			DropItemResultKind.Merge,
			DropItemResultKind.Stack,
			DropItemResultKind.StoreInput,
			() => targetItem.id,
		)
		.with(
			DropItemResultKind.Ignored,
			DropItemResultKind.Move,
			DropItemResultKind.Reject,
			DropItemResultKind.StoreInventory,
			DropItemResultKind.Swap,
			() => null,
		)
		.exhaustive();
};

/** Owns canonical source rebasing, engine preview projection, and attraction eligibility. */
export const createMainDragPreviewFx = Effect.fn("createMainDragPreviewFx")(function* ({
	actorStore,
	game,
	surface,
}: Props) {
	const readCurrentSourceFx = Effect.fn("MainDragPreview.readCurrentSourceFx")(function* (
		drag: createMainDragPreviewFx.State,
	) {
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

	const readPreviewKindFx = Effect.fn("MainDragPreview.readPreviewKindFx")(
		({
			sourceItem,
			targetFacts,
		}: {
			readonly sourceItem: TileActorItem;
			readonly targetFacts: TargetFacts;
		}) =>
			readTileDropPreviewFx({
				game,
				sourceItemId: sourceItem.id,
				sourceLocation: sourceItem.location,
				sourceRevision: sourceItem.revision,
				target: targetFacts.commandTarget,
			}).pipe(Effect.map(({ kind }) => kind)),
	);

	const refreshAttractionEligibilityFx = Effect.fn(
		"MainDragPreview.refreshAttractionEligibilityFx",
	)(function* ({
		candidateActorIds,
		drag,
		sourceItem,
		targetFacts,
	}: {
		readonly candidateActorIds: ReadonlyArray<string>;
		readonly drag: createMainDragPreviewFx.State;
		readonly sourceItem: TileActorItem;
		readonly targetFacts: TargetFacts;
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

	const previewTargetFx = Effect.fn("MainDragPreview.previewTargetFx")(function* ({
		drag,
		force = false,
		targetFacts,
	}: {
		readonly drag: createMainDragPreviewFx.State;
		readonly force?: boolean;
		readonly targetFacts: TargetFacts;
	}) {
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
		readAttractionActorIdFn,
		readCurrentSourceFx,
		readPreviewKindFx,
		refreshAttractionEligibilityFx,
	} satisfies createMainDragPreviewFx.Output;
});
