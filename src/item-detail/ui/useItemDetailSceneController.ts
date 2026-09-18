import { Equal } from "effect";
import { useCallback } from "react";

import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { useRetainedItemDetailProjection } from "~/item-detail-frame/ui/useRetainedItemDetailProjection";
import { readItemDetailIdentityFx } from "~/item-detail-read/fx/readItemDetailIdentityFx";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace useItemDetailSceneController {
	export interface Props {
		readonly target: ItemDetailTarget;
	}
	export interface Identity {
		readonly title: string;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
	}
	export interface Output {
		readonly identity?: Identity;
		readonly stale: boolean;
	}
}

/** Reads only identity; each future panel owns its own gameplay projection. */
export const useItemDetailSceneController = ({
	target,
}: useItemDetailSceneController.Props): useItemDetailSceneController.Output => {
	const game = useGameEngine();
	const { kind, itemId } = target;
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailSceneController.Identity | undefined => {
			if (kind === "definition") {
				const item = game.config.items[itemId];
				if (item === undefined) return undefined;
				return {
					title: item.title,
					sourceUrl: game.getResourceUrlFn(item.artwork.default[0]),
					compositeUrl:
						item.artwork.default[1] === undefined
							? undefined
							: game.getResourceUrlFn(item.artwork.default[1]),
				};
			}
			const identity = game.readOrThrowFn(
				readItemDetailIdentityFx({
					itemId,
					runtime,
				}),
			);
			if (identity.kind === "unavailable") return undefined;
			return {
				title: identity.title,
				sourceUrl: game.getResourceUrlFn(identity.sourceResourceIds[0]),
				compositeUrl:
					identity.sourceResourceIds[1] === undefined
						? undefined
						: game.getResourceUrlFn(identity.sourceResourceIds[1]),
			};
		},
		[
			game,
			kind,
			itemId,
		],
	);
	const identity = useRuntimeSelector(game, selectorFn, Equal.equals);
	const retained = useRetainedItemDetailProjection({
		available: identity !== undefined,
		targetKey: `${kind}:${itemId}`,
		value: identity,
	});
	return {
		identity: retained.value,
		stale: retained.stale,
	};
};
