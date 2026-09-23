import { readLineAuthoringFn } from "./support/readLineAuthoringFn";
import { Effect, Result } from "effect";
import { afterEach, expect, it, vi } from "vitest";

import { mutateItemLineFx } from "~/authoring-mcp/tool/mutateItemLineFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
	jsonToolInputFn,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

const setupFn = async () => {
	const notifyFn = vi.fn();
	const { ownership, port, repository } = await createMcpHarness(Effect.runPromise, notifyFn);
	const config = createJobTestConfig();
	const projectId = "line-mutations";
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
			},
			resources: [],
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
	return {
		client,
		repository,
		notifyFn,
		readFn,
		projectId,
	};
};

it("rejects a missing Template outcome through HTTP without persisting the line or notifying the Editor", async () => {
	const { client, notifyFn, readFn } = await setupFn();
	const before = await readFn();
	const result = await client.callTool({
		name: "create_item_line",
		arguments: jsonToolInputFn({
			itemUid: "forge",
			revision: before.revision,
			line: {
				...readLineAuthoringFn(before.config.items.forge.lines[0]!),
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
											type: "template",
											templateUid: "missing-template",
											rules: [],
										},
									],
								},
							],
						},
					],
				},
			},
		}),
	});
	expect(result.isError).toBe(true);
	expect(result.content[0]).toMatchObject({
		text: expect.stringContaining("template missing-template does not exist"),
	});
	expect(await readFn()).toEqual(before);
	expect(notifyFn).not.toHaveBeenCalled();
});

it("appends and deletes exact lines without losing other item fields, rejecting invalid identity and incomplete input", async () => {
	const { client, notifyFn, readFn } = await setupFn();
	const before = await readFn();
	const first = before.config.items.forge.lines[0]!;
	const added = {
		...readLineAuthoringFn(first),
		title: "Second line",
	};
	const callFn = (name: string, input: object) =>
		client.callTool({
			name,
			arguments: jsonToolInputFn(input),
		});
	const created = await callFn("create_item_line", {
		itemUid: "forge",
		revision: before.revision,
		line: added,
	});
	expect(created.isError).not.toBe(true);
	const afterCreate = await readFn();
	const canonicalAdded = afterCreate.config.items.forge.lines[1]!;
	expect(canonicalAdded).toEqual({
		...added,
		uid: expect.any(String),
	});
	expect(canonicalAdded.uid).not.toBe(first.uid);
	expect(created.content[0]).toMatchObject({
		text: expect.stringContaining(`Line UID: ${canonicalAdded.uid}`),
	});
	expect(afterCreate.config.items).toEqual({
		...before.config.items,
		forge: {
			...before.config.items.forge,
			lines: [
				first,
				canonicalAdded,
			],
		},
	});
	expect(created.content[0]).toMatchObject({
		text: expect.stringContaining(`Revision: ${afterCreate.revision}`),
	});
	for (const input of [
		{
			itemUid: "forge",
			revision: afterCreate.revision,
			line: {
				...added,
				uid: canonicalAdded.uid,
			},
		},
		{
			itemUid: "forge",
			revision: before.revision,
			line: {
				...added,
			},
		},
		{
			itemUid: "forge",
			revision: afterCreate.revision,
			line: {
				...added,
				enable: undefined,
			},
		},
		{
			itemUid: "missing",
			revision: afterCreate.revision,
			line: added,
		},
	])
		expect((await callFn("create_item_line", input)).isError).toBe(true);
	for (const input of [
		{
			itemUid: "forge",
			revision: afterCreate.revision,
			lineUid: "missing",
		},
		{
			itemUid: "forge",
			revision: before.revision,
			lineUid: first.uid,
		},
	])
		expect((await callFn("delete_item_line", input)).isError).toBe(true);
	expect((await readFn()).revision).toBe(afterCreate.revision);
	expect(notifyFn).toHaveBeenCalledTimes(1);

	const deleted = await callFn("delete_item_line", {
		itemUid: "forge",
		revision: afterCreate.revision,
		lineUid: first.uid,
	});
	expect(deleted.isError).not.toBe(true);
	const afterDelete = await readFn();
	expect(afterDelete.config.items).toEqual({
		...before.config.items,
		forge: {
			...before.config.items.forge,
			lines: [
				canonicalAdded,
			],
		},
	});
	expect(deleted.content[0]).toMatchObject({
		text: expect.stringContaining(`Revision: ${afterDelete.revision}`),
	});
	expect(notifyFn).toHaveBeenCalledTimes(2);
});

it("rejects all line writes when another save wins after the MCP snapshot was read", async () => {
	const { repository, notifyFn, readFn, projectId } = await setupFn();
	const snapshot = await readFn();
	const first = snapshot.config.items.forge.lines[0]!;
	await Effect.runPromise(
		repository.upsertItemFx({
			projectId,
			expectedRevision: snapshot.revision,
			item: {
				...snapshot.config.items.forge,
				title: "Concurrent author edit",
			},
		}),
	);
	const winner = await readFn();
	const commands: mutateItemLineFx.Command[] = [
		{
			operation: "create",
			itemUid: "forge",
			revision: snapshot.revision,
			line: {
				...readLineAuthoringFn(first),
			},
		},
		{
			operation: "replace",
			itemUid: "forge",
			revision: snapshot.revision,
			lineUid: first.uid,
			line: {
				...readLineAuthoringFn(first),
				title: "Stale line",
			},
		},
		{
			operation: "delete",
			itemUid: "forge",
			revision: snapshot.revision,
			lineUid: first.uid,
		},
	];
	for (const input of commands) {
		const result = await Effect.runPromise(
			mutateItemLineFx({
				input,
				project: snapshot,
				repository,
				notifyProjectChangedFn: notifyFn,
			}).pipe(Effect.result),
		);
		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result))
			expect(result.failure).toMatchObject({
				_tag: "EditorProjectRepositoryError",
				reason: "revision-conflict",
				operation: "replace-config",
			});
	}
	expect((await readFn()).config).toEqual(winner.config);
	expect((await readFn()).revision).toBe(winner.revision);
	expect(notifyFn).not.toHaveBeenCalled();
});

it("admits omitted non-Clock weights but rejects missing Clock weights before either line write", async () => {
	const { client, readFn, notifyFn } = await setupFn();
	for (const name of [
		"create_item_line",
		"replace_item_line",
	]) {
		for (const clock of [
			undefined,
			false,
			true,
		]) {
			const before = await readFn();
			const first = before.config.items.forge.lines[0]!;
			const line = {
				...readLineAuthoringFn(first),
				title: `Clock ${name} ${String(clock)}`,
				clock,
				clockWeight: undefined,
			};
			const input = {
				itemUid: "forge",
				revision: before.revision,
				...(name === "replace_item_line"
					? {
							lineUid: first.uid,
						}
					: {}),
				line,
			};
			const notifications = notifyFn.mock.calls.length;
			const result = await client.callTool({
				name,
				arguments: jsonToolInputFn(input),
			});
			if (clock === true) {
				expect(result.isError).toBe(true);
				expect((await readFn()).revision).toBe(before.revision);
				expect(notifyFn).toHaveBeenCalledTimes(notifications);
				const explicit = await client.callTool({
					name,
					arguments: jsonToolInputFn({
						...input,
						line: {
							...line,
							clockWeight: 1,
						},
					}),
				});
				expect(explicit.isError).not.toBe(true);
			} else expect(result.isError).not.toBe(true);
			const saved = (await readFn()).config.items.forge.lines.find(
				(candidate) => candidate.title === line.title,
			);
			expect(saved?.clockWeight).toBe(1);
			expect(saved?.clock).toBe(clock);
		}
	}
});
