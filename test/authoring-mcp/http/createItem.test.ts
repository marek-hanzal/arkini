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
	it("creates a passive item from the Editor draft defaults with a generated immutable UID", async () => {
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
						new RegExp(`^Created item\\.\\nUID: .+\\nRevision: ${project.revision}$`),
					),
				},
			],
		});
		const item = Object.values(project.config.items).find(
			(item) => item.title === "MCP Simple",
		);
		if (item === undefined) throw new Error("Missing created item");
		expect(item).toMatchObject({
			artwork: {
				scale: 1,
				default: [
					editorTestPayload.resources.find(({ type }) => type === "artwork")?.id,
				],
			},
			description: "Created through the editor MCP.",
			draft: false,
			title: "MCP Simple",

			lines: [],
			maxQueueSize: 1,
		});
		expect(item?.uid).toEqual(expect.any(String));
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("create-item-project");
		const detail = await client.callTool({
			name: "item_detail",
			arguments: {
				itemUid: item.uid,
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
				text: expect.stringContaining(item.uid),
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
	});

	it("creates a Space outcome line through the generic tool and permits Clock", async () => {
		const { ownership, port, repository } = await createMcpHarness();
		const projectId = "space-action-project";
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
				title: "Bag",
				lines: [
					{
						id: "travel",
						title: "Travel",
						description: "Travel",
						runtimeMs: 0,
						default: true,
						input: [
							{
								type: "simple",
							},
						],
						rules: [],
						outcome: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													type: "space",
													space: 0,
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					},
				],
			}),
		});
		expect(created.isError, JSON.stringify(created.content)).not.toBe(true);
		const project = await Effect.runPromise(repository.readProjectFx(projectId));
		expect(
			Object.values(project!.config.items).find((item) => item.title === "Bag")!.lines[0]
				?.outcome?.set[0]?.roll[0]?.outcome,
		).toEqual([
			{
				type: "space",
				space: 0,
				rules: [],
			},
		]);
		const rejected = await client.callTool({
			name: "edit_item",
			arguments: jsonToolInputFn({
				itemUid: Object.values(project!.config.items).find((item) => item.title === "Bag")!
					.uid,
				patch: {
					clock: {
						durationMs: 1000,
					},
				},
			}),
		});
		expect(rejected.isError).not.toBe(true);
		expect(
			(await Effect.runPromise(repository.readProjectFx(projectId)))?.revision,
		).toBeGreaterThan(project?.revision ?? 0);
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
				title: "Committed",
				description: "Persists before renderer notification.",
			}),
		});
		expect(created.isError, JSON.stringify(created.content)).not.toBe(true);
		expect(created.content).toMatchObject([
			{
				text: expect.stringContaining("Created item."),
			},
		]);
		expect(
			Object.values(
				(await Effect.runPromise(repository.readProjectFx("notification-project")))!.config
					.items,
			).find((item) => item.title === "Committed"),
		).toBeDefined();
		expect(consoleError).toHaveBeenCalledWith(
			"Serakki editor could not announce an MCP project mutation.",
			expect.anything(),
		);
	});
});
