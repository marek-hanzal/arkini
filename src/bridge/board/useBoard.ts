import { useCallback } from "react";

import { useGame } from "~/bridge/game/useGame";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useBoard {
	export interface Item {
		readonly id: string;
		readonly revision: string;
		readonly itemId: string;
		readonly title: string;
		readonly x: number;
		readonly y: number;
		readonly quantity: number;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
	}

	export interface Result {
		readonly currentSpace: number;
		readonly width: number;
		readonly height: number;
		readonly title: string;
		readonly items: ReadonlyArray<Item>;
	}
}

const readPrimaryAssetId = (
	runtime: RuntimeSchema.Type,
	item: RuntimeSchema.Type["items"][number]["item"],
) => {
	if (item.type === "cheat:speed") {
		return item.asset.source[runtime.session.speedMode === "accelerated" ? 0 : 1];
	}

	return item.asset.source[0];
};

/** Projects the currently presented board directly from the latest canonical runtime. */
export const useBoard = (): useBoard.Result => {
	const game = useGame();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useBoard.Result => ({
			currentSpace: runtime.currentSpace,
			width: game.config.meta.board.width,
			height: game.config.meta.board.height,
			title: game.config.meta.title,
			items: runtime.items.flatMap((item): useBoard.Item[] => {
				if (
					item.location.scope !== "board" ||
					item.location.space !== runtime.currentSpace
				) {
					return [];
				}

				return [
					{
						id: item.id,
						revision: item.revision,
						itemId: item.item.id,
						title: item.item.title,
						x: item.location.position.x,
						y: item.location.position.y,
						quantity: item.quantity,
						sourceUrl: game.getResourceUrl(readPrimaryAssetId(runtime, item.item)),
						...(item.item.asset.composite === undefined
							? {}
							: {
									compositeUrl: game.getResourceUrl(item.item.asset.composite),
								}),
					},
				];
			}),
		}),
		[
			game,
		],
	);

	return useRuntimeSelector(selector);
};
