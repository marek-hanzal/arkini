import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("editor MCP project layout and start items", () => {
	it("patches layout values without losing metadata or silently removing blocked start items", async () => {
		const notifyProjectChanged = vi.fn();
		const start = {
			...editorTestPayload.config.start,
			board: [
				{
					itemId: "water",
					space: 0,
					x: 1,
					y: 0,
				},
			],
		};
		const { ownership, port, repository } = await createMcpHarness(
			Effect.runPromise,
			notifyProjectChanged,
		);
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: "1.0",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "project-layout",
					},
					start,
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn("project-layout");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);

		const edited = await client.callTool({
			name: "edit_project_layout",
			arguments: {
				revision: created.revision,
				board: {
					width: 3,
					height: 2,
				},
				inventory: {
					width: 2,
					height: 1,
				},
				toolbarSize: 2,
			},
		});
		expect(edited.isError).not.toBe(true);
		expect(edited.content).toMatchObject([
			{
				text: expect.stringContaining("Board: 3 x 2"),
			},
		]);
		const project = await Effect.runPromise(repository.readProjectFx("project-layout"));
		if (project === null) throw new Error("Expected the edited project.");
		expect(project.config.meta).toEqual({
			...editorTestPayload.config.meta,
			id: "project-layout",
			board: {
				width: 3,
				height: 2,
			},
			inventory: {
				width: 2,
				height: 1,
			},
			toolbarSize: 2,
		});
		expect(project.config.start).toEqual(start);

		const blocked = await client.callTool({
			name: "edit_project_layout",
			arguments: {
				revision: project.revision,
				board: {
					width: 1,
					height: 2,
				},
			},
		});
		expect(blocked).toMatchObject({
			isError: true,
			content: [
				{
					text: expect.stringContaining(
						"Board start item water at space 0, position 1,0 does not fit inside 1x2.",
					),
				},
			],
		});
		const stale = await client.callTool({
			name: "edit_project_layout",
			arguments: {
				revision: created.revision,
				board: {
					width: 1,
					height: 2,
				},
			},
		});
		expect(stale).toMatchObject({
			isError: true,
			content: [
				{
					text: expect.stringContaining(`Revision ${created.revision} is stale`),
				},
			],
		});
		expect(notifyProjectChanged).toHaveBeenCalledExactlyOnceWith("project-layout");
		expect(
			(await Effect.runPromise(repository.readProjectFx("project-layout")))?.revision,
		).toBe(project.revision);
	});

	it("sets and removes exact start slots while keeping equal board coordinates in other spaces", async () => {
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
						id: "start-items",
						inventory: {
							width: 2,
							height: 1,
						},
						toolbarSize: 2,
					},
					start: {
						currentSpace: 0,
						board: [
							{
								itemId: "water",
								space: 0,
								x: 0,
								y: 0,
							},
							{
								itemId: "water",
								space: 1,
								x: 0,
								y: 0,
							},
						],
						inventory: [],
						toolbar: [],
					},
					items: {
						water: {
							...editorTestPayload.config.items.water,
							maxCount: 7,
						},
					},
				},
				resources: editorTestPayload.resources,
			}),
		);
		ownership.setProjectContextFn("start-items");
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const readProject = async () => {
			const project = await Effect.runPromise(repository.readProjectFx("start-items"));
			if (project === null) throw new Error("Expected the start-items project.");
			return project;
		};

		let project = await readProject();
		const setBoard = await client.callTool({
			name: "set_start_item",
			arguments: {
				revision: project.revision,
				location: {
					scope: "board",
					space: 2,
					position: {
						x: 0,
						y: 0,
					},
				},
				itemId: "water",
				quantity: 2,
			},
		});
		expect(setBoard.content).toMatchObject([
			{
				text: expect.stringContaining("Space: 2"),
			},
		]);
		project = await readProject();

		const replacedBoard = await client.callTool({
			name: "set_start_item",
			arguments: {
				revision: project.revision,
				location: {
					scope: "board",
					space: 2,
					position: {
						x: 0,
						y: 0,
					},
				},
				itemId: "water",
				quantity: 3,
			},
		});
		expect(replacedBoard.content).toMatchObject([
			{
				text: expect.stringContaining("Replaced: yes"),
			},
		]);
		project = await readProject();

		for (const location of [
			{
				scope: "inventory",
				position: {
					x: 1,
					y: 0,
				},
			},
			{
				scope: "toolbar",
				position: {
					x: 1,
					y: 0,
				},
			},
		] as const) {
			const set = await client.callTool({
				name: "set_start_item",
				arguments: {
					revision: project.revision,
					location,
					itemId: "water",
					quantity: 1,
				},
			});
			expect(set.isError).not.toBe(true);
			project = await readProject();
		}

		const missingBoardSpace = await client.callTool({
			name: "set_start_item",
			arguments: {
				revision: project.revision,
				location: {
					scope: "board",
					position: {
						x: 1,
						y: 0,
					},
				},
				itemId: "water",
				quantity: 1,
			},
		});
		expect(missingBoardSpace.isError).toBe(true);

		const exceedsMaximum = await client.callTool({
			name: "set_start_item",
			arguments: {
				revision: project.revision,
				location: {
					scope: "inventory",
					position: {
						x: 0,
						y: 0,
					},
				},
				itemId: "water",
				quantity: 1,
			},
		});
		expect(exceedsMaximum).toMatchObject({
			isError: true,
			content: [
				{
					text: expect.stringContaining(
						"Item water may exist at most 7 times, but this start state would contain 8.",
					),
				},
			],
		});

		const removed = await client.callTool({
			name: "remove_start_item",
			arguments: {
				revision: project.revision,
				location: {
					scope: "board",
					space: 1,
					position: {
						x: 0,
						y: 0,
					},
				},
			},
		});
		expect(removed.content).toMatchObject([
			{
				text: expect.stringContaining("Space: 1"),
			},
		]);
		project = await readProject();
		expect(project.config.start.board).toEqual([
			{
				itemId: "water",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "water",
				quantity: 3,
				space: 2,
				x: 0,
				y: 0,
			},
		]);
		expect(project.config.start.inventory).toEqual([
			{
				itemId: "water",
				position: {
					x: 1,
					y: 0,
				},
				quantity: 1,
			},
		]);
		expect(project.config.start.toolbar).toEqual([
			{
				itemId: "water",
				position: {
					x: 1,
					y: 0,
				},
				quantity: 1,
			},
		]);
		expect(notifyProjectChanged).toHaveBeenCalledTimes(5);
	});
});
