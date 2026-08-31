import { Equal } from "effect";
import { type ComponentProps, useCallback } from "react";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readItemDetailTabsFn } from "~/item-detail-read/fn/readItemDetailTabsFn";
import { readItemDetailSourcesFx } from "~/item-detail-read/fx/readItemDetailSourcesFx";
import type { ItemDetailTabEnumSchema } from "~/item-detail-read/schema/ItemDetailTabEnumSchema";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemSourcesTab } from "~/item-detail/ui/ItemSourcesTab";

const unavailable = {
	kind: "unavailable",
} as const;

export namespace useItemDetailNavigationController {
	export type Target =
		| {
				readonly kind: "runtime";
				readonly itemId: IdSchema.Type;
		  }
		| {
				readonly kind: "definition";
				readonly itemId: IdSchema.Type;
		  };

	export type SourcesProjection =
		| ComponentProps<typeof ItemSourcesTab>["sources"]
		| {
				readonly kind: "unavailable";
		  };

	export interface Props {
		readonly target: Target;
	}

	export interface Output {
		readonly sources: SourcesProjection;
		readonly tabs: readonly ItemDetailTabEnumSchema.Type[];
	}
}

/** Projects source ownership and the tabs admitted by that exact target. */
export const useItemDetailNavigationController = ({
	target,
}: useItemDetailNavigationController.Props): useItemDetailNavigationController.Output => {
	const game = useGameEngine();
	const { itemId, kind } = target;
	const sourceSelectorFn = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailNavigationController.SourcesProjection => {
			const projection = game.readOrThrowFn(
				readItemDetailSourcesFx({
					target: {
						kind,
						itemId,
					},
					runtime,
				}),
			);
			if (projection.kind === "unavailable") return unavailable;
			const targetItem = game.config.items[projection.targetDefinitionItemId];
			if (targetItem === undefined) return unavailable;
			return {
				kind: "available",
				itemId: projection.itemId,
				targetTitle: targetItem.title,
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
							sourceUrl: game.getResourceUrlFn(owner.item.asset.default[0]),
							...(configured.asset.default[1] === undefined
								? {}
								: {
										compositeUrl: game.getResourceUrlFn(
											configured.asset.default[1],
										),
									}),
							space: source.space,
							line: source.line,
						} satisfies ComponentProps<
							typeof ItemSourcesTab
						>["sources"]["source"][number],
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
	const sources = useRuntimeSelector(game, sourceSelectorFn, Equal.equals);
	const tabsSelectorFn = useCallback(
		(runtime: RuntimeSchema.Type) =>
			readItemDetailTabsFn({
				target:
					kind === "runtime"
						? {
								kind,
								item: runtime.items.find((item) => item.id === itemId),
							}
						: {
								kind,
							},
				sources,
			}),
		[
			itemId,
			kind,
			sources,
		],
	);
	const tabs = useRuntimeSelector(game, tabsSelectorFn, Equal.equals);

	return {
		sources,
		tabs,
	};
};
