import { describe, expect, it } from "vitest";

import { readItemCollectionTextFn } from "~/authoring-mcp/tool/fn/readItemCollectionTextFn";
import { createGraphProject } from "./support/createToolProject";

describe("readItemCollectionTextFn", () => {
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

		expect(producers).toContain("- forge\n  ID: forge");
		expect(producers).toContain("Draft: false");
		expect(lastPage).toContain("Page: 3\nTotal pages: 3");
		expect(lastPage).toContain("Previous page: 2");
	});
});
