import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
	jsonToolInputFn,
} from "./support/createMcpHarness";

const projectId = "edit-item-capabilities-project";
const itemId = "item:workshop";
const resourceId = editorTestPayload.resources[0]?.id ?? "missing-asset";
const productionLines = JSON.parse(
	JSON.stringify([
		createLine({}),
	]),
);
const seededConfig = GameConfigSchema.parse({
	...editorTestPayload.config,
	meta: {
		...editorTestPayload.config.meta,
		id: projectId,
	},
	items: {
		...editorTestPayload.config.items,
		[itemId]: {
			...createDraftFn({
				resourceId,
				uid: "uid:workshop",
			}),
			id: itemId,
			title: "Workshop",
			description: "Existing workshop.",
			maxQueueSize: 4,
			scope: "board",
			clock: {
				intervalMs: 1000,
			},
			control: "automatic-only",
			lines: productionLines,
		},
	},
});

const notifyProjectChanged = vi.fn();
let client: Awaited<ReturnType<typeof connectMcpClient>>;
let repository: Awaited<ReturnType<typeof createMcpHarness>>["repository"];

beforeAll(async () => {
	const harness = await createMcpHarness(Effect.runPromise, notifyProjectChanged);
	repository = harness.repository;
	await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config: seededConfig,
			resources: editorTestPayload.resources,
		}),
	);
	harness.ownership.setProjectContextFn(projectId);
	await Effect.runPromise(harness.ownership.startLocalFx);
	client = await connectMcpClient(harness.port);
});

afterAll(cleanupMcpHarnesses);

describe.sequential("editor MCP optional item capabilities", () => {
	it("retains the clock when its final production line is explicitly removed", async () => {
		const edited = await client.callTool({
			name: "edit_item",
			arguments: jsonToolInputFn({
				itemId: itemId,
				patch: {
					lines: [],
				},
			}),
		});
		expect(edited.isError).not.toBe(true);
		const project = await Effect.runPromise(repository.readProjectFx(projectId));
		expect(project?.config.items[itemId]).toMatchObject({
			lines: [],
			maxQueueSize: 4,
		});
		expect(project?.config.items[itemId]).toHaveProperty("clock.intervalMs", 1000);
		const once = await client.callTool({
			name: "edit_item",
			arguments: jsonToolInputFn({
				itemId: itemId,
				patch: {
					clock: {
						durationMs: 2000,
					},
				},
			}),
		});
		expect(once.isError).not.toBe(true);
		const saved = (await Effect.runPromise(repository.readProjectFx(projectId)))?.config.items[
			itemId
		];
		expect(saved).toMatchObject({
			lines: [],
			clock: {
				durationMs: 2000,
			},
		});
		expect(saved).not.toHaveProperty("clock.intervalMs");
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
				name: "edit_item",
				arguments: jsonToolInputFn({
					itemId: itemId,
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
					clock: null,
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
			(await Effect.runPromise(repository.readProjectFx(projectId)))?.config.items[itemId],
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
			(await Effect.runPromise(repository.readProjectFx(projectId)))?.config.items[itemId],
		).not.toHaveProperty("action");
	});
});
