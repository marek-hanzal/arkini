import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { createEditorItemDraftFn } from "~/item-authoring/fn/createEditorItemDraftFn";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

const projectId = "edit-item-types-project";
const groups = [
	{
		name: "edits simple, space, and craft items through their dedicated tools",
		cases: [
			[
				"simple",
				{
					maxStackSize: 3,
				},
			],
			[
				"space",
				{
					title: "Edited space",
				},
			],
			[
				"craft",
				{
					title: "Edited craft",
				},
			],
		],
	},
	{
		name: "edits blueprint and inventory items through their dedicated tools",
		cases: [
			[
				"blueprint",
				{
					title: "Edited blueprint",
				},
			],
			[
				"inventory",
				{
					title: "Edited inventory",
				},
			],
		],
	},
	{
		name: "edits producer and deposit items through their dedicated tools",
		cases: [
			[
				"producer",
				{
					title: "Edited producer",
				},
			],
			[
				"deposit",
				{
					lines: null,
					title: "Edited deposit",
				},
			],
		],
	},
	{
		name: "edits stash and temporary items through their dedicated tools",
		cases: [
			[
				"stash",
				{
					title: "Edited stash",
				},
			],
			[
				"temporary",
				{
					durationMs: 1_000,
				},
			],
		],
	},
] as const;

const itemId = (type: TypeSchema.Type) =>
	`${type === "producer" ? "producer" : "item"}:edit-${type}`;
const resourceId = editorTestPayload.resources[0]?.id ?? "missing-asset";
const producerDraft = createEditorItemDraftFn({
	resourceId,
	type: "producer",
	uid: "uid:deposit-line-source",
});
if (producerDraft.type !== "producer") throw new Error("Expected a producer draft.");

const types = groups.flatMap(({ cases }) => cases.map(([type]) => type));
const seededConfig = GameConfigSchema.parse({
	...editorTestPayload.config,
	meta: {
		...editorTestPayload.config.meta,
		id: projectId,
	},
	items: {
		...editorTestPayload.config.items,
		...Object.fromEntries(
			types.map((type) => {
				const id = itemId(type);
				return [
					id,
					{
						...createEditorItemDraftFn({
							resourceId,
							type,
							uid: `uid:edit-${type}`,
						}),
						description: `Existing ${type} item.`,
						id,
						title: `Original ${type}`,
						...(type === "producer" || type === "deposit"
							? {
									maxQueueSize: 4,
								}
							: {}),
						...(type === "deposit"
							? {
									lines: producerDraft.lines,
								}
							: {}),
					},
				];
			}),
		),
	},
});

const notifyProjectChanged = vi.fn();
let client: Awaited<ReturnType<typeof connectMcpClient>>;
let repository: Awaited<ReturnType<typeof createMcpHarness>>["repository"];
let revision: number;

beforeAll(async () => {
	const harness = await createMcpHarness(Effect.runPromise, notifyProjectChanged);
	repository = harness.repository;
	const created = await Effect.runPromise(
		repository.createProjectFx({
			version: "1.0",
			config: seededConfig,
			resources: editorTestPayload.resources,
		}),
	);
	revision = created.revision;
	harness.ownership.setProjectContext(projectId);
	await Effect.runPromise(harness.ownership.startLocalFx);
	client = await connectMcpClient(harness.port);
});

afterAll(cleanupMcpHarnesses);

describe.sequential("editor MCP typed item editing", () => {
	it.each(groups)("$name", async ({ cases }) => {
		notifyProjectChanged.mockClear();
		const revisionBefore = revision;

		for (const [type, patch] of cases) {
			const edited = await client.callTool({
				name: `edit_${type}_item`,
				arguments: {
					itemId: itemId(type),
					patch,
				},
			});
			expect(edited.isError, type).not.toBe(true);
			expect(edited.content, type).toMatchObject([
				{
					text: expect.stringContaining(`Edited ${type} item.`),
				},
			]);
		}

		const project = await Effect.runPromise(repository.readProjectFx(projectId));
		if (project === null) throw new Error("Expected the edited item project.");
		for (const [type, patch] of cases) {
			const item = project.config.items[itemId(type)];
			expect(item, type).toMatchObject({
				...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null)),
				id: itemId(type),
				type,
				uid: `uid:edit-${type}`,
			});
			for (const [field, value] of Object.entries(patch)) {
				if (value === null) expect(item, `${type}.${field}`).not.toHaveProperty(field);
			}
		}
		if (cases.some(([type]) => type === "producer"))
			expect(project.config.items[itemId("producer")]).toMatchObject({
				maxQueueSize: 4,
			});
		if (cases.some(([type]) => type === "deposit"))
			expect(project.config.items[itemId("deposit")]).toMatchObject({
				maxQueueSize: 4,
			});
		expect(project.revision).toBeGreaterThan(revisionBefore);
		revision = project.revision;
		expect(notifyProjectChanged).toHaveBeenCalledTimes(cases.length);

		const rejectedTypes = cases
			.map(([type]) => type)
			.filter(
				(type): type is "producer" | "deposit" => type === "producer" || type === "deposit",
			);
		for (const type of rejectedTypes) {
			const rejected = await client.callTool({
				name: `edit_${type}_item`,
				arguments: {
					itemId: itemId(type),
					patch: {},
				},
			});
			expect(rejected.isError, type).toBe(true);
		}
		if (rejectedTypes.length > 0) {
			expect((await Effect.runPromise(repository.readProjectFx(projectId)))?.revision).toBe(
				revision,
			);
			expect(notifyProjectChanged).toHaveBeenCalledTimes(cases.length);
		}
	});
});
