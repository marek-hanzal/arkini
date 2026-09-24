import Fuse from "fuse.js";
import type { FuseResult, IFuseOptions } from "fuse.js";

export interface FuzzySearchCandidate<Value> {
	readonly terms: readonly string[];
	readonly identityTerms?: readonly string[];
	readonly descriptionTerms?: readonly string[];
	readonly keywordTerms?: readonly string[];
	readonly relatedTerms?: readonly string[];
	readonly value: Value;
}

interface IndexedFuzzySearchCandidate<Value> extends FuzzySearchCandidate<Value> {
	readonly order: number;
}

export type FuzzySearchOptions<Value> = Omit<
	IFuseOptions<FuzzySearchCandidate<Value>>,
	"includeScore" | "keys"
>;

const normalizeExactTermFn = (value: string) => value.trim().toLowerCase();

const compareSearchResultFn = <
	Value extends {
		readonly order: number;
	},
>(
	first: FuseResult<Value>,
	second: FuseResult<Value>,
) => (first.score ?? 1) - (second.score ?? 1) || first.item.order - second.item.order;

/** Builds the canonical exact-first Fuse search over explicit caller-owned terms. */
export const createFuzzySearchFn = <Value>({
	candidates,
	options,
}: {
	readonly candidates: readonly FuzzySearchCandidate<Value>[];
	readonly options?: FuzzySearchOptions<Value>;
}) => {
	const documents: readonly IndexedFuzzySearchCandidate<Value>[] = candidates.map(
		(candidate, order) => ({
			...candidate,
			order,
		}),
	);
	const fuse = new Fuse(documents, {
		threshold: 0.28,
		ignoreLocation: true,
		useTokenSearch: true,
		tokenMatch: "all",
		...options,
		// Keep item title, identity, description and aliases distinct while retaining primary-term priority elsewhere.
		keys: [
			{
				name: "terms",
				weight: 0.4,
			},
			{
				name: "identityTerms",
				weight: 0.2,
			},
			{
				name: "descriptionTerms",
				weight: 0.16,
			},
			{
				name: "keywordTerms",
				weight: 0.14,
			},
			{
				name: "relatedTerms",
				weight: 0.1,
			},
		],
		includeScore: true,
	});
	return (query: string): readonly Value[] => {
		const normalizedQuery = query.trim();
		if (normalizedQuery === "") return documents.map(({ value }) => value);
		const exactQuery = normalizeExactTermFn(normalizedQuery);
		const exact = documents.filter(({ terms }) =>
			terms.some((term) => normalizeExactTermFn(term) === exactQuery),
		);
		const exactOrders = new Set(exact.map(({ order }) => order));
		const exactIdentity = documents.filter(
			({ identityTerms, order }) =>
				!exactOrders.has(order) &&
				identityTerms?.some((term) => normalizeExactTermFn(term) === exactQuery),
		);
		const fuzzyMatches = fuse.search(normalizedQuery);
		fuzzyMatches.sort(compareSearchResultFn);
		if (exact.length === 0 && exactIdentity.length === 0)
			return fuzzyMatches.map(({ item }) => item.value);
		for (const { order } of exactIdentity) exactOrders.add(order);
		return [
			...exact.map(({ value }) => value),
			...exactIdentity.map(({ value }) => value),
			...fuzzyMatches
				.filter(({ item }) => !exactOrders.has(item.order))
				.map(({ item }) => item.value),
		];
	};
};
