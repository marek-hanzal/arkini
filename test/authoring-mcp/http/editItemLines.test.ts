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
		id: "sibling",
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
						id: "other",
						uid: "other-uid",
					},
					action: {
						...config.items.tool,
						id: "action",
						uid: "action-uid",
						clock: undefined,
						lines: [],
						action: {
							type: "space",
							space: 1,
							input: [],
							rules: [],
						},
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
		...first,
		id: "appended",
		default: true,
	};
	const response = await callFn(before.revision, [
		{
			operation: "create",
			itemId: "forge",
			line: added,
		},
		{
			operation: "replace",
			itemId: "forge",
			lineId: first.id,
			line: replacement,
		},
		{
			operation: "delete",
			itemId: "other",
			lineId: first.id,
		},
	]);
	expect(response.isError).not.toBe(true);
	expect(readSpy).toHaveBeenCalledExactlyOnceWith(before.projectId);
	expect(writeSpy).toHaveBeenCalledOnce();
	expect(notifyFn).toHaveBeenCalledExactlyOnceWith(before.projectId);
	const after = await readFn();
	expect(after.config).toEqual({
		...before.config,
		items: {
			...before.config.items,
			forge: {
				...before.config.items.forge,
				lines: [
					replacement,
					sibling,
					added,
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
		itemId: "forge",
		line: {
			...first,
			id: "added",
			default: false,
		},
	};
	for (const invalid of [
		{
			operation: "delete",
			itemId: "other",
			lineId: "missing",
		},
		{
			operation: "create",
			itemId: "other",
			line: first,
		},
		{
			operation: "replace",
			itemId: "other",
			lineId: first.id,
			line: {
				...first,
				id: "wrong",
			},
		},
		{
			operation: "create",
			itemId: "missing",
			line: first,
		},
		{
			operation: "create",
			itemId: "action",
			line: first,
		},
		{
			operation: "delete",
			itemId: "forge",
			lineId: "added",
		},
	]) {
		const response = await callFn(before.revision, [
			valid,
			invalid,
		]);
		expect(response.isError).toBe(true);
		expect(response.content[0]).toMatchObject({
			text: expect.stringMatching(/Operation(?:s)? 2/),
		});
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
			itemId: "forge",
			line: {
				...first,
				id: `batch-${index}`,
				default: false,
			},
		}),
	);
	expect((await callFn(before.revision, operations)).isError).toBe(true);
	expect(writeSpy).not.toHaveBeenCalled();
	expect((await callFn(before.revision, operations.slice(0, 20))).isError).not.toBe(true);
	expect(writeSpy).toHaveBeenCalledOnce();
	expect(notifyFn).toHaveBeenCalledOnce();
	expect((await readFn()).config.items.forge.lines.slice(2)).toEqual(
		operations.slice(0, 20).map((operation) => operation.line),
	);
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
			itemId: "forge",
			line: {
				...first,
				id: "never-added",
				default: false,
			},
		},
		{
			operation: "delete",
			itemId: "other",
			lineId: first.id,
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
