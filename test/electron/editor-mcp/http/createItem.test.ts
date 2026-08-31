import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

const typeGroups = [
	{
		name: "creates simple, space, and producer item types through dedicated tools",
		projectId: "simple-space-producer-types-project",
		types: [
			"simple",
			"space",
			"producer",
		],
	},
	{
		name: "creates craft and blueprint item types through dedicated tools",
		projectId: "craft-blueprint-types-project",
		types: [
			"craft",
			"blueprint",
		],
	},
	{
		name: "creates deposit and stash item types through dedicated tools",
		projectId: "deposit-stash-types-project",
		types: [
			"deposit",
			"stash",
		],
	},
	{
		name: "creates temporary and inventory item types through dedicated tools",
		projectId: "temporary-inventory-types-project",
		types: [
			"temporary",
			"inventory",
		],
	},
] as const;

describe("editor MCP item creation", () => {
	it("creates a simple item from the Editor draft defaults and rejects an ID collision", async () => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
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
			name: "create_simple_item",
			arguments: {
				id: "item:mcp-simple",
				title: "MCP Simple",
				description: "Created through the editor MCP.",
			},
		});
		const project = await Effect.runPromise(repository.readProjectFx("create-item-project"));
		if (project === null) throw new Error("Expected the project with the created item.");
		expect(created).toMatchObject({
			content: [
				{
					text: expect.stringMatching(
						new RegExp(
							`^Created simple item\\.\\nID: item:mcp-simple\\nUID: .+\\nRevision: ${project.revision}$`,
						),
					),
				},
			],
		});
		const item = project.config.items["item:mcp-simple"];
		expect(item).toMatchObject({
			asset: {
				default: [
					editorTestPayload.resources[0]?.id,
				],
			},
			description: "Created through the editor MCP.",
			id: "item:mcp-simple",
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

	it.each(typeGroups)("$name", async ({ projectId, types }) => {
		const notifyProjectChanged = vi.fn();
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: projectId,
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn(projectId);
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		for (const type of types) {
			const id = `${type === "producer" ? "producer" : "item"}:mcp-${type}`;
			const result = await client.callTool({
				name: `create_${type}_item`,
				arguments: {
					id,
					title: `MCP ${type}`,
					description: `Created ${type} item.`,
					...(type === "space"
						? {
								space: 4,
							}
						: {}),
				},
			});
			expect(result.isError, type).not.toBe(true);
			expect(result.content, type).toMatchObject([
				{
					text: expect.stringContaining(`Created ${type} item.`),
				},
			]);
		}

		const project = await Effect.runPromise(repository.readProjectFx(projectId));
		const read = (type: (typeof types)[number]) =>
			project?.config.items[`${type === "producer" ? "producer" : "item"}:mcp-${type}`];
		const has = (type: string) => types.some((candidate) => candidate === type);
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
		expect(notifyProjectChanged).toHaveBeenCalledTimes(types.length);

		if (has("simple")) {
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
				(await Effect.runPromise(repository.readProjectFx(projectId)))?.config.items[
					"item:invalid-override"
				],
			).toBeUndefined();
		}
	});

	it("acknowledges a committed item when renderer notification fails", async () => {
		const notificationError = new Error("renderer disappeared");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { ownership, port, repository } = await createMcpHarness(Effect.runPromise, () => {
			throw notificationError;
		});
		await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
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
