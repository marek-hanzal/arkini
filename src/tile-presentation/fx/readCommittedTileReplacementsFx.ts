import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorVisual } from "~/tile-presentation/type/TileActorVisual";
import { readTileActorVisualFx } from "~/tile-presentation/fx/readTileActorVisualFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";

interface TileReplacement {
	readonly actorId: string;
	readonly key: string;
	readonly previous: TileActorVisual;
	readonly previousQuantity: number;
}

/** Compiles exact same-slot canonical replacements while excluding moves and swaps. */
export const readCommittedTileReplacementsFx = Effect.fn("readCommittedTileReplacementsFx")(
	function* ({
		game,
		transition,
	}: {
		readonly game: Pick<GameEngine, "getResourceUrl">;
		readonly transition: CommittedTransitionSchema.Type;
	}) {
		if (transition.previousRuntime === null) return [];
		const replacements = yield* Effect.forEach(transition.events, (event, eventIndex) =>
			match(event)
				.with(
					{
						type: GameEventEnumSchema.enum.ItemMerged,
						effect: TargetEffectSchema.enum.Replace,
					},
					(merged) =>
						Effect.gen(function* () {
							const previousRuntimeItem = transition.previousRuntime?.items.find(
								(item) => item.id === merged.targetItemId,
							);
							const currentRuntimeItem = transition.runtime.items.find(
								(item) => item.id === merged.targetItemId,
							);
							if (
								previousRuntimeItem === undefined ||
								currentRuntimeItem === undefined
							) {
								return null;
							}
							const previous = Option.getOrUndefined(
								isGridRuntimeItemFn(previousRuntimeItem),
							);
							const current = Option.getOrUndefined(
								isGridRuntimeItemFn(currentRuntimeItem),
							);
							if (
								previous === undefined ||
								current === undefined ||
								previous.item.id !== merged.targetCanonicalItemId ||
								current.item.id !== merged.resultCanonicalItemId ||
								previous.item.id === current.item.id ||
								!isSameGridLocationFn({
									left: previous.location,
									right: current.location,
								})
							) {
								return null;
							}
							return {
								actorId: current.id,
								key: `${transition.sequence}:${eventIndex}:replacement`,
								previous: yield* readTileActorVisualFx({
									game,
									item: previous.item,
								}),
								previousQuantity: previous.quantity,
							} satisfies TileReplacement;
						}),
				)
				.otherwise(() => Effect.succeed(null)),
		);
		return replacements.filter(
			(replacement): replacement is TileReplacement => replacement !== null,
		);
	},
);
