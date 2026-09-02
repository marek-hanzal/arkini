import { describe, expect, it } from "vitest";

import { readItemCollectionTextFn } from "~/authoring-mcp/tool/fn/readItemCollectionTextFn";
import { createGraphProject } from "./support/createToolProject";

describe("readItemCollectionTextFn", () => {
	it("preserves the MCP item query, type filter, and page boundary", () => {
		const project = createGraphProject();
		const producers = readItemCollectionTextFn(project, {
			itemTypes: [
				"producer",
			],
			page: 1,
			pageSize: 25,
			query: "frge",
		});
		const lastPage = readItemCollectionTextFn(project, {
			page: 3,
			pageSize: 2,
		});

		expect(producers).toContain("Item type filter (OR): producer");
		expect(producers).toContain("Type-filtered items: 1");
		expect(producers).toContain("- forge\n  ID: forge\n  Type: producer");
		expect(lastPage).toContain("Page: 3\nTotal pages: 3");
		expect(lastPage).toContain("Previous page: 2");
	});
});
