import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
	jsonToolInputFn,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

const openProjectFn = async (config = editorTestPayload.config) => {
	const notifyFn = vi.fn();
	const { ownership, port, repository } = await createMcpHarness(Effect.runPromise, notifyFn);
	const project = await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config,
			resources: editorTestPayload.resources,
		}),
	);
	ownership.setProjectContextFn(project.projectId);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const readFn = () => Effect.runPromise(repository.readProjectFx(project.projectId));
	return {
		client,
		project,
		readFn,
		notifyFn,
	};
};

const textFn = (result: { content: unknown }) => {
	if (!Array.isArray(result.content) || result.content[0]?.type !== "text")
		throw new Error("Expected MCP text content.");
	return result.content[0].text as string;
};

it("authors one template through HTTP without replacing other templates or start assignments", async () => {
	const source = structuredClone(editorTestPayload.config);
	source.items.stone = {
		...source.items.water!,
		uid: "stone",
		title: "Stone",
	};
	const { client, project, readFn, notifyFn } = await openProjectFn(source);
	const input = {
		revision: project.revision,
		title: "MCP grove",
	};
	const created = await client.callTool({
		name: "create_template",
		arguments: jsonToolInputFn(input),
	});
	expect(created.isError, textFn(created)).not.toBe(true);
	let saved = (await readFn())!;
	const template = saved.config.templates!.find((entry) => entry.title === input.title)!;
	expect(template).toEqual({
		uid: expect.any(String),
		title: input.title,
		...project.config.meta.board,
		board: [],
	});
	expect(textFn(created)).toContain(template.uid);
	expect(textFn(created)).toContain(`Revision: ${saved.revision}`);
	const collection = await client.callTool({
		name: "template_collection",
		arguments: {
			query: input.title,
			limit: 1,
		},
	});
	expect(textFn(collection)).toContain(template.uid);
	expect(textFn(collection)).not.toContain(project.config.templates![0]!.uid);
	const edited = await client.callTool({
		name: "edit_template",
		arguments: jsonToolInputFn({
			revision: saved.revision,
			templateUid: template.uid,
			patch: {
				title: "Renamed grove",
				width: 3,
				board: [
					{
						x: 0,
						y: 0,
						itemUid: "water",
					},
				],
			},
		}),
	});
	expect(edited.isError, textFn(edited)).not.toBe(true);
	saved = (await readFn())!;
	const changed = await client.callTool({
		name: "edit_template_cells",
		arguments: jsonToolInputFn({
			revision: saved.revision,
			templateUid: template.uid,
			changes: [
				{
					type: "place",
					x: 1,
					y: 0,
					itemUid: "water",
				},
				{
					type: "move",
					from: {
						x: 0,
						y: 0,
					},
					to: {
						x: 2,
						y: 1,
					},
				},
				{
					type: "replace",
					x: 2,
					y: 1,
					itemUid: "stone",
				},
				{
					type: "remove",
					x: 1,
					y: 0,
				},
			],
		}),
	});
	expect(changed.isError, textFn(changed)).not.toBe(true);
	saved = (await readFn())!;
	const canonical = {
		...template,
		title: "Renamed grove",
		width: 3,
		board: [
			{
				x: 2,
				y: 1,
				itemUid: "stone",
			},
		],
	};
	expect(saved.config).toEqual({
		...project.config,
		templates: [
			...project.config.templates!,
			canonical,
		],
	});
	const config = await client.callTool({
		name: "template_json",
		arguments: {
			templateUid: template.uid,
		},
	});
	expect(JSON.parse(textFn(config))).toEqual({
		revision: saved.revision,
		template: canonical,
	});
	const detail = await client.callTool({
		name: "template_detail",
		arguments: {
			templateUid: template.uid,
		},
	});
	expect(textFn(detail)).toContain("A = Stone [item:stone] @ (2,1)");
	expect(textFn(detail)).toContain(`Revision: ${saved.revision}`);
	const deleted = await client.callTool({
		name: "delete_template",
		arguments: {
			revision: saved.revision,
			templateUid: template.uid,
		},
	});
	expect(deleted.isError, textFn(deleted)).not.toBe(true);
	expect((await readFn())!.config).toEqual(project.config);
	expect(notifyFn).toHaveBeenCalledTimes(4);
});

it("rejects invalid cell batches, destructive shrink, and stale writes without partial publication", async () => {
	const { client, project, readFn, notifyFn } = await openProjectFn();
	const templateUid = project.config.templates![0]!.uid;
	const invalidChanges = [
		{
			type: "place",
			x: 1,
			y: 1,
			itemUid: "constructor",
		},
		{
			type: "place",
			x: 2,
			y: 0,
			itemUid: "water",
		},
		{
			type: "move",
			from: {
				x: 1,
				y: 0,
			},
			to: {
				x: 0,
				y: 0,
			},
		},
		{
			type: "remove",
			x: 1,
			y: 1,
		},
	];
	for (const invalid of invalidChanges) {
		const result = await client.callTool({
			name: "edit_template_cells",
			arguments: jsonToolInputFn({
				revision: project.revision,
				templateUid,
				changes: [
					{
						type: "place",
						x: 1,
						y: 0,
						itemUid: "water",
					},
					invalid,
				],
			}),
		});
		expect(result.isError, JSON.stringify(invalid)).toBe(true);
		expect(await readFn()).toEqual(project);
	}
	expect(notifyFn).not.toHaveBeenCalled();
	const moved = await client.callTool({
		name: "edit_template_cells",
		arguments: jsonToolInputFn({
			revision: project.revision,
			templateUid,
			changes: [
				{
					type: "move",
					from: {
						x: 0,
						y: 0,
					},
					to: {
						x: 1,
						y: 1,
					},
				},
			],
		}),
	});
	expect(moved.isError, textFn(moved)).not.toBe(true);
	const afterMove = (await readFn())!;
	for (const patch of [
		{
			revision: afterMove.revision,
			patch: {
				width: 1,
			},
		},
		{
			revision: afterMove.revision,
			patch: {
				board: [
					{
						x: 0,
						y: 0,
						itemUid: "constructor",
					},
				],
			},
		},
		{
			revision: project.revision,
			patch: {
				title: "Stale title",
			},
		},
	]) {
		const result = await client.callTool({
			name: "edit_template",
			arguments: jsonToolInputFn({
				templateUid,
				...patch,
			}),
		});
		expect(result.isError).toBe(true);
		expect(await readFn()).toEqual(afterMove);
	}
	expect(notifyFn).toHaveBeenCalledTimes(1);
});

it("reports start and nested outcome deletion blockers without removing references", async () => {
	const config = structuredClone(editorTestPayload.config);
	config.templates!.push({
		uid: "outcome-template",
		title: "Outcome template",
		width: 2,
		height: 2,
		board: [],
	});
	config.items.water!.lines = [
		createLine({
			outcome: {
				set: [
					{
						weight: 1,
						rules: [],
						roll: [
							{
								type: "guaranteed",
								outcome: [
									{
										type: "template",
										templateUid: "outcome-template",
										rules: [],
									},
								],
							},
						],
					},
				],
			},
		}),
	];
	const { client, project, readFn, notifyFn } = await openProjectFn(config);
	for (const [templateUid, blocker] of [
		[
			"initial",
			"start",
		],
		[
			"outcome-template",
			"water",
		],
	]) {
		const detail = await client.callTool({
			name: "template_detail",
			arguments: {
				templateUid,
			},
		});
		expect(detail.isError).not.toBe(true);
		expect(textFn(detail)).toContain(blocker);
		const result = await client.callTool({
			name: "delete_template",
			arguments: {
				revision: project.revision,
				templateUid,
			},
		});
		expect(result.isError).toBe(true);
		expect(textFn(result)).toContain(blocker);
		expect(await readFn()).toEqual(project);
	}
	expect(notifyFn).not.toHaveBeenCalled();
});
