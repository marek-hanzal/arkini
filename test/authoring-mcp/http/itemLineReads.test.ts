import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";

import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
	jsonToolInputFn,
} from "./support/createMcpHarness";

afterEach(async () => {
	vi.restoreAllMocks();
	await cleanupMcpHarnesses();
});

const setup = async () => {
	const { ownership, port, repository } = await createMcpHarness();
	const config = createJobTestConfig();
	const line = config.items.forge!.lines[0]!;
	const projectId = "line-reads";
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
					id: projectId,
				},
				items: {
					...config.items,
					forge: {
						...config.items.forge!,
						lines: [
							{
								...line,
								id: "last",
								clock: true,
								clockWeight: 7,
								show: false,
								enable: false,
							},
							{
								...line,
								id: "first",
							},
							{
								...line,
								id: "ambiguous",
							},
							{
								...line,
								id: "ambiguous",
							},
						],
					},
				},
			},
			resources: [],
		}),
	);
	ownership.setProjectContextFn(projectId);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const snapshot = await Effect.runPromise(repository.readProjectFx(projectId));
	if (snapshot === null) throw new Error("Missing test project.");
	return {
		client,
		repository,
		snapshot,
		projectId,
		line,
	};
};

it("reads canonical line pairs once from one snapshot, retaining request order and explicit missing or ambiguous targets", async () => {
	const { client, repository, snapshot, projectId } = await setup();
	const readSpy = vi.spyOn(repository, "readProjectFx");
	const references = [
		{
			itemUid: "forge",
			lineId: "first",
		},
		{
			itemUid: "absent",
			lineId: "first",
		},
		{
			itemUid: "forge",
			lineId: "missing",
		},
		{
			itemUid: "forge",
			lineId: "last",
		},
		{
			itemUid: "forge",
			lineId: "ambiguous",
		},
		{
			itemUid: "forge",
			lineId: "first",
		},
		{
			itemUid: "absent",
			lineId: "first",
		},
	];
	const response = await client.callTool({
		name: "item_line_configs",
		arguments: {
			lines: references,
		},
	});
	expect(response.isError).not.toBe(true);
	expect(response.content).toEqual([
		{
			type: "text",
			text: JSON.stringify(
				{
					revision: snapshot.revision,
					lines: [
						{
							itemUid: "forge",
							line: snapshot.config.items.forge!.lines[1],
						},
						{
							itemUid: "forge",
							line: snapshot.config.items.forge!.lines[0],
						},
					],
					issues: [
						{
							itemUid: "absent",
							lineId: "first",
							reason: "item-not-found",
						},
						{
							itemUid: "forge",
							lineId: "missing",
							reason: "line-not-found",
						},
						{
							itemUid: "forge",
							lineId: "ambiguous",
							reason: "ambiguous-line",
						},
					],
				},
				null,
				2,
			),
		},
	]);
	expect(readSpy).toHaveBeenCalledExactlyOnceWith(projectId);

	const fiftyPairs = Array.from(
		{
			length: 50,
		},
		(_, index) => ({
			itemUid: "forge",
			lineId: `missing-${index}`,
		}),
	);
	readSpy.mockClear();
	const duplicates = await client.callTool({
		name: "item_line_configs",
		arguments: {
			lines: [
				...fiftyPairs,
				...fiftyPairs,
			],
		},
	});
	expect(duplicates.isError).not.toBe(true);
	expect(readSpy).toHaveBeenCalledOnce();
	readSpy.mockClear();
	const oversized = await client.callTool({
		name: "item_line_configs",
		arguments: {
			lines: [
				...fiftyPairs,
				{
					itemUid: "other",
					lineId: "missing-0",
				},
			],
		},
	});
	expect(oversized.isError).toBe(true);
	expect(readSpy).not.toHaveBeenCalled();
});

it("discovers authored lines in order and accepts a lightweight detail revision for line creation", async () => {
	const { client, repository, snapshot, projectId, line } = await setup();
	const response = await client.callTool({
		name: "item_lines",
		arguments: {
			itemUid: "forge",
		},
	});
	expect(response.isError).not.toBe(true);
	expect(response.content).toEqual([
		{
			type: "text",
			text: JSON.stringify(
				{
					revision: snapshot.revision,
					itemUid: "forge",
					lines: snapshot.config.items.forge!.lines.map((entry) => ({
						id: entry.id,
						title: entry.title,
						default: entry.default,
						clock: entry.clock === true,
						clockWeight: entry.clockWeight,
						show: entry.show,
						enable: entry.enable,
					})),
				},
				null,
				2,
			),
		},
	]);
	const detail = await client.callTool({
		name: "item_detail",
		arguments: {
			itemUid: "tool",
		},
	});
	const content = detail.content[0];
	if (content?.type !== "text") throw new Error("Missing detail response.");
	const revision = Number(content.text.match(/^Revision: (\d+)$/m)?.[1]);
	expect(revision).toBe(snapshot.revision);
	const created = await client.callTool({
		name: "create_item_line",
		arguments: jsonToolInputFn({
			itemUid: "tool",
			revision,
			line: {
				...line,
				id: "new-line",
			},
		}),
	});
	expect(created.isError).not.toBe(true);
	const updated = await Effect.runPromise(repository.readProjectFx(projectId));
	expect(updated?.config.items.tool!.lines.map(({ id }) => id)).toEqual([
		"new-line",
	]);
});
