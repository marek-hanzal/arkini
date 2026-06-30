export namespace doesResolvedDomainSelectorMatchId {
	export interface Props {
		entityId: string;
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
			  }
			| undefined;
	}
}

export const doesResolvedDomainSelectorMatchId = ({
	entityId,
	selector,
}: doesResolvedDomainSelectorMatchId.Props) => {
	if (!selector || "mode" in selector) return true;
	if (selector.anyOf && !selector.anyOf.some((clause) => clause.ids.includes(entityId))) {
		return false;
	}
	if (selector.allOf && !selector.allOf.every((clause) => clause.ids.includes(entityId))) {
		return false;
	}
	if (selector.noneOf?.some((clause) => clause.ids.includes(entityId))) {
		return false;
	}
	return true;
};
