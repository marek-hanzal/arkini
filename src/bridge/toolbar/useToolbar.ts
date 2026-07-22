import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace useToolbar {
	export interface Item {
		readonly id: string;
		readonly revision: string;
		readonly x: number;
		readonly y: number;
	}

	export interface Result {
		readonly size: number;
		readonly items: ReadonlyArray<Item>;
	}
}

/** Projects the optional global toolbar directly from the latest canonical runtime. */
export const useToolbar = (): useToolbar.Result => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useToolbar.Result => ({
			size: game.config.meta.toolbarSize ?? 0,
			items: runtime.items.flatMap((item): useToolbar.Item[] => {
				if (item.location.scope !== LocationScopeEnumSchema.enum.Toolbar) return [];
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
