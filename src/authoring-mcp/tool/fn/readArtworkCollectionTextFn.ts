import type { Project } from "~/project-authoring/type/Project";
import { readArtworkCollectionFn } from "~/artwork-authoring/fn/readArtworkCollectionFn";
import type { ArtworkCollectionInput } from "../ArtworkCollectionInputSchema";

/** Filters, pages, and formats one artwork_collection response. */
export const readArtworkCollectionTextFn = (project: Project, input: ArtworkCollectionInput) => {
	const artwork = project.resources.filter(({ type }) => type === "artwork");
	const matches = readArtworkCollectionFn({
		config: project.config,
		filter: input.filter,
		query: input.query ?? "",
		resources: artwork,
	});
	const totalPages = Math.ceil(matches.length / input.limit);
	const pageArtwork = matches.slice((input.page - 1) * input.limit, input.page * input.limit);
	const hasPreviousPage = input.page > 1;
	const hasNextPage = input.page * input.limit < matches.length;
	const renderedArtwork = pageArtwork
		.map((artwork) => `- Type: artwork\n  UID: ${artwork.uid}\n  Title: ${artwork.title}`)
		.join("\n\n");
	return [
		"Artwork collection",
		`Project artwork: ${artwork.length}`,
		`Usage filter: ${input.filter}`,
		`Matched artwork: ${matches.length}`,
		`Page: ${input.page}`,
		`Total pages: ${totalPages}`,
		`Limit: ${input.limit}`,
		`Returned artwork: ${pageArtwork.length}`,
		`Has previous page: ${hasPreviousPage}`,
		`Has next page: ${hasNextPage}`,
		...(hasPreviousPage
			? [
					`Previous page: ${input.page - 1}`,
				]
			: []),
		...(hasNextPage
			? [
					`Next page: ${input.page + 1}`,
				]
			: []),
		"",
		"Artwork:",
		renderedArtwork || "- none",
	].join("\n");
};
