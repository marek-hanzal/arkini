import type { ProjectStartScope } from "~/project-authoring/type/ProjectStartScope";
import { isItemLocationScopeAllowedFn } from "~/item-location/fn/isItemLocationScopeAllowedFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export namespace readProjectStartItemIdsFn {
	export interface Props {
		readonly items: GameConfigSchema.Type["items"];
		readonly scope: ProjectStartScope;
	}
}

/** Reads canonical items that may own one editable initial grid scope. */
export const readProjectStartItemIdsFn = ({ items, scope }: readProjectStartItemIdsFn.Props) => {
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
