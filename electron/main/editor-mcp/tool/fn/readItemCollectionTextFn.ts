import { Order } from "effect";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { searchFn } from "~/item-authoring/fn/searchFn";
import type { ItemCollectionInput } from "../ItemCollectionInputSchema";

const indentText = (value: string) =>
	value
		.split("\n")
		.map((line) => `    ${line}`)
		.join("\n");

/** Filters, pages, and formats one item_collection response. */
export const readItemCollectionTextFn = (project: EditorProject, input: ItemCollectionInput) => {
	const items = Object.values(project.config.items).sort((left, right) =>
		Order.String(left.title, right.title),
	);
	const allowedTypes = input.itemTypes === undefined ? undefined : new Set(input.itemTypes);
	const typeFilteredItems =
		allowedTypes === undefined ? items : items.filter((item) => allowedTypes.has(item.type));
	const matches =
		input.query === undefined ? typeFilteredItems : searchFn(typeFilteredItems, input.query);
	const totalPages = Math.ceil(matches.length / input.pageSize);
	const pageItems = matches.slice((input.page - 1) * input.pageSize, input.page * input.pageSize);
	const hasPreviousPage = input.page > 1;
	const hasNextPage = input.page * input.pageSize < matches.length;
	const renderedItems = pageItems
		.map((item) =>
			[
				`- ${item.title}`,
				`  ID: ${item.id}`,
				`  Type: ${item.type}`,
				"  Description:",
				indentText(item.description),
			].join("\n"),
		)
		.join("\n\n");
	return [
		"Item collection",
		`Project items: ${items.length}`,
		...(input.itemTypes === undefined
			? []
			: [
					`Item type filter (OR): ${input.itemTypes.join(", ")}`,
				]),
		`Type-filtered items: ${typeFilteredItems.length}`,
		`Matched items: ${matches.length}`,
		`Page: ${input.page}`,
		`Total pages: ${totalPages}`,
		`Page size: ${input.pageSize}`,
		`Returned items: ${pageItems.length}`,
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
		"Items:",
		renderedItems || "- none",
	].join("\n");
};
