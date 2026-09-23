import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";

import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(async () => {
	vi.restoreAllMocks();
	await cleanupMcpHarnesses();
});

it("returns ordered canonical batch configs and missing IDs from one revision, with a unique-ID limit", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	const config = createJobTestConfig();
	await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config: {
				...config,
				meta: {
					...config.meta,
					id: "batch-config-project",
				},
			},
			resources: [],
		}),
	);
	ownership.setProjectContextFn("batch-config-project");
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const snapshot = await Effect.runPromise(repository.readProjectFx("batch-config-project"));
	expect(snapshot).not.toBeNull();
	const readSpy = vi.spyOn(repository, "readProjectFx");
	const response = await client.callTool({
		name: "item_configs",
		arguments: {
			itemUids: [
				"tool",
				"missing",
				"forge",
				"tool",
				"absent",
				"missing",
			],
		},
	});
	expect(response.isError).not.toBe(true);
	expect(response.content).toEqual([
		{
			type: "text",
			text: JSON.stringify(
				{
					revision: snapshot!.revision,
					items: [
						snapshot!.config.items.tool,
						snapshot!.config.items.forge,
					],
					missingItemUids: [
						"missing",
						"absent",
					],
				},
				null,
				2,
			),
		},
	]);
	expect(readSpy).toHaveBeenCalledExactlyOnceWith("batch-config-project");

	readSpy.mockClear();
	const fiftyIds = Array.from(
		{
			length: 50,
		},
		(_, index) => `absent-${index}`,
	);
	const duplicates = await client.callTool({
		name: "item_configs",
		arguments: {
			itemUids: [
				...fiftyIds,
				...fiftyIds,
			],
		},
	});
	expect(duplicates.isError).not.toBe(true);
	expect(duplicates.content).toEqual([
		{
			type: "text",
			text: JSON.stringify(
				{
					revision: snapshot!.revision,
					items: [],
					missingItemUids: fiftyIds,
				},
				null,
				2,
			),
		},
	]);
	expect(readSpy).toHaveBeenCalledOnce();

	readSpy.mockClear();
	const oversized = await client.callTool({
		name: "item_configs",
		arguments: {
			itemUids: [
				...fiftyIds,
				"one-too-many",
			],
		},
	});
	expect(oversized.isError).toBe(true);
	expect(readSpy).not.toHaveBeenCalled();
});
