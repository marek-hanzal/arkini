import { useMemo } from "react";

import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";

export interface FuseSearchCandidate<Identity extends string> {
	readonly identity: Identity;
	readonly terms: readonly string[];
}

/** Searches explicit authorized presentation terms while retaining a stable Fuse corpus by identity. */
export const useFuseSearch = <Identity extends string>(
	candidates: readonly FuseSearchCandidate<Identity>[],
	query: string,
): readonly Identity[] => {
	const corpusKey = JSON.stringify(
		candidates.map(({ identity, terms }) => [
			identity,
			terms,
		]),
	);
	const fuzzyFn = useMemo(
		() =>
			createFuzzySearchFn({
				candidates: candidates.map(({ identity, terms }) => ({
					terms,
					value: identity,
				})),
			}),
		[
			corpusKey,
		],
	);
	return useMemo(
		() => fuzzyFn(query),
		[
			fuzzyFn,
			query,
		],
	);
};
