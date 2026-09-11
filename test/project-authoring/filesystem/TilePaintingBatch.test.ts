import { Effect, FileSystem, PlatformError } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TilePaintingCanvasSize } from "~/tile-painting/constant/TilePaintingCanvasSize";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-painting-batch-");
});
afterEach(async () => harness.close());
const png = async (color: string) =>
	new Uint8Array(
		await sharp({
			create: {
				width: TilePaintingCanvasSize,
				height: TilePaintingCanvasSize,
				channels: 4,
				background: color,
			},
		})
			.png()
			.toBuffer(),
	);
const url = (bytes: Uint8Array) => `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
const document = (sourceResourceId: string): TilePaintingDocumentSchema.Type => ({
	name: "Ground",
	images: [
		{
			id: "image",
			label: "Ground source",
			sourceResourceId,
		},
	],
	layers: [
		{
			id: "ground",
			name: "Ground",
			imageId: "image",
			visible: true,
			opacity: 1,
			tileSize: 128,
			strokes: [],
		},
	],
	catalog: [],
	scatter: [],
	reference: null,
	preview: {
		columns: 1,
		rows: 1,
		cells: [
			{
				kind: "painting",
			},
		],
	},
});

describe("painting source rebuild transactions", () => {
	it("guards every freshness token, validates final source references, and atomically rebuilds dependent outputs", async () => {
		const repository = await harness.openRepository();
		let project = await harness.createProject(repository);
		const old = await png("#503020");
		const fresh = await png("#705040");
		project = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "dirt",
						mime: "image/png",
						bytes: old,
					},
				],
			}),
		);
		const first = await Effect.runPromise(
			repository.saveTilePaintingFx({
				projectId: project.projectId,
				paintingId: "first",
				expectedRevision: project.revision,
				expectedUpdatedAtMs: null,
				document: document("dirt"),
				outputResourceId: "ground-one",
				bakedPng: url(old),
			}),
		);
		const second = await Effect.runPromise(
			repository.saveTilePaintingFx({
				projectId: project.projectId,
				paintingId: "second",
				expectedRevision: first.project.revision,
				expectedUpdatedAtMs: null,
				document: document("ground-one"),
				outputResourceId: "ground-two",
				bakedPng: url(old),
			}),
		);
		project = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "dirt",
						mime: "image/png",
						bytes: fresh,
					},
				],
			}),
		);
		const paintings = [
			{
				paintingId: "second",
				expectedUpdatedAtMs: second.painting.updatedAtMs,
				document: document("ground-one"),
				bakedPng: url(fresh),
			},
			{
				paintingId: "first",
				expectedUpdatedAtMs: first.painting.updatedAtMs,
				document: document("dirt"),
				bakedPng: url(fresh),
			},
		];
		await expect(
			Effect.runPromise(
				repository.bakeTilePaintingsFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					paintings: [
						paintings[0],
						{
							...paintings[1],
							expectedUpdatedAtMs: 0,
						},
					],
				}),
			),
		).rejects.toThrow("changed after it was read");
		await expect(
			Effect.runPromise(
				repository.bakeTilePaintingsFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					paintings: [
						{
							...paintings[0],
							document: document("missing-source"),
						},
						paintings[1],
					],
				}),
			),
		).rejects.toThrow("must exist");
		expect(
			await Effect.runPromise(
				repository.readTilePaintingFx({
					projectId: project.projectId,
					paintingId: "first",
				}),
			),
		).toEqual(first.painting);
		expect(
			await Effect.runPromise(
				repository.readTilePaintingFx({
					projectId: project.projectId,
					paintingId: "second",
				}),
			),
		).toEqual(second.painting);
		const baked = await Effect.runPromise(
			repository.bakeTilePaintingsFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				paintings,
			}),
		);
		expect(baked.project.revision).toBeGreaterThan(project.revision);
		for (const id of [
			"ground-one",
			"ground-two",
		])
			expect(baked.project.resources.find((resource) => resource.id === id)?.bytes).toEqual(
				fresh,
			);
		for (const painting of baked.paintings)
			expect(painting.document.images[0]).not.toHaveProperty("png");
	});
	it("rolls back every recipe and output when a later batch publication fails", async () => {
		const nodeFs = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		let fail = false;
		const fs: FileSystem.FileSystem = {
			...nodeFs,
			rename: (from, to) => {
				if (fail && String(to).endsWith("assets/ground-two.png")) {
					fail = false;
					return Effect.fail(
						PlatformError.systemError({
							_tag: "Unknown",
							module: "FileSystem",
							method: "rename",
							description: "Injected batch publication failure",
						}),
					);
				}
				return nodeFs.rename(from, to);
			},
		};
		const repository = await harness.openRepository(fs);
		let project = await harness.createProject(repository);
		const old = await png("#503020");
		const fresh = await png("#705040");
		project = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "dirt",
						mime: "image/png",
						bytes: old,
					},
				],
			}),
		);
		const first = await Effect.runPromise(
			repository.saveTilePaintingFx({
				projectId: project.projectId,
				paintingId: "first",
				expectedRevision: project.revision,
				expectedUpdatedAtMs: null,
				document: document("dirt"),
				outputResourceId: "ground-one",
				bakedPng: url(old),
			}),
		);
		const second = await Effect.runPromise(
			repository.saveTilePaintingFx({
				projectId: project.projectId,
				paintingId: "second",
				expectedRevision: first.project.revision,
				expectedUpdatedAtMs: null,
				document: document("dirt"),
				outputResourceId: "ground-two",
				bakedPng: url(old),
			}),
		);
		project = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "dirt",
						mime: "image/png",
						bytes: fresh,
					},
				],
			}),
		);
		fail = true;
		await expect(
			Effect.runPromise(
				repository.bakeTilePaintingsFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					paintings: [
						first.painting,
						second.painting,
					].map((painting) => ({
						paintingId: painting.paintingId,
						expectedUpdatedAtMs: painting.updatedAtMs,
						document: document("dirt"),
						bakedPng: url(fresh),
					})),
				}),
			),
		).rejects.toThrow();
		const refreshed = await Effect.runPromise(repository.refreshProjectFx(project.projectId));
		expect(refreshed.revision).toBe(project.revision);
		for (const id of [
			"ground-one",
			"ground-two",
		])
			expect(refreshed.resources.find((resource) => resource.id === id)?.bytes).toEqual(old);
		for (const painting of [
			first.painting,
			second.painting,
		])
			expect(
				await Effect.runPromise(
					repository.readTilePaintingFx({
						projectId: project.projectId,
						paintingId: painting.paintingId,
					}),
				),
			).toEqual(painting);
	});
	it("renames producer outputs and dependent source references together and blocks source deletion", async () => {
		const repository = await harness.openRepository();
		let project = await harness.createProject(repository);
		const bytes = await png("#503020");
		project = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: project.projectId,
				resources: [
					{
						id: "dirt",
						mime: "image/png",
						bytes,
					},
				],
			}),
		);
		const first = await Effect.runPromise(
			repository.saveTilePaintingFx({
				projectId: project.projectId,
				paintingId: "first",
				expectedRevision: project.revision,
				expectedUpdatedAtMs: null,
				document: document("dirt"),
				outputResourceId: "ground-one",
				bakedPng: url(bytes),
			}),
		);
		const second = await Effect.runPromise(
			repository.saveTilePaintingFx({
				projectId: project.projectId,
				paintingId: "second",
				expectedRevision: first.project.revision,
				expectedUpdatedAtMs: null,
				document: document("ground-one"),
			}),
		);
		const renamed = await Effect.runPromise(
			repository.replaceResourceFx({
				projectId: project.projectId,
				expectedRevision: second.project.revision,
				currentId: "ground-one",
				config: second.project.config,
				resource: {
					id: "ground-renamed",
					mime: "image/png",
					bytes,
				},
			}),
		);
		const producer = await Effect.runPromise(
			repository.readTilePaintingFx({
				projectId: project.projectId,
				paintingId: "first",
			}),
		);
		const consumer = await Effect.runPromise(
			repository.readTilePaintingFx({
				projectId: project.projectId,
				paintingId: "second",
			}),
		);
		expect(producer?.outputResourceId).toBe("ground-renamed");
		expect(consumer?.document.images[0].sourceResourceId).toBe("ground-renamed");
		expect(consumer?.document.images[0]).not.toHaveProperty("png");
		expect(producer?.updatedAtMs).toBeGreaterThan(first.painting.updatedAtMs);
		expect(consumer?.updatedAtMs).toBeGreaterThan(second.painting.updatedAtMs);
		await expect(
			Effect.runPromise(
				repository.deleteResourceFx({
					projectId: project.projectId,
					expectedRevision: renamed.revision,
					resourceId: "ground-renamed",
				}),
			),
		).rejects.toThrow("saved painting source");
		await Effect.runPromise(repository.refreshProjectFx(project.projectId));
		expect(
			await Effect.runPromise(
				repository.readTilePaintingFx({
					projectId: project.projectId,
					paintingId: "first",
				}),
			),
		).toEqual(producer);
		expect(
			await Effect.runPromise(
				repository.readTilePaintingFx({
					projectId: project.projectId,
					paintingId: "second",
				}),
			),
		).toEqual(consumer);
		if (consumer === null) throw new Error("Consumer recipe missing.");
		const removedUse = await Effect.runPromise(
			repository.saveTilePaintingFx({
				projectId: project.projectId,
				paintingId: "second",
				expectedRevision: renamed.revision,
				expectedUpdatedAtMs: consumer.updatedAtMs,
				document: {
					...consumer.document,
					layers: [],
				},
			}),
		);
		expect(removedUse.painting.document.images).toHaveLength(1);
		const deleted = await Effect.runPromise(
			repository.deleteResourceFx({
				projectId: project.projectId,
				expectedRevision: renamed.revision,
				resourceId: "ground-renamed",
			}),
		);
		expect(deleted.resources.some((resource) => resource.id === "ground-renamed")).toBe(false);
	});
});
