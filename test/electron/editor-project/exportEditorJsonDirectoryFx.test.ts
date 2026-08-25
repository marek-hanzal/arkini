import * as NodeServices from "@effect/platform-node/NodeServices";
import type { BrowserWindow } from "electron";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	realpath,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportEditorJsonDirectoryFx } from "../../../electron/main/editor-project/exportEditorJsonDirectoryFx";
import { compileGameDirectoryFx } from "~/engine/compiler/fx/compileGameDirectoryFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createEditorProjectIpcRepository } from "./ipc/support/createEditorProjectIpcRepository";

const fileSystemFailure = vi.hoisted(() => ({
	previousCleanup: false,
}));

vi.mock("@effect/platform-node/NodeServices", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@effect/platform-node/NodeServices")>();
	const { Effect: EffectModule, FileSystem, Layer } = await import("effect");
	const fileSystemLayer = Layer.effect(
		FileSystem.FileSystem,
		EffectModule.map(FileSystem.FileSystem, (fileSystem) =>
			FileSystem.FileSystem.of({
				...fileSystem,
				remove: (path, options) =>
					fileSystemFailure.previousCleanup && path.endsWith(".previous")
						? fileSystem.remove(`${path}/missing`, {
								force: false,
							})
						: fileSystem.remove(path, options),
			}),
		),
	).pipe(Layer.provide(actual.layer));
	return {
		...actual,
		layer: Layer.merge(actual.layer, fileSystemLayer),
	};
});

const electron = vi.hoisted(() => {
	const paths = {
		app: "",
		home: "",
		userData: "",
	};
	return {
		getAppPath: vi.fn(() => paths.app),
		getPath: vi.fn((name: "home" | "userData") => paths[name]),
		paths,
		showMessageBox: vi.fn(),
		showOpenDialog: vi.fn(),
	};
});

vi.mock("electron", () => ({
	app: {
		getAppPath: electron.getAppPath,
		getPath: electron.getPath,
	},
	dialog: {
		showMessageBox: electron.showMessageBox,
		showOpenDialog: electron.showOpenDialog,
	},
}));

const window = {} as BrowserWindow;
const temporaryRoots: Array<string> = [];

const createTarget = async () => {
	const parent = await mkdtemp(join(tmpdir(), "arkini-source-export-"));
	temporaryRoots.push(parent);
	const target = join(parent, "managed");
	await mkdir(join(target, "stale"), {
		recursive: true,
	});
	await writeFile(join(target, "sentinel.txt"), "keep unless confirmed");
	await writeFile(join(target, "stale", "old.json"), "{}");
	return target;
};

beforeEach(async () => {
	fileSystemFailure.previousCleanup = false;
	electron.showMessageBox.mockReset();
	electron.showOpenDialog.mockReset();
	const protectedRoot = await mkdtemp(join(tmpdir(), "arkini-source-protected-"));
	temporaryRoots.push(protectedRoot);
	electron.paths.app = join(protectedRoot, "app");
	electron.paths.home = join(protectedRoot, "home");
	electron.paths.userData = join(protectedRoot, "user-data");
	await Promise.all(
		Object.values(electron.paths).map((path) =>
			mkdir(path, {
				recursive: true,
			}),
		),
	);
});

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) =>
			rm(root, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe("exportEditorJsonDirectoryFx", () => {
	it("replaces the managed tree with a schema-bound source bundle that compiles back", async () => {
		const target = await createTarget();
		const config = GameConfigSchema.parse({
			...editorTestPayload.config,
			items: {
				...editorTestPayload.config.items,
				"item:inventory": {
					uid: "inventory",
					id: "item:inventory",
					type: "inventory",
					title: "Backpack",
					description: "Opens the shared inventory.",
					asset: {
						default: [
							"item-inventory",
						],
					},
				},
			},
		});
		const resources = [
			...editorTestPayload.resources,
			{
				id: "item-inventory",
				mime: "image/png",
				bytes: new Uint8Array([
					5,
					6,
				]),
			},
		];
		const awaitIdle = vi.fn();
		const repository = {
			...createEditorProjectIpcRepository(),
			awaitIdleFx: Effect.sync(awaitIdle),
		};
		vi.mocked(repository.readProjectFx).mockReturnValue(
			Effect.succeed({
				projectId: "project:one",
				title: config.meta.title,
				version: editorTestPayload.version,
				createdAtMs: 1,
				updatedAtMs: 2,
				revision: 7,
				config,
				resources,
			}),
		);
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				target,
			],
		});
		electron.showMessageBox.mockResolvedValue({
			checkboxChecked: false,
			response: 1,
		});

		const result = await Effect.runPromise(
			exportEditorJsonDirectoryFx({
				projectId: "project:one",
				repository,
				window,
			}),
		);
		const canonicalTarget = await realpath(target);

		expect(result).toEqual({
			json: 4,
			projectDirectory: canonicalTarget,
			resources: 3,
			revision: 7,
			root: canonicalTarget,
		});
		expect(electron.showMessageBox).toHaveBeenCalledWith(
			window,
			expect.objectContaining({
				cancelId: 0,
				defaultId: 0,
				detail: expect.stringContaining("Every existing file and subfolder"),
			}),
		);
		expect(awaitIdle).toHaveBeenCalledOnce();
		expect(repository.readProjectFx).toHaveBeenCalledWith("project:one");
		await expect(access(join(target, "sentinel.txt"))).rejects.toThrow();
		await expect(access(join(target, "stale", "old.json"))).rejects.toThrow();

		const rootSource = JSON.parse(await readFile(join(target, "game.json"), "utf8"));
		const simpleSource = JSON.parse(
			await readFile(join(target, "simple", "water.json"), "utf8"),
		);
		const inventorySource = JSON.parse(
			await readFile(join(target, "inventory", "inventory.json"), "utf8"),
		);
		expect(rootSource.$schema).toBe("./schema.json");
		expect(simpleSource.$schema).toBe("../schema.json");
		expect(inventorySource.$schema).toBe("../schema.json");
		await expect(access(join(target, "schema.json"))).resolves.toBeUndefined();
		await expect(access(join(target, "project%3Aone"))).rejects.toThrow();
		await expect(access(join(target, "resources", "hero.png"))).resolves.toBeUndefined();
		await expect(access(join(target, "assets", "item-inventory.png"))).resolves.toBeUndefined();
		expect(await readFile(join(target, "resources", "hero.png"))).toEqual(
			Buffer.from(resources[0].bytes),
		);
		expect(await readFile(join(target, "assets", "item-water.png"))).toEqual(
			Buffer.from(resources[1].bytes),
		);
		expect(await readFile(join(target, "assets", "item-inventory.png"))).toEqual(
			Buffer.from(resources[2].bytes),
		);

		const compilation = await Effect.runPromise(
			compileGameDirectoryFx({
				input: target,
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		expect(compilation.diagnostics).toEqual([]);
		expect(compilation.config).toEqual({
			$schema: "./schema.json",
			...config,
		});
		expect(compilation.resources).toHaveLength(3);
	});

	it("does not touch the selected tree when destructive replacement is canceled", async () => {
		const target = await createTarget();
		const repository = createEditorProjectIpcRepository();
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				target,
			],
		});
		electron.showMessageBox.mockResolvedValue({
			checkboxChecked: false,
			response: 0,
		});

		await expect(
			Effect.runPromise(
				exportEditorJsonDirectoryFx({
					projectId: "project-one",
					repository,
					window,
				}),
			),
		).resolves.toBeNull();
		expect(repository.readProjectFx).not.toHaveBeenCalled();
		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe(
			"keep unless confirmed",
		);
		await expect(access(join(target, "stale", "old.json"))).resolves.toBeUndefined();
	});

	it("rejects a symlink into Arkini-owned data before asking for confirmation", async () => {
		const protectedTarget = join(electron.paths.userData, "arkini", "editor");
		await mkdir(protectedTarget, {
			recursive: true,
		});
		const linkRoot = await mkdtemp(join(tmpdir(), "arkini-source-link-"));
		temporaryRoots.push(linkRoot);
		const target = join(linkRoot, "managed");
		await symlink(protectedTarget, target, "dir");
		const repository = createEditorProjectIpcRepository();
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				target,
			],
		});

		await expect(
			Effect.runPromise(
				exportEditorJsonDirectoryFx({
					projectId: "project-one",
					repository,
					window,
				}),
			),
		).rejects.toThrow("outside the home root, application bundle");
		expect(electron.showMessageBox).not.toHaveBeenCalled();
		expect(repository.readProjectFx).not.toHaveBeenCalled();
	});

	it("keeps the previous tree when staging cannot produce a complete export", async () => {
		const target = await createTarget();
		const repository = createEditorProjectIpcRepository();
		vi.mocked(repository.readProjectFx).mockReturnValue(
			Effect.succeed({
				...editorTestPayload,
				projectId: "project-one",
				title: editorTestPayload.config.meta.title,
				createdAtMs: 1,
				updatedAtMs: 2,
				revision: 1,
				resources: [
					{
						...editorTestPayload.resources[1],
						id: "Item",
					},
					{
						...editorTestPayload.resources[1],
						id: "item",
					},
				],
			}),
		);
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				target,
			],
		});
		electron.showMessageBox.mockResolvedValue({
			checkboxChecked: false,
			response: 1,
		});

		await expect(
			Effect.runPromise(
				exportEditorJsonDirectoryFx({
					projectId: "project-one",
					repository,
					window,
				}),
			),
		).rejects.toThrow("collide on this filesystem");
		await expect(readFile(join(target, "sentinel.txt"), "utf8")).resolves.toBe(
			"keep unless confirmed",
		);
		await expect(readdir(join(target, ".."))).resolves.toEqual([
			"managed",
		]);
	});

	it("keeps a committed export successful when obsolete backup cleanup fails", async () => {
		const target = await createTarget();
		const repository = createEditorProjectIpcRepository();
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				target,
			],
		});
		electron.showMessageBox.mockResolvedValue({
			checkboxChecked: false,
			response: 1,
		});
		fileSystemFailure.previousCleanup = true;

		await expect(
			Effect.runPromise(
				exportEditorJsonDirectoryFx({
					projectId: "project-one",
					repository,
					window,
				}),
			),
		).resolves.toMatchObject({
			projectDirectory: await realpath(target),
			root: await realpath(target),
		});
		await expect(access(join(target, "game.json"))).resolves.toBeUndefined();
		await expect(access(join(target, "sentinel.txt"))).rejects.toThrow();
		expect(
			(await readdir(join(target, ".."))).filter((name) => name.endsWith(".previous")),
		).toHaveLength(1);
	});
});
