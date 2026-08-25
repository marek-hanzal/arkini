import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	cleanupEditorMcpHarnesses,
	connectEditorMcpClient,
	createEditorMcpHarness,
} from "./support/createEditorMcpHarness";

afterEach(cleanupEditorMcpHarnesses);

describe("editor MCP item creation", () => {
	it("creates a simple item from the Editor draft defaults and rejects an ID collision", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createEditorMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "create-item-project",
				version: "1.0",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("create-item-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectEditorMcpClient(port);

		const created = await client.callTool({
			name: "create_simple_item",
			arguments: {
				id: "item:mcp-simple",
				title: "MCP Simple",
				description: "Created through the editor MCP.",
			},
		});
		expect(created).toMatchObject({
			content: [
				{
					text: expect.stringMatching(
						/^Created simple item\.\nID: item:mcp-simple\nUID: .+\nRevision: 1$/,
					),
				},
			],
		});
		const project = await Effect.runPromise(repository.readProjectFx("create-item-project"));
		const item = project?.config.items["item:mcp-simple"];
		expect(item).toMatchObject({
			asset: {
				default: [
					editorTestPayload.resources[0]?.id,
				],
			},
			description: "Created through the editor MCP.",
			id: "item:mcp-simple",
			maxStackSize: 1,
			scope: "any",
			title: "MCP Simple",
			type: "simple",
		});
		expect(item?.uid).toEqual(expect.any(String));
		expect(item?.uid).not.toBe(item?.id);
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("create-item-project");

		const collision = await client.callTool({
			name: "create_simple_item",
			arguments: {
				id: "item:mcp-simple",
				title: "Duplicate",
				description: "Must not replace the existing item.",
			},
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
	});

	it("creates every canonical item type through its dedicated tool", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createEditorMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "all-item-types-project",
				version: "1.0",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("all-item-types-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectEditorMcpClient(port);
		const types = [
			"simple",
			"producer",
			"craft",
			"blueprint",
			"deposit",
			"stash",
			"temporary",
			"inventory",
		] as const;

		for (const type of types) {
			const id = `${type === "producer" ? "producer" : "item"}:mcp-${type}`;
			const result = await client.callTool({
				name: `create_${type}_item`,
				arguments: {
					id,
					title: `MCP ${type}`,
					description: `Created ${type} item.`,
				},
			});
			expect(result.isError, type).not.toBe(true);
			expect(result.content, type).toMatchObject([
				{
					text: expect.stringContaining(`Created ${type} item.`),
				},
			]);
		}

		const project = await Effect.runPromise(repository.readProjectFx("all-item-types-project"));
		const read = (type: (typeof types)[number]) =>
			project?.config.items[`${type === "producer" ? "producer" : "item"}:mcp-${type}`];
		for (const type of types) {
			expect(read(type), type).toMatchObject({
				asset: {
					default: [
						editorTestPayload.resources[0]?.id,
					],
				},
				type,
			});
		}
		expect(read("producer")).toMatchObject({
			maxQueueSize: 1,
			lines: [
				expect.any(Object),
			],
		});
		expect(read("craft")).toHaveProperty("line");
		expect(read("blueprint")).toHaveProperty("line");
		expect(read("deposit")).toMatchObject({
			maxQueueSize: 1,
		});
		expect(read("stash")).toHaveProperty("line");
		expect(read("temporary")).toMatchObject({
			durationMs: 500,
			maxStackSize: 1,
			scope: "board",
		});
		expect(read("inventory")).toMatchObject({
			maxCount: 1,
			maxStackSize: 1,
			scope: "board",
		});
		expect(notifyProjectChanged).toHaveBeenCalledTimes(types.length);

		const discriminatorOverride = await client.callTool({
			name: "create_simple_item",
			arguments: {
				id: "item:invalid-override",
				title: "Invalid override",
				description: "Must remain a simple item.",
				type: "producer",
				uid: "forced-uid",
			},
		});
		expect(discriminatorOverride.isError).toBe(true);
		expect(
			(await Effect.runPromise(repository.readProjectFx("all-item-types-project")))?.config
				.items["item:invalid-override"],
		).toBeUndefined();
	});

	it("acknowledges a committed item when renderer notification fails", async () => {
		const notificationError = new Error("renderer disappeared");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { ownership, port, repository } = await createEditorMcpHarness(
			Effect.runPromise,
			() => {
				throw notificationError;
			},
		);
		await Effect.runPromise(
			repository.createProjectFx({
				projectId: "notification-project",
				version: "1.0",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContext("notification-project");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectEditorMcpClient(port);

		const created = await client.callTool({
			name: "create_simple_item",
			arguments: {
				id: "item:committed",
				title: "Committed",
				description: "Persists before renderer notification.",
			},
		});
		expect(created.isError).not.toBe(true);
		expect(created.content).toMatchObject([
			{
				text: expect.stringContaining("Created simple item."),
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
