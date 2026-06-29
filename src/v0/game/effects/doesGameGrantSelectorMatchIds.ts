import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export namespace doesGameGrantSelectorMatchIds {
	export interface Props {
		grantIds: ReadonlySet<string>;
		selector: NonNullable<
			| GameConfig["items"][string]["grantSelector"]
			| GameConfig["products"][string]["grantSelector"]
		>;
	}
}

const hasAnyClauseGrant = (
	grantIds: ReadonlySet<string>,
	clause: {
		ids: readonly string[];
	},
) => clause.ids.some((grantId) => grantIds.has(grantId));

export const doesGameGrantSelectorMatchIds = ({
	grantIds,
	selector,
}: doesGameGrantSelectorMatchIds.Props) => {
	if ("mode" in selector) return true;

	if (selector.anyOf && !selector.anyOf.some((clause) => hasAnyClauseGrant(grantIds, clause))) {
		return false;
	}
	if (selector.allOf && !selector.allOf.every((clause) => hasAnyClauseGrant(grantIds, clause))) {
		return false;
	}
	if (selector.noneOf?.some((clause) => hasAnyClauseGrant(grantIds, clause))) {
		return false;
	}

	return true;
};
