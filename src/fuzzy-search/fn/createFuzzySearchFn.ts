import Fuse from "fuse.js";
import type { FuseResult, IFuseOptions } from "fuse.js";

export interface FuzzySearchCandidate<Value> {
	readonly terms: readonly string[];
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
		keys: [
			"terms",
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
		if (exact.length > 0) return exact.map(({ value }) => value);
		const fuzzyMatches = fuse.search(normalizedQuery);
		fuzzyMatches.sort(compareSearchResultFn);
		return fuzzyMatches.map(({ item }) => item.value);
	};
};
