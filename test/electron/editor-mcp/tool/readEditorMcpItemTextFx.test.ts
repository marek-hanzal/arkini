import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEditorMcpItemCollectionTextFx } from "../../../../electron/main/editor-mcp/tool/readEditorMcpItemCollectionTextFx";
import { readEditorMcpItemConfigTextFx } from "../../../../electron/main/editor-mcp/tool/readEditorMcpItemConfigTextFx";
import { readEditorMcpItemDetailTextFx } from "../../../../electron/main/editor-mcp/tool/readEditorMcpItemDetailTextFx";
import { readEditorMcpItemMetaTextFx } from "../../../../electron/main/editor-mcp/tool/readEditorMcpItemMetaTextFx";
import { readEditorMcpProjectTextFx } from "../../../../electron/main/editor-mcp/tool/readEditorMcpProjectTextFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	createEditorMcpGraphProject,
	createEditorMcpToolProject,
} from "./support/createEditorMcpToolProject";

describe("editor MCP item tool text", () => {
	it("formats project, metadata, collection, and item detail independently", () => {
		const project = {
			...createEditorMcpToolProject(editorTestPayload.config),
			projectId: "project-context",
			resources: editorTestPayload.resources,
		};
		const projectText = Effect.runSync(readEditorMcpProjectTextFx(project));
		const metaText = Effect.runSync(readEditorMcpItemMetaTextFx(project));
		const collectionText = Effect.runSync(
			readEditorMcpItemCollectionTextFx(project, {
				page: 1,
				pageSize: 25,
			}),
		);
		const fuzzyText = Effect.runSync(
			readEditorMcpItemCollectionTextFx(project, {
				page: 1,
				pageSize: 25,
				query: "watr",
			}),
		);
		const detailText = Effect.runSync(readEditorMcpItemDetailTextFx(project, "water"));
		const configText = Effect.runSync(readEditorMcpItemConfigTextFx(project, "water"));

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
		expect(() => Effect.runSync(readEditorMcpItemDetailTextFx(project, "missing"))).toThrow(
			"Item missing does not exist",
		);
		expect(() => Effect.runSync(readEditorMcpItemConfigTextFx(project, "missing"))).toThrow(
			"Item missing does not exist",
		);
	});

	it("filters and pages item collections without changing the tool text contract", () => {
		const project = createEditorMcpGraphProject();
		const producers = Effect.runSync(
			readEditorMcpItemCollectionTextFx(project, {
				itemTypes: [
					"producer",
				],
				page: 1,
				pageSize: 25,
			}),
		);
		const lastPage = Effect.runSync(
			readEditorMcpItemCollectionTextFx(project, {
				page: 3,
				pageSize: 2,
			}),
		);

		expect(producers).toContain("Item type filter (OR): producer");
		expect(producers).toContain("Type-filtered items: 1");
		expect(lastPage).toContain("Page: 3\nTotal pages: 3");
		expect(lastPage).toContain("Previous page: 2");
	});
});
