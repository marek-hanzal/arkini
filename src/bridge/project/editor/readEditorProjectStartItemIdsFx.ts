import { Effect } from "effect";

import type { EditorProjectStartScope } from "~/bridge/project/editor/EditorProjectStartScope";
import { isItemLocationScopeAllowedFn } from "~/engine/location/fn/isItemLocationScopeAllowedFn";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace readEditorProjectStartItemIdsFx {
	export interface Props {
		readonly items: GameConfigSchema.Type["items"];
		readonly scope: EditorProjectStartScope;
	}
}

/** Reads canonical items that may own one editable initial grid scope. */
export const readEditorProjectStartItemIdsFx = Effect.fnUntraced(function* ({
	items,
	scope,
}: readEditorProjectStartItemIdsFx.Props) {
	const itemIds = new Set<string>();
	for (const item of Object.values(items)) {
		if (
			isItemLocationScopeAllowedFn({
				item,
				locationScope: scope,
			})
		) {
			itemIds.add(item.id);
		}
	}
	return itemIds;
});
