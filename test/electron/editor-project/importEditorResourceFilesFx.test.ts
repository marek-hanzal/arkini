import { access, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorResourceFilesFx } from "~electron/main/editor-project/importEditorResourceFilesFx";
import { createTestSerapack } from "~test/serapack-support/fx/createTestSerapack";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import {
	createEditorProjectIpcRepository,
	editorProjectIpcProject,
} from "./ipc/support/createEditorProjectIpcRepository";

const optimizeOggOpusResourceFileFxMock = vi.hoisted(() => vi.fn());

vi.mock("~/game-config-resource/fx/optimizeOggOpusResourceFileFx", () => ({
	optimizeOggOpusResourceFileFx: optimizeOggOpusResourceFileFxMock.mockImplementation(
		(source: string) =>
			Effect.promise(async () => {
				const size = Number((await stat(source)).size);
				return {
					changed: false,
					originalBytes: size,
					optimizedBytes: size,
					path: source,
				};
			}),
	),
}));

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "serakki-editor-artwork-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("importEditorResourceFilesFx", () => {
	it("checks canonical Ogg/Opus Music and SFX for silent edges without materializing their bodies", async () => {
		const musicPath = join(root, "Opening Theme.ogg");
		const musicBytes = createTestOggOpusBytesFn();
		await writeFile(musicPath, musicBytes);
		const repository = createEditorProjectIpcRepository();

		await expect(
			Effect.runPromise(
				importEditorResourceFilesFx({
					repository,
					request: {
						files: [
							{
								name: "Opening Theme.ogg",
								path: musicPath,
							},
						],
						projectId: "project-one",
						source: "files",
						type: "music",
					},
				}),
			),
		).resolves.toMatchObject({
			resourceUids: [
				expect.any(String),
			],
		});
		expect(repository.upsertResourceFilesFx).toHaveBeenCalledWith({
			projectId: "project-one",
			resources: [
				expect.objectContaining({
					uid: expect.any(String),
					title: "Opening Theme",
					path: musicPath,
					size: musicBytes.byteLength,
					type: "music",
				}),
			],
		});

		const sfxPath = join(root, "Job Start.ogg");
		await writeFile(sfxPath, musicBytes);
		await expect(
			Effect.runPromise(
				importEditorResourceFilesFx({
					repository,
					request: {
						files: [
							{
								name: "Job Start.ogg",
								path: sfxPath,
							},
						],
						projectId: "project-one",
						source: "files",
						type: "sfx",
					},
				}),
			),
		).resolves.toMatchObject({
			resourceUids: [
				expect.any(String),
			],
		});
		expect(repository.upsertResourceFilesFx).toHaveBeenLastCalledWith({
			projectId: "project-one",
			resources: [
				expect.objectContaining({
					uid: expect.any(String),
					title: "Job Start",
					path: sfxPath,
					size: musicBytes.byteLength,
					type: "sfx",
				}),
			],
		});
		await Effect.runPromise(
			importEditorResourceFilesFx({
				repository,
				request: {
					files: [
						{
							name: "Opening Theme.ogg",
							path: musicPath,
						},
					],
					projectId: "project-one",
					source: "files",
					type: "music",
				},
			}),
		);
		expect(optimizeOggOpusResourceFileFxMock).toHaveBeenCalledTimes(3);
		const importedIds = vi
			.mocked(repository.upsertResourceFilesFx)
			.mock.calls.map(([request]) => request.resources[0]?.uid);
		expect(new Set(importedIds).size).toBe(3);
		expect(importedIds).not.toContain("opening-theme");
		expect(importedIds).not.toContain("job-start");
	});

	it("accepts a non-square Image by native path while Artwork keeps its square contract", async () => {
		const imagePath = join(root, "hero.png");
		await sharp({
			create: {
				width: 3,
				height: 2,
				channels: 4,
				background: {
					r: 255,
					g: 0,
					b: 255,
					alpha: 1,
				},
			},
		})
			.png()
			.toFile(imagePath);
		const repository = createEditorProjectIpcRepository();

		await expect(
			Effect.runPromise(
				importEditorResourceFilesFx({
					repository,
					request: {
						files: [
							{
								name: "Hero.png",
								path: imagePath,
							},
						],
						projectId: "project-one",
						source: "files",
						type: "image",
					},
				}),
			),
		).resolves.toMatchObject({
			resourceUids: [
				expect.any(String),
			],
		});
		expect(repository.upsertResourceFilesFx).toHaveBeenCalledWith({
			projectId: "project-one",
			resources: [
				expect.objectContaining({
					uid: expect.any(String),
					path: imagePath,
					type: "image",
				}),
			],
		});

		await Effect.runPromise(
			importEditorResourceFilesFx({
				repository,
				request: {
					projectId: "project-one",
					source: "files",
					type: "image",
					files: [
						{
							name: "Hero.png",
							path: imagePath,
						},
					],
				},
			}),
		);
		const imported = vi
			.mocked(repository.upsertResourceFilesFx)
			.mock.calls.map(([request]) => request.resources[0]!);
		expect(new Set(imported.map(({ uid }) => uid)).size).toBe(2);
		expect(imported.map(({ title }) => title)).toEqual([
			"Hero",
			"Hero",
		]);

		await expect(
			Effect.runPromise(
				importEditorResourceFilesFx({
					repository,
					request: {
						files: [
							{
								name: "Hero.png",
								path: imagePath,
							},
						],
						projectId: "project-one",
						source: "files",
						type: "artwork",
					},
				}),
			),
		).rejects.toMatchObject({
			message: expect.stringContaining("square PNG"),
		});
	});

	it("extracts an Serapack to files that stay available through the repository write", async () => {
		const serapackPath = join(root, "source.serapack");
		await writeFile(serapackPath, createTestSerapack());
		let extractedPaths: ReadonlyArray<string> = [];
		const base = createEditorProjectIpcRepository();
		const upsertResourceFilesFx = vi.fn<OwnedEditorProjectRepository["upsertResourceFilesFx"]>(
			(props) =>
				Effect.promise(async () => {
					extractedPaths = props.resources.map(({ path }) => path);
					await Promise.all(extractedPaths.map((path) => access(path)));
					return editorProjectIpcProject;
				}),
		);
		const repository = {
			...base,
			upsertResourceFilesFx,
		};

		const result = await Effect.runPromise(
			importEditorResourceFilesFx({
				repository,
				request: {
					files: [
						{
							name: "source.serapack",
							path: serapackPath,
						},
					],
					projectId: "project-one",
					source: "serapack",
					type: "artwork",
				},
			}),
		);

		expect(result.resourceUids).toEqual([
			"asset-water",
		]);
		expect(upsertResourceFilesFx).toHaveBeenCalledOnce();
		for (const path of extractedPaths) await expect(access(path)).rejects.toBeDefined();
	});
});
