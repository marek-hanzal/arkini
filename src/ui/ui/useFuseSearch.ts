import { useMemo } from "react";

import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";

export interface FuseSearchCandidate<Identity extends string> {
	readonly identity: Identity;
	readonly terms: readonly string[];
	readonly identityTerms?: readonly string[];
	readonly descriptionTerms?: readonly string[];
	readonly keywordTerms?: readonly string[];
	readonly relatedTerms?: readonly string[];
}

/** Searches explicit authorized presentation terms while retaining a stable Fuse corpus by identity. */
export const useFuseSearch = <Identity extends string>(
	candidates: readonly FuseSearchCandidate<Identity>[],
	query: string,
): readonly Identity[] => {
	const corpusKey = useMemo(
		() =>
			JSON.stringify(
				candidates.map(
					({
						identity,
						terms,
						identityTerms,
						descriptionTerms,
						keywordTerms,
						relatedTerms,
					}) => [
						identity,
						terms,
						identityTerms,
						descriptionTerms,
						keywordTerms,
						relatedTerms,
					],
				),
			),
		[
			candidates,
		],
	);
	const fuzzyFn = useMemo(
		() =>
			createFuzzySearchFn({
				candidates: candidates.map(
					({
						identity,
						terms,
						identityTerms,
						descriptionTerms,
						keywordTerms,
						relatedTerms,
					}) => ({
						terms,
						identityTerms,
						descriptionTerms,
						keywordTerms,
						relatedTerms,
						value: identity,
					}),
				),
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
