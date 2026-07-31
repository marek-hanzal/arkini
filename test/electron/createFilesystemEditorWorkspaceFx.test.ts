import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
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

const createManifestFile = (projectId: string, updatedAtMs = 100) => ({
	path: "editor.json",
	bytes: new TextEncoder().encode(
		`${JSON.stringify(
			{
				projectId,
				title: projectId,
				createdAtMs: 100,
				updatedAtMs,
			},
			null,
			"\t",
		)}\n`,
	),
});

describe("createFilesystemEditorWorkspaceFx", () => {
	it("serializes concurrent mutations through one project-wide revision lane", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "concurrent-project",
				files: [
					createManifestFile("concurrent-project"),
				],
			}),
		);
		const snapshot = await Effect.runPromise(workspace.readFx("concurrent-project"));
		if (snapshot?.revision === undefined) throw new Error("Missing project revision.");
		const write = (path: string) =>
			Effect.runPromise(
				workspace.writeFx({
					projectId: "concurrent-project",
					expectedRevision: snapshot.revision!,
					mode: "create",
					file: {
						path,
						bytes: new TextEncoder().encode(path),
					},
				}),
			);
		const results = await Promise.allSettled([
			write("simple/first.json"),
			write("simple/second.json"),
		]);
		expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
		expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
		const current = await Effect.runPromise(workspace.readFx("concurrent-project"));
		expect(
			current?.files.filter(({ path }) => path.startsWith("simple/")).map(({ path }) => path),
		).toHaveLength(1);
	});

	it("guards project writes with revision and exact create or replace intent", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "write-project",
				files: [
					createManifestFile("write-project"),
					{
						path: "simple/water.json",
						bytes: new TextEncoder().encode("old"),
					},
				],
			}),
		);
		const snapshot = await Effect.runPromise(workspace.readFx("write-project"));
		expect(snapshot?.revision).toMatch(/^[a-f0-9]{64}$/);
		if (snapshot?.revision === undefined) throw new Error("Missing project revision.");

		await expect(
			Effect.runPromise(
				workspace.writeFx({
					projectId: "write-project",
					expectedRevision: snapshot.revision,
					mode: "create",
					file: {
						path: "SIMPLE/water.json",
						bytes: new TextEncoder().encode("collision"),
					},
				}),
			),
		).rejects.toMatchObject({
			cause: expect.objectContaining({
				message: expect.stringContaining("already exists"),
			}),
		});
		await expect(
			Effect.runPromise(
				workspace.writeFx({
					projectId: "write-project",
					expectedRevision: snapshot.revision,
					mode: "replace",
					file: createManifestFile("write-project", 200),
				}),
			),
		).rejects.toMatchObject({
			cause: expect.objectContaining({
				message: expect.stringContaining("owned by the canonical project writer"),
			}),
		});
		await expect(
			Effect.runPromise(
				workspace.writeFx({
					projectId: "write-project",
					expectedRevision: "0".repeat(64),
					mode: "replace",
					file: {
						path: "simple/water.json",
						bytes: new TextEncoder().encode("stale"),
					},
				}),
			),
		).rejects.toMatchObject({
			cause: expect.objectContaining({
				message: expect.stringContaining("changed after this mutation was validated"),
			}),
		});
		await expect(
			readFile(join(root, "write-project", "simple", "water.json"), "utf8"),
		).resolves.toBe("old");

		const written = await Effect.runPromise(
			workspace.writeFx({
				projectId: "write-project",
				expectedRevision: snapshot.revision,
				mode: "replace",
				file: {
					path: "simple/water.json",
					bytes: new TextEncoder().encode("new"),
				},
			}),
		);
		expect(written.revision).not.toBe(snapshot.revision);
		await expect(
			readFile(join(root, "write-project", "simple", "water.json"), "utf8"),
		).resolves.toBe("new");
		const manifest = JSON.parse(
			new TextDecoder().decode(
				written.files.find(({ path }) => path === "editor.json")?.bytes,
			),
		) as { readonly updatedAtMs: number };
		expect(manifest.updatedAtMs).toBeGreaterThan(100);
		await expect(Effect.runPromise(workspace.listFx())).resolves.toEqual([
			expect.objectContaining({
				projectId: "write-project",
				updatedAtMs: manifest.updatedAtMs,
			}),
		]);
	});

	it("atomically creates, reads, and opens contained editor projects", async () => {
		const workspace = await createWorkspace();
		const record = {
			projectId: "arkini-test",
			files: [
				createManifestFile("arkini-test"),
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
					bytes: new Uint8Array([
						1,
						2,
						3,
					]),
				},
			],
		};

		await Effect.runPromise(workspace.createFx(record));
		await expect(Effect.runPromise(workspace.readFx(record.projectId))).resolves.toEqual({
			projectId: record.projectId,
			revision: expect.stringMatching(/^[a-f0-9]{64}$/),
			files: [
				...record.files,
			].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)),
		});
		await expect(Effect.runPromise(workspace.readFx("missing"))).resolves.toBeNull();
		await expect(Effect.runPromise(workspace.listFx())).resolves.toEqual([
			{
				projectId: "arkini-test",
				title: "arkini-test",
				createdAtMs: 100,
				updatedAtMs: 100,
			},
		]);
		await expect(Effect.runPromise(workspace.createFx(record))).rejects.toThrow(
			"Create Arkini editor project",
		);

		await Effect.runPromise(workspace.openDirectoryFx());
		await Effect.runPromise(workspace.openDirectoryFx(record.projectId));
		expect(electron.openPath).toHaveBeenNthCalledWith(1, root);
		expect(electron.openPath).toHaveBeenNthCalledWith(
			2,
			await realpath(join(root, record.projectId)),
		);
	});

	it("moves a successfully saved project to the front of recent projects", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "saved-project",
				files: [
					createManifestFile("saved-project", 100),
				],
			}),
		);
		await Effect.runPromise(
			workspace.createFx({
				projectId: "previously-newer-project",
				files: [
					createManifestFile("previously-newer-project", 200),
				],
			}),
		);
		const snapshot = await Effect.runPromise(workspace.readFx("saved-project"));
		if (snapshot === null) throw new Error("Missing project revision.");

		const written = await Effect.runPromise(
			workspace.writeFx({
				projectId: "saved-project",
				expectedRevision: snapshot.revision,
				mode: "create",
				file: {
					path: "simple/water.json",
					bytes: new TextEncoder().encode("{}"),
				},
			}),
		);
		const manifest = JSON.parse(
			new TextDecoder().decode(
				written.files.find(({ path }) => path === "editor.json")?.bytes,
			),
		) as { readonly updatedAtMs: number };

		await expect(Effect.runPromise(workspace.listFx())).resolves.toEqual([
			expect.objectContaining({
				projectId: "saved-project",
				updatedAtMs: manifest.updatedAtMs,
			}),
			expect.objectContaining({
				projectId: "previously-newer-project",
				updatedAtMs: 200,
			}),
		]);
	});

	it("lists only valid manifest projects in descending modification order", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "older-project",
				files: [
					createManifestFile("older-project", 100),
				],
			}),
		);
		await Effect.runPromise(
			workspace.createFx({
				projectId: "newer-project",
				files: [
					createManifestFile("newer-project", 200),
				],
			}),
		);
		await mkdir(join(root, "missing-manifest"));
		await mkdir(join(root, "broken-manifest"));
		await writeFile(join(root, "broken-manifest", "editor.json"), "not json", "utf8");

		await expect(Effect.runPromise(workspace.readFx("newer-project"))).resolves.toEqual({
			projectId: "newer-project",
			revision: expect.stringMatching(/^[a-f0-9]{64}$/),
			files: [
				createManifestFile("newer-project", 200),
			],
		});
		await expect(Effect.runPromise(workspace.listFx())).resolves.toEqual([
			{
				projectId: "newer-project",
				title: "newer-project",
				createdAtMs: 100,
				updatedAtMs: 200,
			},
			{
				projectId: "older-project",
				title: "older-project",
				createdAtMs: 100,
				updatedAtMs: 100,
			},
		]);
	});

	it("rejects project identities that differ only by filesystem case", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "CaseProject",
				files: [
					createManifestFile("CaseProject"),
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
						createManifestFile("caseproject"),
						{
							path: "game.json",
							bytes: new TextEncoder().encode("{}\n"),
						},
					],
				}),
			),
		).rejects.toThrow("Create Arkini editor project");
	});

	it("rejects project directories that alias another location", async () => {
		const workspace = await createWorkspace();
		const external = join(root, "..", `${basename(root)}-external-project`);
		await mkdir(external);
		await symlink(external, join(root, "aliased-project"));
		try {
			await expect(Effect.runPromise(workspace.readFx("aliased-project"))).rejects.toThrow(
				"Read Arkini editor project",
			);
			await expect(
				Effect.runPromise(workspace.openDirectoryFx("aliased-project")),
			).rejects.toThrow("Open Arkini editor directory");
		} finally {
			await rm(external, {
				recursive: true,
				force: true,
			});
		}
	});

	it("rejects project files that alias another contained file", async () => {
		const workspace = await createWorkspace();
		await Effect.runPromise(
			workspace.createFx({
				projectId: "internal-symlink-project",
				files: [
					createManifestFile("internal-symlink-project"),
					{
						path: "game.json",
						bytes: new TextEncoder().encode("{}\n"),
					},
				],
			}),
		);
		await symlink("game.json", join(root, "internal-symlink-project", "alias.json"));

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
					createManifestFile("symlink-project"),
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
			await expect(Effect.runPromise(workspace.readFx("symlink-project"))).rejects.toThrow(
				"Read Arkini editor project",
			);
		} finally {
			await rm(external, {
				force: true,
			});
		}
	});

	it("rejects a project identity occupied by a regular file", async () => {
		const workspace = await createWorkspace();
		await writeFile(join(root, "not-a-project"), "nope", "utf8");

		await expect(Effect.runPromise(workspace.readFx("not-a-project"))).rejects.toThrow(
			"Read Arkini editor project",
		);
		await expect(Effect.runPromise(workspace.openDirectoryFx("not-a-project"))).rejects.toThrow(
			"Open Arkini editor directory",
		);
	});

	it("requires editor.json to match the workspace identity", async () => {
		const workspace = await createWorkspace();
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "missing-manifest",
					files: [
						{
							path: "game.json",
							bytes: new TextEncoder().encode("{}\n"),
						},
					],
				}),
			),
		).rejects.toThrow("Create Arkini editor project");
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "expected-project",
					files: [
						createManifestFile("different-project"),
					],
				}),
			),
		).rejects.toThrow("Create Arkini editor project");
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
		).rejects.toThrow("Create Arkini editor project");
		await expect(
			Effect.runPromise(
				workspace.createFx({
					projectId: "escape",
					files: [
						createManifestFile("escape"),
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
						createManifestFile("duplicate"),
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
						createManifestFile("case-collision"),
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
		).rejects.toThrow("Create Arkini editor project");
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
						createManifestFile("reserved-file"),
						{
							path: "assets/CON.png",
							bytes: new Uint8Array(),
						},
					],
				}),
			),
		).rejects.toThrow("Invalid Arkini editor project file path");
		await expect(Effect.runPromise(workspace.openDirectoryFx("missing"))).rejects.toThrow(
			"Open Arkini editor directory",
		);
	});
});
