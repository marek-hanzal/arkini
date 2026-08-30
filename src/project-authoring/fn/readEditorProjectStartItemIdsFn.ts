import type { EditorProjectStartScope } from "~/project-authoring/EditorProjectStartScope";
import { isItemLocationScopeAllowedFn } from "~/item-location/fn/isItemLocationScopeAllowedFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

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
