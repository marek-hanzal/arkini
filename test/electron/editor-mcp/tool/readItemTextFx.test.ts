import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemCollectionTextFn } from "../../../../electron/main/editor-mcp/tool/fn/readItemCollectionTextFn";
import { readItemMetaTextFn } from "../../../../electron/main/editor-mcp/tool/fn/readItemMetaTextFn";
import { readProjectTextFn } from "../../../../electron/main/editor-mcp/tool/fn/readProjectTextFn";
import { readItemConfigTextFx } from "../../../../electron/main/editor-mcp/tool/readItemConfigTextFx";
import { readItemDetailTextFx } from "../../../../electron/main/editor-mcp/tool/readItemDetailTextFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createGraphProject, createToolProject } from "./support/createToolProject";

describe("editor MCP item tool text", () => {
	it("formats project, metadata, collection, and item detail independently", () => {
		const project = {
			...createToolProject(editorTestPayload.config),
			projectId: "project-context",
			resources: editorTestPayload.resources,
		};
		const projectText = readProjectTextFn(project);
		const metaText = readItemMetaTextFn(project);
		const collectionText = readItemCollectionTextFn(project, {
			page: 1,
			pageSize: 25,
		});
		const fuzzyText = readItemCollectionTextFn(project, {
			page: 1,
			pageSize: 25,
			query: "watr",
		});
		const detailText = Effect.runSync(readItemDetailTextFx(project, "water"));
		const configText = Effect.runSync(readItemConfigTextFx(project, "water"));

		expect(projectText).toContain("Project ID: project-context");
		expect(projectText).toContain("Resources: 2");
		expect(metaText).toBe("Total: 1\nsimple: 1");
		expect(fuzzyText).toBe(collectionText);
		expect(collectionText).toContain("- Water\n  ID: water\n  Type: simple");
		expect(detailText).toContain("ID: water\nUID: water\nType: simple");
		expect(JSON.parse(configText)).toEqual({
			revision: project.revision,
			item: project.config.items.water,
		});
		expect(() => Effect.runSync(readItemDetailTextFx(project, "missing"))).toThrow(
			"Item missing does not exist",
		);
		expect(() => Effect.runSync(readItemConfigTextFx(project, "missing"))).toThrow(
			"Item missing does not exist",
		);
	});

	it("filters and pages item collections without changing the tool text contract", () => {
		const project = createGraphProject();
		const producers = readItemCollectionTextFn(project, {
			itemTypes: [
				"producer",
			],
			page: 1,
			pageSize: 25,
		});
		const lastPage = readItemCollectionTextFn(project, {
			page: 3,
			pageSize: 2,
		});

		expect(producers).toContain("Item type filter (OR): producer");
		expect(producers).toContain("Type-filtered items: 1");
		expect(lastPage).toContain("Page: 3\nTotal pages: 3");
		expect(lastPage).toContain("Previous page: 2");
	});
});
