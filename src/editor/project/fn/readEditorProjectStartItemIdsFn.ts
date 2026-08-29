import type { EditorProjectStartScope } from "~/editor/project/EditorProjectStartScope";
import { isItemLocationScopeAllowedFn } from "~/engine/location/fn/isItemLocationScopeAllowedFn";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace readEditorProjectStartItemIdsFn {
	export interface Props {
		readonly items: GameConfigSchema.Type["items"];
		readonly scope: EditorProjectStartScope;
	}
}

/** Reads canonical items that may own one editable initial grid scope. */
export const readEditorProjectStartItemIdsFn = ({
	items,
	scope,
}: readEditorProjectStartItemIdsFn.Props) => {
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
};
