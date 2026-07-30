import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
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
		await expect(Effect.runPromise(workspace.readFx(record.projectId))).resolves.toEqual({
			projectId: record.projectId,
			files: [...record.files].sort((left, right) =>
				left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
			),
		});
		await expect(Effect.runPromise(workspace.readFx("missing"))).resolves.toBeNull();
		await expect(Effect.runPromise(workspace.createFx(record))).rejects.toThrow("Create Arkini editor project");

		await Effect.runPromise(workspace.openDirectoryFx());
		await Effect.runPromise(workspace.openDirectoryFx(record.projectId));
		expect(electron.openPath).toHaveBeenNthCalledWith(1, root);
		expect(electron.openPath).toHaveBeenNthCalledWith(2, join(root, record.projectId));
	});

	it("rejects project identities that differ only by filesystem case", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "CaseProject",
				files: [
					{
						path: "game.json",
						bytes: new TextEncoder().encode("{}\n"),
					},
				],
			}),
		);

		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "caseproject",
					files: [
						{
							path: "game.json",
							bytes: new TextEncoder().encode("{}\n"),
						},
					],
				}),
			),
		).rejects.toThrow("Editor project CaseProject already exists");
	});

	it("rejects project directories that alias another location", async () => {
		const workspace = await createWorkspace();
		const external = join(root, "..", `${basename(root)}-external-project`);
		await mkdir(external);
		await symlink(external, join(root, "aliased-project"));
		try {
			await expect(
				Effect.runPromise(workspace.readFx("aliased-project")),
			).rejects.toThrow("Read Arkini editor project");
			await expect(
				Effect.runPromise(workspace.openDirectoryFx("aliased-project")),
			).rejects.toThrow("Open Arkini editor directory");
		} finally {
			await rm(external, { recursive: true, force: true });
		}
	});

	it("rejects project files that alias another contained file", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "internal-symlink-project",
				files: [
					{
						path: "game.json",
						bytes: new TextEncoder().encode("{}\n"),
					},
				],
			}),
		);
		await symlink(
			"game.json",
			join(root, "internal-symlink-project", "alias.json"),
		);

		await expect(
			Effect.runPromise(workspace.readFx("internal-symlink-project")),
		).rejects.toThrow("Read Arkini editor project");
	});

	it("rejects project files whose symbolic-link target escapes the workspace", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "symlink-project",
				files: [
					{
						path: "game.json",
						bytes: new TextEncoder().encode("{}\n"),
					},
				],
			}),
		);
		const external = join(root, "..", `${basename(root)}-external.json`);
		await writeFile(external, "{}\n");
		await symlink(external, join(root, "symlink-project", "external.json"));
		try {
			await expect(
				Effect.runPromise(workspace.readFx("symlink-project")),
			).rejects.toThrow("Read Arkini editor project");
		} finally {
			await rm(external, { force: true });
		}
	});

	it("rejects a project identity occupied by a regular file", async () => {
		const workspace = await createWorkspace();
		await writeFile(join(root, "not-a-project"), "nope", "utf8");

		await expect(Effect.runPromise(workspace.readFx("not-a-project"))).rejects.toThrow(
			"Read Arkini editor project",
		);
		await expect(
			Effect.runPromise(workspace.openDirectoryFx("not-a-project")),
		).rejects.toThrow("Open Arkini editor directory");
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
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "case-collision",
					files: [
						{
							path: "simple/Item.json",
							bytes: new Uint8Array(),
						},
						{
							path: "simple/item.json",
							bytes: new Uint8Array(),
						},
					],
				}),
			),
		).rejects.toThrow("Create Arkini editor project");
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "CON",
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
					projectId: "trailing-dot.",
					files: [
						{
							path: "game.json",
							bytes: new Uint8Array(),
						},
					],
				}),
			),
		).rejects.toThrow("Create Arkini editor project");
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "reserved-file",
					files: [
						{
							path: "assets/CON.png",
							bytes: new Uint8Array(),
						},
					],
				}),
			),
		).rejects.toThrow("Invalid Arkini editor project file path");
		await expect(
			Effect.runPromise(workspace.openDirectoryFx("missing")),
		).rejects.toThrow("Open Arkini editor directory");
	});
});
