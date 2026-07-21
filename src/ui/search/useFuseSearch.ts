import Fuse from "fuse.js";
import { useMemo } from "react";

export interface FuseSearchCandidate<Identity extends string> {
	readonly identity: Identity;
	readonly terms: readonly string[];
}

interface FuseDocument<Identity extends string> extends FuseSearchCandidate<Identity> {
	readonly order: number;
}

const serializeCandidates = <Identity extends string>(
	candidates: readonly FuseSearchCandidate<Identity>[],
) =>
	JSON.stringify(
		candidates.map(({ identity, terms }) => [
			identity,
			terms,
		]),
	);

/** Searches explicit authorized presentation terms while retaining a stable Fuse corpus by identity. */
export const useFuseSearch = <Identity extends string>(
	candidates: readonly FuseSearchCandidate<Identity>[],
	query: string,
): readonly Identity[] => {
	const corpusKey = serializeCandidates(candidates);
	const documents = useMemo<readonly FuseDocument<Identity>[]>(
		() =>
			candidates.map((candidate, order) => ({
				...candidate,
				order,
			})),
		[
			corpusKey,
		],
	);
	const fuse = useMemo(
		() =>
			new Fuse(documents, {
				keys: [
					"terms",
				],
				threshold: 0.28,
				ignoreLocation: true,
				includeScore: true,
			}),
		[
			documents,
		],
	);
	const normalizedQuery = query.trim();
	return useMemo(() => {
		if (normalizedQuery === "") return documents.map(({ identity }) => identity);
		return fuse
			.search(normalizedQuery)
			.sort(
				(first, second) =>
					(first.score ?? 1) - (second.score ?? 1) ||
					first.item.order - second.item.order,
			)
			.map(({ item }) => item.identity);
	}, [
		documents,
		fuse,
		normalizedQuery,
	]);
};
