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

const setupFn = async () => {
	const notifyFn = vi.fn();
	const { ownership, port, repository } = await createMcpHarness(Effect.runPromise, notifyFn);
	const config = createJobTestConfig();
	const first = config.items.forge.lines[0]!;
	const sibling = {
		...first,
		uid: "sibling",
		default: false,
	};
	const projectId = "batch-lines";
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
							sibling,
						],
					},
					other: {
						...config.items.forge,
						uid: "other",
						lines: [
							{
								...first,
								uid: "other-line",
							},
						],
					},
				},
			},
		}),
	);
	ownership.setProjectContextFn(projectId);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const readFn = async () => {
		const project = await Effect.runPromise(repository.readProjectFx(projectId));
		if (project === null) throw new Error("Missing fixture project");
		return project;
	};
	const callFn = (revision: number, operations: ReadonlyArray<unknown>) =>
		client.callTool({
			name: "edit_item_lines",
			arguments: jsonToolInputFn({
				revision,
				operations,
			}),
		});
	return {
		repository,
		notifyFn,
		readFn,
		callFn,
		first,
		sibling,
	};
};

it("commits mixed edits across items from one snapshot with one revision and one notification", async () => {
	const { repository, notifyFn, readFn, callFn, first, sibling } = await setupFn();
	const before = await readFn();
	const readSpy = vi.spyOn(repository, "readProjectFx");
	const writeSpy = vi.spyOn(repository, "replaceConfigFx");
	const replacement = {
		...first,
		title: "Changed",
		default: false,
	};
	const added = {
		...readLineAuthoringFn(first),
		default: true,
	};
	const response = await callFn(before.revision, [
		{
			operation: "create",
			itemUid: "forge",
			line: added,
		},
		{
			operation: "replace",
			itemUid: "forge",
			lineUid: first.uid,
			line: readLineAuthoringFn(replacement),
		},
		{
			operation: "delete",
			itemUid: "other",
			lineUid: "other-line",
		},
	]);
	expect(response.isError).not.toBe(true);
	expect(readSpy).toHaveBeenCalledExactlyOnceWith(before.projectId);
	expect(writeSpy).toHaveBeenCalledOnce();
	expect(notifyFn).toHaveBeenCalledExactlyOnceWith(before.projectId);
	const after = await readFn();
	const canonicalAdded = after.config.items.forge.lines[2]!;
	expect(canonicalAdded).toEqual({
		...added,
		uid: expect.any(String),
	});
	expect(canonicalAdded.uid).not.toBe(first.uid);
	expect(after.config).toEqual({
		...before.config,
		items: {
			...before.config.items,
			forge: {
				...before.config.items.forge,
				lines: [
					replacement,
					sibling,
					canonicalAdded,
				],
			},
			other: {
				...before.config.items.other,
				lines: [],
			},
		},
	});
	expect(response.content[0]).toMatchObject({
		text: expect.stringContaining(`Revision: ${after.revision}`),
	});
	expect(writeSpy.mock.calls[0]![0].expectedRevision).toBe(before.revision);
});

it("rejects an entire batch before writing when a later operation or resulting item is invalid", async () => {
	const { repository, notifyFn, readFn, callFn, first } = await setupFn();
	const before = await readFn();
	const writeSpy = vi.spyOn(repository, "replaceConfigFx");
	const valid = {
		operation: "create",
		itemUid: "forge",
		line: {
			...readLineAuthoringFn(first),
			default: false,
		},
	};
	for (const invalid of [
		{
			operation: "delete",
			itemUid: "other",
			lineUid: "missing",
		},
		{
			operation: "create",
			itemUid: "other",
			line: first,
		},
		{
			operation: "replace",
			itemUid: "other",
			lineUid: "other-line",
			line: {
				...first,
				uid: "wrong",
			},
		},
		{
			operation: "create",
			itemUid: "missing",
			line: readLineAuthoringFn(first),
		},
		{
			operation: "delete",
			itemUid: "forge",
			lineUid: "added",
		},
	]) {
		const response = await callFn(before.revision, [
			valid,
			invalid,
		]);
		expect(response.isError).toBe(true);
	}
	expect(
		(
			await callFn(before.revision - 1, [
				valid,
			])
		).isError,
	).toBe(true);
	expect(writeSpy).not.toHaveBeenCalled();
	expect(notifyFn).not.toHaveBeenCalled();
	expect(await readFn()).toEqual(before);
});

it("accepts 20 edits in one commit but rejects larger batches without writes", async () => {
	const { repository, notifyFn, readFn, callFn, first } = await setupFn();
	const before = await readFn();
	const writeSpy = vi.spyOn(repository, "replaceConfigFx");
	const operations = Array.from(
		{
			length: 21,
		},
		(_, index) => ({
			operation: "create",
			itemUid: "forge",
			line: {
				...readLineAuthoringFn(first),
				title: `Batch ${index}`,
				default: false,
			},
		}),
	);
	expect((await callFn(before.revision, operations)).isError).toBe(true);
	expect(writeSpy).not.toHaveBeenCalled();
	expect((await callFn(before.revision, operations.slice(0, 20))).isError).not.toBe(true);
	expect(writeSpy).toHaveBeenCalledOnce();
	expect(notifyFn).toHaveBeenCalledOnce();
	const createdLines = (await readFn()).config.items.forge.lines.slice(2);
	expect(createdLines.map(readLineAuthoringFn)).toEqual(
		operations.slice(0, 20).map((operation) => operation.line),
	);
	expect(new Set(createdLines.map((line) => line.uid)).size).toBe(20);
});

it("rejects all batch edits when a concurrent save overtakes its snapshot", async () => {
	const { repository, notifyFn, readFn, callFn, first } = await setupFn();
	const before = await readFn();
	vi.spyOn(repository, "readProjectFx").mockImplementationOnce(() =>
		Effect.gen(function* () {
			yield* repository.upsertItemFx({
				projectId: before.projectId,
				expectedRevision: before.revision,
				item: {
					...before.config.items.other,
					title: "Concurrent change",
				},
			});
			return before;
		}),
	);
	const response = await callFn(before.revision, [
		{
			operation: "create",
			itemUid: "forge",
			line: {
				...readLineAuthoringFn(first),
				default: false,
			},
		},
		{
			operation: "delete",
			itemUid: "other",
			lineUid: "other-line",
		},
	]);
	expect(response.isError).toBe(true);
	expect(notifyFn).not.toHaveBeenCalled();
	const winner = await readFn();
	expect(winner.config).toEqual({
		...before.config,
		items: {
			...before.config.items,
			other: {
				...before.config.items.other,
				title: "Concurrent change",
			},
		},
	});
});
