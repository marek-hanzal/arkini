export namespace doesGameGrantSelectorMatchIds {
	export interface Props {
		grantIds: ReadonlySet<string>;
		selector:
			| {
					mode: "all";
			  }
			| {
					anyOf?: readonly {
						ids: readonly string[];
					}[];
					allOf?: readonly {
						ids: readonly string[];
					}[];
					noneOf?: readonly {
						ids: readonly string[];
					}[];
			  };
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
