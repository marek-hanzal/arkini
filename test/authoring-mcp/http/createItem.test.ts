import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
	jsonToolInputFn,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("editor MCP item creation", () => {
	it("creates a passive item from the Editor draft defaults and rejects an ID collision", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "create-item-project",
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn("create-item-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		const created = await client.callTool({
			name: "create_item",
			arguments: jsonToolInputFn({
				id: "item:mcp-simple",
				title: "MCP Simple",
				description: "Created through the editor MCP.",
			}),
		});
		const project = await Effect.runPromise(repository.readProjectFx("create-item-project"));
		if (project === null) throw new Error("Expected the project with the created item.");
		expect(created).toMatchObject({
			content: [
				{
					text: expect.stringMatching(
						new RegExp(
							`^Created item\\.\\nID: item:mcp-simple\\nUID: .+\\nRevision: ${project.revision}$`,
						),
					),
				},
			],
		});
		const item = project.config.items["item:mcp-simple"];
		expect(item).toMatchObject({
			asset: {
				scale: 1,
				default: [
					editorTestPayload.resources[0]?.id,
				],
			},
			description: "Created through the editor MCP.",
			draft: false,
			id: "item:mcp-simple",
			title: "MCP Simple",

			lines: [],
			maxQueueSize: 1,
		});
		expect(item?.uid).toEqual(expect.any(String));
		expect(item?.uid).not.toBe(item?.id);
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("create-item-project");
		const detail = await client.callTool({
			name: "item_detail",
			arguments: {
				id: "item:mcp-simple",
			},
		});
		expect(detail.content).toMatchObject([
			{
				text: expect.stringContaining("Draft: false"),
			},
		]);
		const collection = await client.callTool({
			name: "item_collection",
			arguments: {},
		});
		expect(collection.content).toMatchObject([
			{
				text: expect.stringMatching(/ID: item:mcp-simple\n  Draft: false/),
			},
		]);

		const rejectedStructuredInput = await client.callTool({
			name: "create_item",
			arguments: {
				id: "item:legacy-structured-input",
				title: "Legacy structured input",
				description: "Must not bypass the serialized schema boundary.",
			},
		});
		expect(rejectedStructuredInput.isError).toBe(true);
		const rejectedInvalidJson = await client.callTool({
			name: "create_item",
			arguments: {
				input: "{",
			},
		});
		expect(rejectedInvalidJson.isError).toBe(true);

		const collision = await client.callTool({
			name: "create_item",
			arguments: jsonToolInputFn({
				id: "item:mcp-simple",
				title: "Duplicate",
				description: "Must not replace the existing item.",
			}),
		});
		expect(collision).toMatchObject({
			isError: true,
			content: [
				{
					text: expect.stringContaining(
						"Item ID item:mcp-simple is already used by another item.",
					),
				},
			],
		});
		expect(notifyProjectChanged).toHaveBeenCalledOnce();
		expect(
			(await Effect.runPromise(repository.readProjectFx("create-item-project")))?.config
				.items["item:legacy-structured-input"],
		).toBeUndefined();
	});

	it("creates an inventory action through the generic tool and rejects an incompatible clock", async () => {
		const { ownership, port, repository } = await createMcpHarness();
		const projectId = "inventory-action-project";
		await Effect.runPromise(
			repository.createProjectFx({
				...editorTestPayload,
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: projectId,
					},
				},
			}),
		);
		ownership.setProjectContextFn(projectId);
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const created = await client.callTool({
			name: "create_item",
			arguments: jsonToolInputFn({
				id: "bag",
				title: "Bag",
				action: {
					type: "inventory",
				},
			}),
		});
		expect(created.isError).not.toBe(true);
		const project = await Effect.runPromise(repository.readProjectFx(projectId));
		expect(project?.config.items.bag).toMatchObject({
			scope: "any",
			lines: [],
			action: {
				type: "inventory",
				input: [],
				rules: [],
			},
		});
		const rejected = await client.callTool({
			name: "edit_item",
			arguments: jsonToolInputFn({
				itemId: "bag",
				patch: {
					clock: {
						durationMs: 1000,
					},
					scope: "board",
				},
			}),
		});
		expect(rejected.isError).toBe(true);
		expect((await Effect.runPromise(repository.readProjectFx(projectId)))?.revision).toBe(
			project?.revision,
		);
	});

	it("acknowledges a committed item when renderer notification fails", async () => {
		const notificationError = new Error("renderer disappeared");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { ownership, port, repository } = await createMcpHarness(Effect.runPromise, () => {
			throw notificationError;
		});
		await Effect.runPromise(
			repository.createProjectFx({
				version: {
					major: 1,
					minor: 0,
				},
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "notification-project",
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn("notification-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		const created = await client.callTool({
			name: "create_item",
			arguments: jsonToolInputFn({
				id: "item:committed",
				title: "Committed",
				description: "Persists before renderer notification.",
			}),
		});
		expect(created.isError).not.toBe(true);
		expect(created.content).toMatchObject([
			{
				text: expect.stringContaining("Created item."),
			},
		]);
		expect(
			(await Effect.runPromise(repository.readProjectFx("notification-project")))?.config
				.items["item:committed"],
		).toBeDefined();
		expect(consoleError).toHaveBeenCalledWith(
			"Arkini editor could not announce an MCP project mutation.",
			expect.anything(),
		);
	});
});
