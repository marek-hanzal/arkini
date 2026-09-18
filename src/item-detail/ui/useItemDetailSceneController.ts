import { Equal } from "effect";
import { useCallback, useLayoutEffect, useState } from "react";

import { readItemDetailRemovalFn } from "~/item-detail-read/fn/readItemDetailRemovalFn";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { useRetainedItemDetailProjection } from "~/item-detail-frame/ui/useRetainedItemDetailProjection";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";

export namespace useItemDetailSceneController {
	export interface Props {
		readonly target: ItemDetailTarget;
	}
	export interface Detail
		extends Pick<ItemSchema.Type, "description" | "scope" | "maxStackSize" | "maxCount"> {
		readonly title: string;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
		readonly units?: {
			readonly remaining: number;
			readonly total: number;
		};
	}
	export interface Output {
		readonly detail?: Detail;
		readonly stale: boolean;
		readonly removalReason?: readItemDetailRemovalFn.Snapshot["reason"];
	}
}

/** Keeps identity and basic authored facts together for the exact visible item. */
export const useItemDetailSceneController = ({
	target,
}: useItemDetailSceneController.Props): useItemDetailSceneController.Output => {
	const game = useGameEngine();
	const { kind, itemId } = target;
	const [removal, setRemoval] = useState<{
		readonly itemId: string;
		readonly snapshot: readItemDetailRemovalFn.Snapshot;
	}>();
	useLayoutEffect(() => {
		if (kind !== "runtime") return;
		// Observe every commit, even when React batches several runtime renders together.
		return game.subscribeTransitionsFn((transition) => {
			const snapshot = readItemDetailRemovalFn(transition, itemId);
			if (snapshot !== undefined)
				setRemoval({
					itemId,
					snapshot,
				});
			else if (transition.runtime.items.some((item) => item.id === itemId))
				setRemoval(undefined);
		});
	}, [
		game,
		kind,
		itemId,
	]);
	const finalSnapshot =
		kind === "runtime" && removal?.itemId === itemId ? removal.snapshot : undefined;
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailSceneController.Detail | undefined => {
			const runtimeItem =
				kind === "runtime"
					? (runtime.items.find((candidate) => candidate.id === itemId) ??
						finalSnapshot?.snapshot)
					: undefined;
			const item = kind === "definition" ? game.config.items[itemId] : runtimeItem?.item;
			if (item === undefined) return undefined;
			return {
				title: item.title,
				sourceUrl: game.getResourceUrlFn(item.artwork.default[0]),
				compositeUrl:
					item.artwork.default[1] === undefined
						? undefined
						: game.getResourceUrlFn(item.artwork.default[1]),
				description: item.description,
				scope: item.scope,
				maxStackSize: item.maxStackSize,
				maxCount: item.maxCount,
				units:
					item.units === undefined
						? undefined
						: {
								remaining:
									runtimeItem === undefined
										? item.units.amount
										: (readItemRemainingUnitsFn(runtimeItem) ??
											item.units.amount),
								total: item.units.amount,
							},
			};
		},
		[
			game,
			kind,
			itemId,
			finalSnapshot,
		],
	);
	const detail = useRuntimeSelector(game, selectorFn, Equal.equals);
	const retained = useRetainedItemDetailProjection({
		available: detail !== undefined,
		targetKey: `${kind}:${itemId}`,
		value: detail,
	});
	return {
		detail: retained.value,
		stale: finalSnapshot !== undefined || retained.stale,
		removalReason: finalSnapshot?.reason,
	};
};
