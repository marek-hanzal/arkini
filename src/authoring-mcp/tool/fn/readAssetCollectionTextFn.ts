import type { Project } from "~/project-authoring/type/Project";
import { searchEditorAssetsFn } from "~/asset-authoring/fn/searchEditorAssetsFn";
import type { AssetCollectionInput } from "../AssetCollectionInputSchema";

/** Filters, pages, and formats one asset_collection response. */
export const readAssetCollectionTextFn = (project: Project, input: AssetCollectionInput) => {
	const assets = project.resources;
	const matches = input.query === undefined ? assets : searchEditorAssetsFn(assets, input.query);
	const totalPages = Math.ceil(matches.length / input.pageSize);
	const pageAssets = matches.slice(
		(input.page - 1) * input.pageSize,
		input.page * input.pageSize,
	);
	const hasPreviousPage = input.page > 1;
	const hasNextPage = input.page * input.pageSize < matches.length;
	const renderedAssets = pageAssets
		.map((asset) => `- Type: ${input.type}\n  ID: ${asset.id}`)
		.join("\n\n");
	return [
		"Asset collection",
		`Project assets: ${assets.length}`,
		`Asset type filter: ${input.type}`,
		`Matched assets: ${matches.length}`,
		`Page: ${input.page}`,
		`Total pages: ${totalPages}`,
		`Page size: ${input.pageSize}`,
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
