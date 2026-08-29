import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useItemDetailSources {
	export type Target =
		| {
				readonly kind: "runtime";
				readonly itemId: IdSchema.Type;
		  }
		| {
				readonly kind: "definition";
				readonly itemId: IdSchema.Type;
		  };

	export interface Source {
		readonly ownerItemId: string;
		readonly ownerDefinitionItemId: string;
		readonly title: string;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
		readonly space?: number;
		readonly line: readonly {
			readonly lineId: string;
			readonly title: string;
			readonly output: readonly readItemDetailSourcesFx.OutputFact[];
		}[];
	}

	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: string;
				readonly targetTitle: string;
				readonly source: readonly Source[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useItemDetailSources.Projection;

/** Projects owned one-hop sources for one inspected runtime or definition item. */
export const useItemDetailSources = (
	target: useItemDetailSources.Target,
): useItemDetailSources.Projection => {
	const game = useGameEngine();
	const { itemId, kind } = target;
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailSources.Projection => {
			const projection = game.readOrThrow(
				readItemDetailSourcesFx({
					target: {
						kind,
						itemId,
					},
					runtime,
				}),
			);
			if (projection.kind === "unavailable") return unavailable;
			const target = game.config.items[projection.targetDefinitionItemId];
			if (target === undefined) return unavailable;
			return {
				kind: "available",
				itemId: projection.itemId,
				targetTitle: target.title,
				source: projection.source.flatMap((source) => {
					const configured = game.config.items[source.ownerDefinitionItemId];
					if (configured === undefined) return [];
					const owner = runtime.items.find(
						(candidate) => candidate.id === source.ownerItemId,
					);
					if (owner === undefined) return [];
					return [
						{
							ownerItemId: source.ownerItemId,
							ownerDefinitionItemId: source.ownerDefinitionItemId,
							title: configured.title,
							sourceUrl: game.getResourceUrl(owner.item.asset.default[0]),
							...(configured.asset.default[1] === undefined
								? {}
								: {
										compositeUrl: game.getResourceUrl(
											configured.asset.default[1],
										),
									}),
							space: source.space,
							line: source.line,
						} satisfies useItemDetailSources.Source,
					];
				}),
			};
		},
		[
			game,
			itemId,
			kind,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};
