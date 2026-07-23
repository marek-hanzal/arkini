import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useInventory {
	export interface Item {
		readonly id: string;
		readonly revision: string;
		readonly x: number;
		readonly y: number;
	}

	export interface Result {
		readonly width: number;
		readonly height: number;
		readonly items: ReadonlyArray<Item>;
	}
}

/** Projects the global inventory directly from the latest canonical runtime. */
export const useInventory = (): useInventory.Result => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useInventory.Result => ({
			width: game.config.meta.inventory.width,
			height: game.config.meta.inventory.height,
			items: runtime.items.flatMap((item): useInventory.Item[] => {
				if (item.location.scope !== LocationScopeEnumSchema.enum.Inventory) return [];
				return [
					{
						id: item.id,
						revision: item.revision,
						x: item.location.position.x,
						y: item.location.position.y,
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
