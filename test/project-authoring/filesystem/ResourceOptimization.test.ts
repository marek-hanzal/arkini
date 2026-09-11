import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-fs-resource-optimize-");
});

afterEach(async () => harness.close());

const createDirtyPng = () =>
	sharp(Uint8Array.of(200, 100, 50, 0, 20, 40, 60, 255), {
		raw: {
			channels: 4,
			height: 1,
			width: 2,
		},
	})
		.png({
			adaptiveFiltering: false,
			compressionLevel: 0,
			palette: false,
		})
		.toBuffer();

describe("filesystem Editor PNG optimization", () => {
	it("atomically rewrites both item assets and shell resources without resizing", async () => {
		const dirtyPng = await createDirtyPng();
		const repository = await harness.openRepository();
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: parseVersionFn(editorTestPayload.version),
				config: editorTestPayload.config,
				resources: editorTestPayload.resources.map((resource) => ({
					...resource,
					bytes: new Uint8Array(dirtyPng),
				})),
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		const progress: Array<{
			readonly completedResourceCount: number;
			readonly phase: "optimizing" | "saving";
			readonly totalResourceCount: number;
		}> = [];

		const result = await Effect.runPromise(
			repository.optimizeResourcesFx({
				expectedRevision: created.revision,
				onProgressFn: (value) => progress.push(value),
				projectId: created.projectId,
				resourceIds: [
					"hero",
					"item-water",
				],
			}),
		);

		expect(result.optimizedResourceCount).toBe(2);
		expect(result.processedResourceCount).toBe(2);
		expect(progress).toEqual([
			{
				completedResourceCount: 0,
				phase: "optimizing",
				totalResourceCount: 2,
			},
			{
				completedResourceCount: 1,
				phase: "optimizing",
				totalResourceCount: 2,
			},
			{
				completedResourceCount: 2,
				phase: "optimizing",
				totalResourceCount: 2,
			},
			{
				completedResourceCount: 2,
				phase: "saving",
				totalResourceCount: 2,
			},
		]);
		expect(result.optimizedBytes).toBeLessThan(result.originalBytes);
		expect(result.project.revision).toBeGreaterThan(created.revision);
		for (const [resourceId, source] of [
			[
				"hero",
				"resources/hero.png",
			],
			[
				"item-water",
				"assets/item-water.png",
			],
		] as const) {
			const bytes = await readFile(join(root, source));
			const metadata = await sharp(bytes).metadata();
			const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer();
			expect(metadata).toMatchObject({
				channels: 4,
				height: 1,
				width: 2,
			});
			expect(decoded).toEqual(Buffer.from(Uint8Array.of(0, 0, 0, 0, 20, 40, 60, 255)));
			expect(new Uint8Array(bytes)).toEqual(
				result.project.resources.find(({ id }) => id === resourceId)?.bytes,
			);
		}

		await expect(
			Effect.runPromise(
				repository.optimizeResourcesFx({
					expectedRevision: created.revision,
					projectId: created.projectId,
					resourceIds: [
						"hero",
						"item-water",
					],
				}),
			),
		).rejects.toThrow(
			`changed from revision ${created.revision} to ${result.project.revision}`,
		);
	});

	it("rewrites only the explicitly selected resource", async () => {
		const dirtyPng = await createDirtyPng();
		const repository = await harness.openRepository();
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: parseVersionFn(editorTestPayload.version),
				config: editorTestPayload.config,
				resources: editorTestPayload.resources.map((resource) => ({
					...resource,
					bytes: new Uint8Array(dirtyPng),
				})),
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");

		const result = await Effect.runPromise(
			repository.optimizeResourcesFx({
				expectedRevision: created.revision,
				projectId: created.projectId,
				resourceIds: [
					"item-water",
				],
			}),
		);

		expect(result).toMatchObject({
			optimizedResourceCount: 1,
			processedResourceCount: 1,
		});
		expect(new Uint8Array(await readFile(join(root, "resources/hero.png")))).toEqual(
			new Uint8Array(dirtyPng),
		);
		expect(
			await sharp(await readFile(join(root, "assets/item-water.png")))
				.ensureAlpha()
				.raw()
				.toBuffer(),
		).toEqual(Buffer.from(Uint8Array.of(0, 0, 0, 0, 20, 40, 60, 255)));
	});
});
