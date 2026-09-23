import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

it("edits fallback dimensions without resizing templates, and revision-guards independent space assignments", async () => {
	const { ownership, port, repository } = await createMcpHarness();
	const created = await Effect.runPromise(
		repository.createProjectFx({
			version: {
				major: 1,
				minor: 0,
			},
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		}),
	);
	ownership.setProjectContextFn(created.projectId);
	await Effect.runPromise(ownership.startLocalFx);
	const client = await connectMcpClient(port);
	const resized = await client.callTool({
		name: "edit_project_layout",
		arguments: {
			revision: created.revision,
			board: {
				width: 1,
				height: 1,
			},
		},
	});
	expect(resized.isError).not.toBe(true);
	const readFn = () => Effect.runPromise(repository.readProjectFx(created.projectId));
	const resizedProject = (await readFn())!;
	expect(resizedProject.config.templates).toEqual(editorTestPayload.config.templates);
	expect(resizedProject.config.meta.board).toEqual({
		width: 1,
		height: 1,
	});
	const uid = resizedProject.config.templates![0]!.uid;
	const assigned = await client.callTool({
		name: "set_start_space",
		arguments: {
			revision: resizedProject.revision,
			space: 9,
			templateUid: uid,
		},
	});
	expect(assigned.isError).not.toBe(true);
	const assignedProject = (await readFn())!;
	expect(assignedProject.config.start.spaces).toEqual([
		{
			space: 0,
			templateUid: uid,
		},
		{
			space: 9,
			templateUid: uid,
		},
	]);
	expect(assignedProject.config.templates).toEqual(editorTestPayload.config.templates);
	const stale = await client.callTool({
		name: "remove_start_space",
		arguments: {
			revision: resizedProject.revision,
			space: 9,
		},
	});
	expect(stale.isError).toBe(true);
	const missing = await client.callTool({
		name: "set_start_space",
		arguments: {
			revision: assignedProject.revision,
			space: 10,
			templateUid: "missing",
		},
	});
	expect(missing.isError).toBe(true);
	expect((await readFn())!.revision).toBe(assignedProject.revision);
	const removed = await client.callTool({
		name: "remove_start_space",
		arguments: {
			revision: assignedProject.revision,
			space: 9,
		},
	});
	expect(removed.isError).not.toBe(true);
	const final = (await readFn())!;
	expect(final.config.start).toEqual(editorTestPayload.config.start);
	expect(final.config.templates).toEqual(editorTestPayload.config.templates);
});
