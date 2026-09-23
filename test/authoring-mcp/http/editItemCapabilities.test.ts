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
			clock: {
				intervalMs: 1000,
			},
			ui: "simple",
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

describe("editor MCP optional item capabilities", {
	concurrent: false,
}, () => {
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
	it("preserves authored Space outcomes when changing unrelated item capabilities", async () => {
		const lines = [
			createLine({
				default: true,
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
											type: "space",
											space: 4,
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
		const edited = await client.callTool({
			name: "edit_item",
			arguments: jsonToolInputFn({
				itemId,
				patch: {
					lines,
				},
			}),
		});
		expect(edited.isError).not.toBe(true);
		const changed = await client.callTool({
			name: "edit_item",
			arguments: jsonToolInputFn({
				itemId,
				patch: {
					title: "Portal workshop",
				},
			}),
		});
		expect(changed.isError).not.toBe(true);
		const saved = (await Effect.runPromise(repository.readProjectFx(projectId)))?.config.items[
			itemId
		];
		expect(saved?.lines).toEqual(lines);
		expect(saved?.clock).toMatchObject({
			durationMs: 2000,
		});
	});
});
