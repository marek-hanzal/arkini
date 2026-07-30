import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
	openPath: vi.fn(() => Promise.resolve("")),
}));

vi.mock("electron", () => ({
	shell: {
		openPath: electron.openPath,
	},
}));

import { createFilesystemEditorWorkspaceFx } from "../../electron/main/editor/createFilesystemEditorWorkspaceFx";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-editor-workspace-"));
	electron.openPath.mockClear();
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

const createWorkspace = () =>
	Effect.runPromise(
		createFilesystemEditorWorkspaceFx({
			root,
		}).pipe(Effect.provide(NodeServices.layer)),
	);

describe("createFilesystemEditorWorkspaceFx", () => {
	it("atomically creates, reads, and opens contained editor projects", async () => {
		const workspace = await createWorkspace();
		const record = {
			projectId: "arkini-test",
			files: [
				{
					path: "game.json",
					bytes: new TextEncoder().encode("{}\n"),
				},
				{
					path: "simple/item-test.json",
					bytes: new TextEncoder().encode('{"items":{}}\n'),
				},
				{
					path: "assets/item-test.png",
					bytes: new Uint8Array([1, 2, 3]),
				},
			],
		};

		await Effect.runPromise(workspace.createFx(record));
		await expect(Effect.runPromise(workspace.readFx(record.projectId))).resolves.toEqual(record);
		await expect(Effect.runPromise(workspace.readFx("missing"))).resolves.toBeNull();
		await expect(Effect.runPromise(workspace.createFx(record))).rejects.toThrow("Create Arkini editor project");

		await Effect.runPromise(workspace.openDirectoryFx());
		await Effect.runPromise(workspace.openDirectoryFx(record.projectId));
		expect(electron.openPath).toHaveBeenNthCalledWith(1, root);
		expect(electron.openPath).toHaveBeenNthCalledWith(2, join(root, record.projectId));
	});

	it("rejects traversal, duplicate files, and missing project directories", async () => {
		const workspace = await createWorkspace();
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "../escape",
					files: [
						{
							path: "game.json",
							bytes: new Uint8Array(),
						},
					],
				}),
			),
		).rejects.toThrow("Invalid Arkini editor project identity");
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "escape",
					files: [
						{
							path: "../game.json",
							bytes: new Uint8Array(),
						},
					],
				}),
			),
		).rejects.toThrow("Invalid Arkini editor project file path");
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "duplicate",
					files: [
						{
							path: "game.json",
							bytes: new Uint8Array(),
						},
						{
							path: "game.json",
							bytes: new Uint8Array(),
						},
					],
				}),
			),
		).rejects.toThrow("Create Arkini editor project");
		await expect(Effect.runPromise(workspace.openDirectoryFx("missing"))).rejects.toThrow("Open Arkini editor directory");
	});
});
