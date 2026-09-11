import { TilePaintingCanvasSize } from "~/tile-painting/constant/TilePaintingCanvasSize";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, FileSystem, PlatformError } from "effect";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { createEditorJsonExportDirectoryFx } from "~electron/main/editor-project/createEditorJsonExportDirectoryFx";
import { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-painting-");
});
afterEach(async () => harness.close());
const blank = (): TilePaintingDocumentSchema.Type => ({
	name: "Road",
	images: [],
	layers: [],
	catalog: [],
	scatter: [],
	preview: {
		columns: 3,
		rows: 3,
		cells: Array.from(
			{
				length: 9,
			},
			() => ({
				kind: "painting" as const,
			}),
		),
	},
	reference: null,
});
const png = async () =>
	`data:image/png;base64,${(
		await sharp({
			create: {
				width: TilePaintingCanvasSize,
				height: TilePaintingCanvasSize,
				channels: 4,
				background: {
					r: 100,
					g: 60,
					b: 20,
					alpha: 1,
				},
			},
		})
			.png()
			.toBuffer()
	).toString("base64")}`;

describe("portable tile painting persistence", () => {
	it("rejects stale recipe writes and preserves embedded sources through portable export and reopen", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const image = await png();
		const document = {
			...blank(),
			images: [
				{
					id: "source",
					label: "Dirt",
					sourceResourceId: "item-water",
					png: image,
				},
			],
			layers: [
				{
					id: "dirt",
					name: "Dirt",
					imageId: "source",
					visible: true,
					opacity: 1,
					tileSize: 64,
					shadow: {
						enabled: true,
						color: "#31192b",
						opacity: 0.4,
						blur: 16,
						offsetX: -8,
						offsetY: 12,
					},
					strokes: [],
				},
			],
		};
		const request = {
			projectId: project.projectId,
			paintingId: "road",
			expectedRevision: project.revision,
			expectedUpdatedAtMs: null,
			document,
		};
		const first = await Effect.runPromise(repository.saveTilePaintingFx(request));
		const updated = await Effect.runPromise(
			repository.saveTilePaintingFx({
				...request,
				expectedUpdatedAtMs: first.painting.updatedAtMs,
				document: {
					...document,
					name: "Road updated",
				},
			}),
		);
		await expect(
			Effect.runPromise(
				repository.saveTilePaintingFx({
					...request,
					expectedUpdatedAtMs: first.painting.updatedAtMs,
				}),
			),
		).rejects.toThrow("changed after it was read");
		await expect(
			Effect.runPromise(
				repository.deleteTilePaintingFx({
					projectId: request.projectId,
					paintingId: request.paintingId,
					expectedRevision: project.revision,
					expectedUpdatedAtMs: first.painting.updatedAtMs,
				}),
			),
		).rejects.toThrow("changed before deletion");
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Missing project root.");
		const exported = await Effect.runPromise(
			createEditorJsonExportDirectoryFx({
				source: root,
				parent: harness.temporaryDirectory,
				directoryName: "painting-export",
			}).pipe(Effect.provide(NodeServices.layer)),
		);
		const portable = JSON.parse(
			await readFile(join(exported.root, "paintings", "road.json"), "utf8"),
		);
		expect(portable.document.images[0].png).toBe(image);
		expect(portable.document.layers).toEqual(document.layers);
		expect(portable).not.toHaveProperty("projectId");
		expect(portable).not.toHaveProperty("paintingId");
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		await Effect.runPromise(reopened.readProjectFx(project.projectId));
		expect(await Effect.runPromise(reopened.readTilePaintingFx(request))).toEqual(
			updated.painting,
		);
	});
	it("atomically bakes a recipe and asset, advances source revision, and refuses unrelated collisions", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const bakedPng = await png();
		const request = {
			projectId: project.projectId,
			paintingId: "road",
			expectedRevision: project.revision,
			expectedUpdatedAtMs: null,
			document: blank(),
			bakedPng,
			outputResourceId: "painted-road",
		};
		const saved = await Effect.runPromise(repository.saveTilePaintingFx(request));
		expect(saved.project.revision).toBeGreaterThan(project.revision);
		expect(
			saved.project.resources.find((resource) => resource.id === "painted-road")?.bytes,
		).toEqual(new Uint8Array(Buffer.from(bakedPng.split(",")[1], "base64")));
		await expect(
			Effect.runPromise(
				repository.saveTilePaintingFx({
					...request,
					paintingId: "another",
					expectedRevision: saved.project.revision,
				}),
			),
		).rejects.toThrow("another painting");
		expect(
			await Effect.runPromise(
				repository.readTilePaintingFx({
					...request,
					paintingId: "another",
				}),
			),
		).toBeNull();
		const next = await Effect.runPromise(
			repository.saveTilePaintingFx({
				...request,
				expectedRevision: saved.project.revision,
				expectedUpdatedAtMs: saved.painting.updatedAtMs,
			}),
		);
		await Effect.runPromise(
			repository.deleteTilePaintingFx({
				projectId: request.projectId,
				paintingId: request.paintingId,
				expectedRevision: next.project.revision,
				expectedUpdatedAtMs: next.painting.updatedAtMs,
			}),
		);
		expect(await Effect.runPromise(repository.readTilePaintingFx(request))).toBeNull();
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.resources.some(
				(resource) => resource.id === "painted-road",
			),
		).toBe(true);
	});
	it("rejects undecodable embedded sources before any recipe or output is written", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		await expect(
			Effect.runPromise(
				repository.saveTilePaintingFx({
					projectId: project.projectId,
					paintingId: "bad",
					expectedRevision: project.revision,
					expectedUpdatedAtMs: null,
					document: {
						...blank(),
						images: [
							{
								id: "bad",
								label: "Broken",
								sourceResourceId: "item-water",
								png: "data:image/png;base64,AAAA",
							},
						],
					},
				}),
			),
		).rejects.toThrow();
		expect(await Effect.runPromise(repository.listTilePaintingsFx(project.projectId))).toEqual(
			[],
		);
	});
	it("rolls back the recipe, asset and project revision when bake publication fails", async () => {
		const nodeFs = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		let rejectPublication = false;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFs,
			rename: (from, to) => {
				if (rejectPublication && String(to).endsWith("assets/painted-road.png")) {
					rejectPublication = false;
					return Effect.fail(
						PlatformError.systemError({
							_tag: "Unknown",
							module: "FileSystem",
							method: "rename",
							description: "Injected painting bake failure",
						}),
					);
				}
				return nodeFs.rename(from, to);
			},
		};
		const repository = await harness.openRepository(fileSystem);
		const project = await harness.createProject(repository);
		const request = {
			projectId: project.projectId,
			paintingId: "road",
			expectedRevision: project.revision,
			expectedUpdatedAtMs: null,
			document: blank(),
		};
		const saved = await Effect.runPromise(repository.saveTilePaintingFx(request));
		rejectPublication = true;
		await expect(
			Effect.runPromise(
				repository.saveTilePaintingFx({
					...request,
					expectedUpdatedAtMs: saved.painting.updatedAtMs,
					document: {
						...blank(),
						name: "Must roll back",
					},
					outputResourceId: "painted-road",
					bakedPng: await png(),
				}),
			),
		).rejects.toThrow();
		expect(await Effect.runPromise(repository.readTilePaintingFx(request))).toEqual(
			saved.painting,
		);
		const refreshed = await Effect.runPromise(repository.refreshProjectFx(project.projectId));
		expect(refreshed?.revision).toBe(project.revision);
		expect(refreshed?.resources.some((resource) => resource.id === "painted-road")).toBe(false);
		expect(await Effect.runPromise(repository.readTilePaintingFx(request))).toEqual(
			saved.painting,
		);
	});
});
