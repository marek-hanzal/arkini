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
	it("persists a created item with a generated immutable UID and publishes its revision", async () => {
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
			description: "Created through the editor MCP.",
			title: "MCP Simple",
		});
		expect(item?.uid).toEqual(expect.any(String));
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("create-item-project");
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
						title: "Travel",
						description: "Travel",
						runtimeMs: 0,
						default: true,
						input: [],
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

it("generates fresh project-wide line UIDs when the same authoring lines create two items", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	const project = await Effect.runPromise(
		repository.createProjectFx({
			...editorTestPayload,
			version: {
				major: 1,
				minor: 0,
			},
		}),
	);
	ownership.setProjectContextFn(project.projectId);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const input = {
		title: "Copied producer",
		lines: [
			{
				title: "Same line title",
				description: "Copied authoring value",
				runtimeMs: 0,
				input: [],
				rules: [],
			},
		],
	};
	const itemUids: string[] = [];
	for (let index = 0; index < 2; index++) {
		const response = await client.callTool({
			name: "create_item",
			arguments: jsonToolInputFn(input),
		});
		expect(response.isError).not.toBe(true);
		const content = response.content[0];
		if (content?.type !== "text") throw new Error("Missing create response.");
		itemUids.push(content.text.match(/^UID: (.+)$/m)![1]!);
	}
	const saved = await Effect.runPromise(repository.readProjectFx(project.projectId));
	const createdLines = itemUids.map((uid) => saved!.config.items[uid]!.lines[0]!);
	expect(createdLines.map((line) => line.title)).toEqual([
		"Same line title",
		"Same line title",
	]);
	expect(new Set(createdLines.map((line) => line.uid)).size).toBe(2);
	for (const line of createdLines) expect(line.uid).toMatch(/^[a-z][a-z0-9]{23}$/);
});
