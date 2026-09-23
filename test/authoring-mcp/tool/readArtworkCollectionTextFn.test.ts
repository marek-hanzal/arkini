import { describe, expect, it } from "vitest";

import { readArtworkCollectionTextFn } from "~/authoring-mcp/tool/fn/readArtworkCollectionTextFn";
import { createGraphProject } from "./support/createToolProject";

describe("readArtworkCollectionTextFn", () => {
	it("shares the Editor Artwork fuzzy query and preserves the collection page boundary", () => {
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
					size: 0,
					version: "1",
					uid: "hero",
					title: "hero",
					type: "image" as const,
				},
				{
					size: 0,
					version: "1",
					uid: "forge-image",
					title: "forge-image",
					type: "artwork" as const,
				},
				{
					size: 0,
					version: "1",
					uid: "water-image",
					title: "water-image",
					type: "artwork" as const,
				},
			],
		};
		const fuzzyMatch = readArtworkCollectionTextFn(project, {
			filter: "all",
			page: 1,
			limit: 25,
			query: "frge",
		});
		const lastPage = readArtworkCollectionTextFn(project, {
			filter: "all",
			page: 2,
			limit: 1,
		});
		const unused = readArtworkCollectionTextFn(project, {
			filter: "unused",
			page: 1,
			limit: 25,
		});

		expect(fuzzyMatch).toContain("Matched artwork: 1");
		expect(fuzzyMatch).toContain("- Type: artwork\n  UID: forge-image");
		expect(lastPage).toContain("Page: 2\nTotal pages: 2");
		expect(lastPage).toContain("Previous page: 1");
		expect(lastPage).toContain("- Type: artwork\n  UID: water-image");
		expect(lastPage).not.toContain("bytes");
		expect(lastPage).not.toContain("image/png");
		expect(unused).toContain("Usage filter: unused");
		expect(unused).toContain("- Type: artwork\n  UID: forge-image");
		expect(unused).not.toContain("UID: hero");
	});
});
