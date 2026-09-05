import { describe, expect, it } from "vitest";

import { readAssetCollectionTextFn } from "~/authoring-mcp/tool/fn/readAssetCollectionTextFn";
import { createGraphProject } from "./support/createToolProject";

describe("readAssetCollectionTextFn", () => {
	it("shares the Editor Asset fuzzy query and preserves the collection page boundary", () => {
		const baseProject = createGraphProject();
		const project = {
			...baseProject,
			config: {
				...baseProject.config,
				resources: {
					...baseProject.config.resources,
					hero: "hero",
				},
			},
			resources: [
				{
					bytes: new Uint8Array(),
					id: "hero",
					mime: "image/png" as const,
				},
				{
					bytes: new Uint8Array(),
					id: "forge-image",
					mime: "image/png" as const,
				},
			],
		};
		const fuzzyMatch = readAssetCollectionTextFn(project, {
			filter: "all",
			page: 1,
			limit: 25,
			query: "frge",
			type: "image",
		});
		const lastPage = readAssetCollectionTextFn(project, {
			filter: "all",
			page: 2,
			limit: 1,
			type: "image",
		});
		const unused = readAssetCollectionTextFn(project, {
			filter: "unused",
			page: 1,
			limit: 25,
			type: "image",
		});

		expect(fuzzyMatch).toContain("Matched assets: 1");
		expect(fuzzyMatch).toContain("- Type: image\n  ID: forge-image");
		expect(lastPage).toContain("Page: 2\nTotal pages: 2");
		expect(lastPage).toContain("Previous page: 1");
		expect(lastPage).toContain("- Type: image\n  ID: forge-image");
		expect(lastPage).not.toContain("bytes");
		expect(lastPage).not.toContain("image/png");
		expect(unused).toContain("Usage filter: unused");
		expect(unused).toContain("- Type: image\n  ID: forge-image");
		expect(unused).not.toContain("- Type: image\n  ID: hero");
	});
});
