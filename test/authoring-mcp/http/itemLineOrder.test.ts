import { Effect, Result } from "effect";
import { afterEach, expect, it, vi } from "vitest";

import { orderLinesFx } from "~/item-authoring/fx/orderLinesFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

it("publishes an ordered commit through MCP and protects a snapshot overtaken by a concurrent save", async () => {
	const notifyFn = vi.fn();
	const { ownership, port, repository } = await createMcpHarness(Effect.runPromise, notifyFn);
	const config = createJobTestConfig();
	const first = config.items.forge.lines[0]!;
	const second = {
		...first,
		uid: "second",
		default: false,
	};
	const projectId = "line-order";
	await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			resources: [],
			config: {
				...config,
				meta: {
					...config.meta,
					id: projectId,
				},
				items: {
					...config.items,
					forge: {
						...config.items.forge,
						lines: [
							first,
							second,
						],
					},
				},
			},
		}),
	);
	ownership.setProjectContextFn(projectId);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const snapshot = await Effect.runPromise(repository.readProjectFx(projectId));
	if (snapshot === null) throw new Error("Missing test project");
	const response = await client.callTool({
		name: "item_line_order",
		arguments: {
			itemUid: "forge",
			lineUids: [
				second.uid,
				first.uid,
			],
			revision: snapshot.revision,
		},
	});
	expect(response.isError).not.toBe(true);
	const saved = await Effect.runPromise(repository.readProjectFx(projectId));
	if (saved === null) throw new Error("Missing saved project");
	expect(saved.config.items.forge).toEqual({
		...snapshot.config.items.forge,
		lines: [
			second,
			first,
		],
	});
	expect(response.content[0]).toMatchObject({
		text: expect.stringContaining(`Revision: ${saved.revision}`),
	});
	expect(notifyFn).toHaveBeenCalledExactlyOnceWith(projectId);

	const rejected = await client.callTool({
		name: "item_line_order",
		arguments: {
			itemUid: "forge",
			lineUids: [
				first.uid,
			],
			revision: saved.revision,
		},
	});
	expect(rejected.isError).toBe(true);
	expect(notifyFn).toHaveBeenCalledOnce();
	const stale = await Effect.runPromise(
		orderLinesFx({
			project: snapshot,
			repository,
			itemUid: "forge",
			lineUids: [
				first.uid,
				second.uid,
			],
			revision: snapshot.revision,
		}).pipe(Effect.result),
	);
	expect(Result.isFailure(stale)).toBe(true);
	if (Result.isFailure(stale))
		expect(stale.failure).toMatchObject({
			reason: "revision-conflict",
		});
	expect(await Effect.runPromise(repository.readProjectFx(projectId))).toEqual(saved);
});
