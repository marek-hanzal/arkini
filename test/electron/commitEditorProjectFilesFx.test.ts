import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { commitEditorProjectFilesFx } from "../../electron/main/editor/internal/commitEditorProjectFilesFx";

let root = "";
let projectRoot = "";
let contentTarget = "";
let manifestTarget = "";

const encoder = new TextEncoder();

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-editor-commit-"));
	projectRoot = join(root, "project");
	contentTarget = join(projectRoot, "simple", "water.json");
	manifestTarget = join(projectRoot, "editor.json");
	await mkdir(join(projectRoot, "simple"), {
		recursive: true,
	});
	await writeFile(contentTarget, "old content", "utf8");
	await writeFile(manifestTarget, "old manifest", "utf8");
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

const readNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

const commit = (fileSystem: FileSystem.FileSystem) =>
	Effect.runPromise(
		commitEditorProjectFilesFx({
			fileSystem,
			content: {
				target: contentTarget,
				bytes: encoder.encode("new content"),
			},
			manifest: {
				target: manifestTarget,
				bytes: encoder.encode("new manifest"),
			},
		}),
	);

const readArtifacts = async () => [
	...(await readdir(projectRoot)),
	...(await readdir(join(projectRoot, "simple"))),
];

describe("commitEditorProjectFilesFx", () => {
	it("publishes content before the manifest and removes successful backups", async () => {
		const fileSystem = await readNodeFileSystem();
		const published: string[] = [];
		await commit({
			...fileSystem,
			rename: (oldPath, newPath) =>
				Effect.suspend(() => {
					if (newPath === contentTarget || newPath === manifestTarget)
						published.push(newPath);
					return fileSystem.rename(oldPath, newPath);
				}),
		});

		expect(published).toEqual([
			contentTarget,
			manifestTarget,
		]);
		await expect(readFile(contentTarget, "utf8")).resolves.toBe("new content");
		await expect(readFile(manifestTarget, "utf8")).resolves.toBe("new manifest");
		expect((await readArtifacts()).some((path) => path.includes(".backup"))).toBe(false);
	});

	it("restores both previous files when manifest publication fails", async () => {
		const fileSystem = await readNodeFileSystem();
		await expect(
			commit({
				...fileSystem,
				rename: (oldPath, newPath) =>
					Effect.suspend(() =>
						oldPath.endsWith(".manifest.pending") && newPath === manifestTarget
							? Effect.die(new Error("manifest publish failed"))
							: fileSystem.rename(oldPath, newPath),
					),
			}),
		).rejects.toThrow("Commit Arkini editor project files");

		await expect(readFile(contentTarget, "utf8")).resolves.toBe("old content");
		await expect(readFile(manifestTarget, "utf8")).resolves.toBe("old manifest");
		expect((await readArtifacts()).some((path) => path.includes(".backup"))).toBe(false);
		expect((await readArtifacts()).some((path) => path.includes(".pending"))).toBe(false);
	});

	it("restores the previous content when content publication fails", async () => {
		const fileSystem = await readNodeFileSystem();
		await expect(
			commit({
				...fileSystem,
				rename: (oldPath, newPath) =>
					Effect.suspend(() =>
						oldPath.endsWith(".pending") && newPath === contentTarget
							? Effect.die(new Error("content publish failed"))
							: fileSystem.rename(oldPath, newPath),
					),
			}),
		).rejects.toThrow("Commit Arkini editor project files");

		await expect(readFile(contentTarget, "utf8")).resolves.toBe("old content");
		await expect(readFile(manifestTarget, "utf8")).resolves.toBe("old manifest");
		expect((await readArtifacts()).some((path) => path.includes(".backup"))).toBe(false);
	});

	it("keeps the last recoverable backup when content restore fails", async () => {
		const fileSystem = await readNodeFileSystem();
		await expect(
			commit({
				...fileSystem,
				rename: (oldPath, newPath) =>
					Effect.suspend(() => {
						if (oldPath.endsWith(".manifest.pending") && newPath === manifestTarget) {
							return Effect.die(new Error("manifest publish failed"));
						}
						if (oldPath.endsWith(".backup") && newPath === contentTarget) {
							return Effect.die(new Error("content restore failed"));
						}
						return fileSystem.rename(oldPath, newPath);
					}),
			}),
		).rejects.toThrow("Commit Arkini editor project files");

		const backup = (await readdir(join(projectRoot, "simple"))).find((path) =>
			path.endsWith(".backup"),
		);
		expect(backup).toBeDefined();
		await expect(readFile(join(projectRoot, "simple", backup!), "utf8")).resolves.toBe(
			"old content",
		);
		await expect(readFile(contentTarget, "utf8")).resolves.toBe("new content");
		await expect(readFile(manifestTarget, "utf8")).resolves.toBe("old manifest");
	});
});
