import { z } from "zod";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";
import {
	ResolvedDomainSelectorClauseSchema,
	ResolvedDomainSelectorSchema,
} from "~/config/schema/GameDomainSelectorSchema";
import {
	addIssue,
	type GameConfigIssuePath,
	validateUniqueStringList,
} from "~/config/validation/GameConfigValidationCommon";

export const readDomainSelectorIds = (selector: z.infer<typeof ResolvedDomainSelectorSchema>) => {
	if ("mode" in selector) return [];
	return [
		...(selector.anyOf ?? []),
		...(selector.allOf ?? []),
		...(selector.noneOf ?? []),
	].flatMap((clause) => clause.ids);
};

export const validateResolvedDomainSelectorClauses = ({
	clauses,
	ctx,
	hasEntity,
	label,
	path,
}: {
	clauses: readonly z.infer<typeof ResolvedDomainSelectorClauseSchema>[] | undefined;
	ctx: z.RefinementCtx;
	hasEntity: (entityId: string) => boolean;
	label: string;
	path: GameConfigIssuePath;
}) => {
	for (const [clauseIndex, clause] of (clauses ?? []).entries()) {
		validateUniqueStringList(
			ctx,
			[
				...path,
				clauseIndex,
				"ids",
			],
			clause.ids,
			(value) => `Duplicate ${label} "${value}".`,
		);

		for (const [index, entityId] of clause.ids.entries()) {
			if (hasEntity(entityId)) continue;
			addIssue(
				ctx,
				[
					...path,
					clauseIndex,
					"ids",
					index,
				],
				`Missing ${label} "${entityId}".`,
			);
		}
	}
};

export const validateResolvedDomainSelector = ({
	ctx,
	entityIds,
	hasEntity,
	label,
	path,
	selector,
}: {
	ctx: z.RefinementCtx;
	entityIds: readonly string[];
	hasEntity: (entityId: string) => boolean;
	label: string;
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) => {
	if ("mode" in selector) return;

	const selectorCount =
		(selector.anyOf ? 1 : 0) + (selector.allOf ? 1 : 0) + (selector.noneOf ? 1 : 0);
	if (selectorCount === 0) {
		addIssue(ctx, path, `Domain selector must define anyOf, allOf, noneOf, or mode: "all".`);
	}

	validateResolvedDomainSelectorClauses({
		clauses: selector.anyOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"anyOf",
		],
	});
	validateResolvedDomainSelectorClauses({
		clauses: selector.allOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"allOf",
		],
	});
	validateResolvedDomainSelectorClauses({
		clauses: selector.noneOf,
		ctx,
		hasEntity,
		label,
		path: [
			...path,
			"noneOf",
		],
	});

	if (
		!entityIds.some((entityId) =>
			doesResolvedDomainSelectorMatchId({
				entityId,
				selector,
			}),
		)
	) {
		addIssue(ctx, path, `Domain selector matched no ${label}s.`);
	}
};

type GrantSelectorClauseKey = "allOf" | "anyOf" | "noneOf";

export const validateGameGrantSelectorClauseGroup = ({
	ctx,
	grantIds,
	path,
	selector,
	selectorKey,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	path: GameConfigIssuePath;
	selector: Exclude<
		z.infer<typeof ResolvedDomainSelectorSchema>,
		{
			mode: "all";
		}
	>;
	selectorKey: GrantSelectorClauseKey;
}) => {
	validateResolvedDomainSelectorClauses({
		clauses: selector[selectorKey],
		ctx,
		hasEntity: (grantId) => grantIds.includes(grantId),
		label: "grant",
		path: [
			...path,
			selectorKey,
		],
	});
};

export const validateGameGrantSelector = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
	grantIds: readonly string[],
) => {
	if ("mode" in selector) return;

	const selectorCount =
		(selector.anyOf ? 1 : 0) + (selector.allOf ? 1 : 0) + (selector.noneOf ? 1 : 0);
	if (selectorCount === 0) {
		addIssue(ctx, path, `Grant selector must define anyOf, allOf, noneOf, or mode: "all".`);
	}

	for (const selectorKey of [
		"anyOf",
		"allOf",
		"noneOf",
	] satisfies GrantSelectorClauseKey[]) {
		validateGameGrantSelectorClauseGroup({
			ctx,
			grantIds,
			path,
			selector,
			selectorKey,
		});
	}
};

export const validateGameLineItemSelector = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
	entities: {
		entityIds: readonly string[];
		hasEntity: (itemId: string) => boolean;
	},
) => {
	validateResolvedDomainSelector({
		ctx,
		entityIds: entities.entityIds,
		hasEntity: entities.hasEntity,
		label: "item",
		path,
		selector,
	});
};

export const doesGameGrantSelectorMatchIdsLocal = (
	grantIds: ReadonlySet<string>,
	selector: z.infer<typeof ResolvedDomainSelectorSchema>,
) => {
	if ("mode" in selector) return true;

	if (selector.anyOf && !selector.anyOf.some((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}
	if (selector.allOf && !selector.allOf.every((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}
	if (selector.noneOf?.some((clause) => hasAnyGrantId(grantIds, clause.ids))) {
		return false;
	}

	return true;
};

const hasAnyGrantId = (grantIds: ReadonlySet<string>, ids: readonly string[]) =>
	ids.some((id) => grantIds.has(id));

export const readMandatoryGrantIds = (selector: z.infer<typeof ResolvedDomainSelectorSchema>) => {
	const grantIds = new Set<string>();
	if ("mode" in selector) return grantIds;

	for (const clause of selector.allOf ?? []) {
		const [grantId] = clause.ids;
		if (clause.ids.length === 1 && grantId) {
			grantIds.add(grantId);
		}
	}

	return grantIds;
};

export const readSelectorMatchingIds = ({
	entityIds,
	selector,
}: {
	entityIds: readonly string[];
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}) =>
	entityIds.filter((entityId) =>
		doesResolvedDomainSelectorMatchId({
			entityId,
			selector,
		}),
	);
