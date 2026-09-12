import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
	jsonToolInputFn,
} from "./support/createMcpHarness";

const projectId = "edit-item-types-project";
const groups = [
	{
		name: "edits Common items through their dedicated tools",
		cases: [
			[
				"common",
				{
					title: "Edited Common",
				},
			],
		],
	},
	{
		name: "edits Inventory items through its dedicated tool",
		cases: [
			[
				"inventory",
				{
					title: "Edited Inventory",
				},
			],
		],
	},
	{
		name: "edits Temporary items through their dedicated tools",
		cases: [
			[
				"temporary",
				{
					durationMs: 1000,
				},
			],
		],
	},
] as const;

const itemId = (type: TypeSchema.Type) => `${type === "common" ? "common" : "item"}:edit-${type}`;
const resourceId = editorTestPayload.resources[0]?.id ?? "missing-asset";
const productionLines = JSON.parse(
	JSON.stringify([
		createLine({}),
	]),
);
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
						...createDraftFn({
							resourceId,
							type,
							uid: `uid:edit-${type}`,
						}),
						description: `Existing ${type} item.`,
						id,
						title: `Original ${type}`,
						...(type === "common"
							? {
									maxQueueSize: 4,
									scope: "board",
									clock: {
										intervalMs: 1000,
									},
									control: "automatic-only",
									lines: productionLines,
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
			version: {
				major: 1,
				minor: 0,
			},
			config: seededConfig,
			resources: editorTestPayload.resources,
		}),
	);
	revision = created.revision;
	harness.ownership.setProjectContextFn(projectId);
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
				arguments: jsonToolInputFn({
					itemId: itemId(type),
					patch,
				}),
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
		if (cases.some(([type]) => type === "common"))
			expect(project.config.items[itemId("common")]).toMatchObject({
				maxQueueSize: 4,
				clock: {
					intervalMs: 1000,
				},
				control: "automatic-only",
				lines: productionLines,
			});
		expect(project.revision).toBeGreaterThan(revisionBefore);
		revision = project.revision;
		expect(notifyProjectChanged).toHaveBeenCalledTimes(cases.length);

		const rejectedTypes = cases
			.map(([type]) => type)
			.filter((type): type is "common" => type === "common");
		for (const type of rejectedTypes) {
			const rejected = await client.callTool({
				name: `edit_${type}_item`,
				arguments: jsonToolInputFn({
					itemId: itemId(type),
					patch: {},
				}),
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
	it("requires an explicit clock removal before clearing its final production lines", async () => {
		const rejected = await client.callTool({
			name: "edit_common_item",
			arguments: jsonToolInputFn({
				itemId: itemId("common"),
				patch: {
					lines: [],
				},
			}),
		});
		expect(rejected.isError).toBe(true);
		const edited = await client.callTool({
			name: "edit_common_item",
			arguments: jsonToolInputFn({
				itemId: itemId("common"),
				patch: {
					lines: [],
					clock: null,
				},
			}),
		});
		expect(edited.isError).not.toBe(true);
		const project = await Effect.runPromise(repository.readProjectFx(projectId));
		expect(project?.config.items[itemId("common")]).toMatchObject({
			lines: [],
			maxQueueSize: 4,
		});
		expect(project?.config.items[itemId("common")]).not.toHaveProperty("clock");
	});
	it("rejects conflicting action production and preserves or clears the optional action explicitly", async () => {
		const action = {
			type: "space",
			space: 4,
			input: [],
			rules: [],
		};
		const edit = (patch: Record<string, unknown>) =>
			client.callTool({
				name: "edit_common_item",
				arguments: jsonToolInputFn({
					itemId: itemId("common"),
					patch,
				}),
			});
		const before = await Effect.runPromise(repository.readProjectFx(projectId));
		const conflict = await edit({
			action,
			lines: productionLines,
		});
		expect(conflict.isError).toBe(true);
		expect((await Effect.runPromise(repository.readProjectFx(projectId)))?.revision).toBe(
			before?.revision,
		);
		expect(
			(
				await edit({
					action,
					lines: [],
				})
			).isError,
		).not.toBe(true);
		expect(
			(
				await edit({
					title: "Action owner",
				})
			).isError,
		).not.toBe(true);
		expect(
			(await Effect.runPromise(repository.readProjectFx(projectId)))?.config.items[
				itemId("common")
			],
		).toMatchObject({
			action,
			lines: [],
		});
		expect(
			(
				await edit({
					action: null,
				})
			).isError,
		).not.toBe(true);
		expect(
			(await Effect.runPromise(repository.readProjectFx(projectId)))?.config.items[
				itemId("common")
			],
		).not.toHaveProperty("action");
	});
});
