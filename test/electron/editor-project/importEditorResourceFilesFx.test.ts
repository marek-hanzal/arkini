import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorResourceFilesFx } from "~electron/main/editor-project/importEditorResourceFilesFx";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import {
	createEditorProjectIpcRepository,
	editorProjectIpcProject,
} from "./ipc/support/createEditorProjectIpcRepository";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-editor-artwork-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("importEditorResourceFilesFx", () => {
	it("imports canonical Ogg/Opus Music and SFX by native path without materializing their bodies", async () => {
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
			resourceIds: [
				"opening-theme",
			],
		});
		expect(repository.upsertResourceFilesFx).toHaveBeenCalledWith({
			projectId: "project-one",
			resources: [
				expect.objectContaining({
					id: "opening-theme",
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
			resourceIds: [
				"job-start",
			],
		});
		expect(repository.upsertResourceFilesFx).toHaveBeenLastCalledWith({
			projectId: "project-one",
			resources: [
				expect.objectContaining({
					id: "job-start",
					path: sfxPath,
					size: musicBytes.byteLength,
					type: "sfx",
				}),
			],
		});
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
			resourceIds: [
				"hero",
			],
		});
		expect(repository.upsertResourceFilesFx).toHaveBeenCalledWith({
			projectId: "project-one",
			resources: [
				expect.objectContaining({
					id: "hero",
					path: imagePath,
					type: "image",
				}),
			],
		});

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

	it("extracts an Arkpack to files that stay available through the repository write", async () => {
		const arkpackPath = join(root, "source.arkpack");
		await writeFile(arkpackPath, createTestArkpack());
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
							name: "source.arkpack",
							path: arkpackPath,
						},
					],
					projectId: "project-one",
					source: "arkpack",
					type: "artwork",
				},
			}),
		);

		expect(result.resourceIds).toEqual([
			"asset-water",
		]);
		expect(upsertResourceFilesFx).toHaveBeenCalledOnce();
		for (const path of extractedPaths) await expect(access(path)).rejects.toBeDefined();
	});
});
