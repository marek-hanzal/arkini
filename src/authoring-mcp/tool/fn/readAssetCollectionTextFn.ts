import type { Project } from "~/project-authoring/type/Project";
import { readAssetCollectionFn } from "~/asset-authoring/fn/readAssetCollectionFn";
import type { AssetCollectionInput } from "../AssetCollectionInputSchema";

/** Filters, pages, and formats one asset_collection response. */
export const readAssetCollectionTextFn = (project: Project, input: AssetCollectionInput) => {
	const assets = project.resources;
	const matches = readAssetCollectionFn({
		config: project.config,
		filter: input.filter,
		query: input.query ?? "",
		resources: assets,
	});
	const totalPages = Math.ceil(matches.length / input.limit);
	const pageAssets = matches.slice((input.page - 1) * input.limit, input.page * input.limit);
	const hasPreviousPage = input.page > 1;
	const hasNextPage = input.page * input.limit < matches.length;
	const renderedAssets = pageAssets
		.map((asset) => `- Type: ${input.type}\n  ID: ${asset.id}`)
		.join("\n\n");
	return [
		"Asset collection",
		`Project assets: ${assets.length}`,
		`Usage filter: ${input.filter}`,
		`Asset type filter: ${input.type}`,
		`Matched assets: ${matches.length}`,
		`Page: ${input.page}`,
		`Total pages: ${totalPages}`,
		`Limit: ${input.limit}`,
		`Returned assets: ${pageAssets.length}`,
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
		"Assets:",
		renderedAssets || "- none",
	].join("\n");
};
