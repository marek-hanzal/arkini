import { selectItemCollectionFn } from "~/item-authoring/fn/selectItemCollectionFn";
import { describe, expect, it } from "vitest";

import { readItemCollectionTextFn } from "~/authoring-mcp/tool/fn/readItemCollectionTextFn";
import { createGraphProject } from "./support/createToolProject";

describe("readItemCollectionTextFn", () => {
	it("finds keyword-only aliases with the same fuzzy query in Editor and MCP", () => {
		const project = createGraphProject();
		project.config.items.forge.keywords = "currency\ncoins money";
		const query = "currncy";
		const items = selectItemCollectionFn({
			items: Object.values(project.config.items),
			notedItemUids: new Set(),
			query,
			view: "name",
		});
		expect(items.map((item) => item.uid)).toEqual([
			"forge",
		]);
		const result = readItemCollectionTextFn(project, {
			page: 1,
			limit: 25,
			query,
		});
		expect(result).toContain("Matched items: 1");
		expect(result).toContain("- forge\n  UID: forge");
	});

	it("preserves the MCP item query and page boundary", () => {
		const project = createGraphProject();
		const producers = readItemCollectionTextFn(project, {
			page: 1,
			limit: 25,
			query: "frge",
		});
		const lastPage = readItemCollectionTextFn(project, {
			page: 3,
			limit: 2,
		});

		expect(producers).toContain("- forge\n  UID: forge");
		expect(lastPage).toContain("Page: 3\nTotal pages: 3");
		expect(lastPage).toContain("Previous page: 2");
	});
});
