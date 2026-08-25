import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	cleanupEditorMcpHarnesses,
	connectEditorMcpClient,
	createEditorMcpHarness,
} from "./support/createEditorMcpHarness";

afterEach(cleanupEditorMcpHarnesses);

describe("editor MCP project configuration", () => {
	it("reads JSON config and replaces only supplied complete sections", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createEditorMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "project-config",
				version: "1.0",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("project-config");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectEditorMcpClient(port);

		const read = await client.callTool({
			name: "project_config",
			arguments: {},
		});
		const content = read.content[0];
		if (content?.type !== "text") throw new Error("Missing project_config text.");
		const config = JSON.parse(content.text) as {
			revision: number;
			config: typeof editorTestPayload.config;
		};
		expect(config).toMatchObject({
			projectId: "project-config",
			revision: 0,
			version: "1.0",
			config: {
				meta: editorTestPayload.config.meta,
				resources: editorTestPayload.config.resources,
				start: editorTestPayload.config.start,
			},
		});
		expect(config.config).not.toHaveProperty("items");

		const edited = await client.callTool({
			name: "edit_project",
			arguments: {
				revision: config.revision,
				patch: {
					meta: {
						title: "Renamed game",
						board: {
							width: 3,
							height: 2,
						},
						inventory: {
							width: 1,
							height: 1,
						},
						toolbarSize: 2,
					},
				},
			},
		});
		expect(edited.content).toMatchObject([
			{
				text: expect.stringContaining("Replaced: meta"),
			},
		]);
		const project = await Effect.runPromise(repository.readProjectFx("project-config"));
		expect(project?.config.meta).toEqual({
			...editorTestPayload.config.meta,
			title: "Renamed game",
			board: {
				width: 3,
				height: 2,
			},
			toolbarSize: 2,
		});
		expect(project?.config.start).toEqual(editorTestPayload.config.start);
		expect(project?.config.items).toEqual(editorTestPayload.config.items);
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("project-config");

		const stale = await client.callTool({
			name: "edit_project",
			arguments: {
				revision: 0,
				patch: {
					resources: editorTestPayload.config.resources,
				},
			},
		});
		expect(stale.isError).toBe(true);
		expect(notifyProjectChanged).toHaveBeenCalledOnce();

		const misspelled = await client.callTool({
			name: "edit_project",
			arguments: {
				patch: {
					resources: editorTestPayload.config.resources,
					starts: editorTestPayload.config.start,
				},
			},
		});
		expect(misspelled.isError).toBe(true);
		expect(notifyProjectChanged).toHaveBeenCalledOnce();
		expect(
			(await Effect.runPromise(repository.readProjectFx("project-config")))?.revision,
		).toBe(1);
	});
});
