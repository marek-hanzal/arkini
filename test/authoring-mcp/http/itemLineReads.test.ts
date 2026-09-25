import { readLineAuthoringFn } from "./support/readLineAuthoringFn";
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
								uid: "last",
								clock: "clock-interval",
								clockWeight: 7,
								show: false,
								enable: false,
							},
							{
								...line,
								uid: "first",
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

it("reads canonical line pairs once from one snapshot, retaining request order and explicit missing targets", async () => {
	const { client, repository, snapshot, projectId } = await setup();
	const readSpy = vi.spyOn(repository, "readProjectFx");
	const references = [
		{
			itemUid: "forge",
			lineUid: "first",
		},
		{
			itemUid: "absent",
			lineUid: "first",
		},
		{
			itemUid: "forge",
			lineUid: "missing",
		},
		{
			itemUid: "forge",
			lineUid: "last",
		},
		{
			itemUid: "forge",
			lineUid: "first",
		},
		{
			itemUid: "absent",
			lineUid: "first",
		},
	];
	const response = await client.callTool({
		name: "item_lines_json",
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
							lineUid: "first",
							reason: "item-not-found",
						},
						{
							itemUid: "forge",
							lineUid: "missing",
							reason: "line-not-found",
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
			lineUid: `missing-${index}`,
		}),
	);
	readSpy.mockClear();
	const duplicates = await client.callTool({
		name: "item_lines_json",
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
		name: "item_lines_json",
		arguments: {
			lines: [
				...fiftyPairs,
				{
					itemUid: "other",
					lineUid: "missing-0",
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
	const listing = response.content[0];
	if (listing?.type !== "text") throw new Error("Missing line listing.");
	const lineUids = [
		...listing.text.matchAll(/\[line:("(?:[^"\\]|\\.)*")\]/g),
	].map((match) => JSON.parse(match[1]));
	expect(lineUids).toEqual(snapshot.config.items.forge!.lines.map((entry) => entry.uid));
	const listedRevision = Number(listing.text.match(/^Revision: (\d+)$/m)?.[1]);
	expect(listedRevision).toBe(snapshot.revision);
	const hydrated = await client.callTool({
		name: "item_line_json",
		arguments: {
			itemUid: "forge",
			lineUid: lineUids[0],
		},
	});
	expect(hydrated.isError).not.toBe(true);
	const hydratedContent = hydrated.content[0];
	if (hydratedContent?.type !== "text") throw new Error("Missing hydrated line.");
	expect(JSON.parse(hydratedContent.text)).toEqual({
		revision: listedRevision,
		itemUid: "forge",
		line: snapshot.config.items.forge!.lines[0],
	});

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
				...readLineAuthoringFn(line),
				title: "New line",
			},
		}),
	});
	expect(created.isError).not.toBe(true);
	const updated = await Effect.runPromise(repository.readProjectFx(projectId));
	const saved = updated!.config.items.tool!.lines[0]!;
	expect(saved.title).toBe("New line");
	expect(saved.uid).not.toBe(line.uid);
	expect(created.content[0]).toMatchObject({
		text: expect.stringContaining(`Line UID: ${saved.uid}`),
	});
});
