import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { saveEditorAssetsFx } from "~/bridge/resource/editor/saveEditorAssetsFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const createPng = () =>
	Uint8Array.from(
		Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
			"base64",
		),
	);
const createProject = (revision = 0): EditorProject => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	game: editorTestPayload.config.version,
	createdAtMs: 1,
	updatedAtMs: revision + 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});
const bitmapClose = vi.fn();
const registries: AtomRegistry.AtomRegistry[] = [];

const createFixture = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	const upsertResourcesFx = vi.fn<EditorProjectRepositoryService["upsertResourcesFx"]>(
		({ resources }) =>
			Effect.succeed({
				...createProject(1),
				resources: [
					...editorTestPayload.resources,
					...resources,
				],
			}),
	);
	const repository: EditorProjectRepositoryService = {
		awaitIdleFx: Effect.void,
		createProjectFx: () => Effect.die("Unexpected create."),
		listProjectsFx: Effect.die("Unexpected list."),
		readProjectFx: () => Effect.die("Unexpected read."),
		upsertItemFx: () => Effect.die("Unexpected item save."),
		upsertResourcesFx,
	};
	return {
		registry,
		repository,
		upsertResourcesFx,
	};
};

beforeEach(() => {
	bitmapClose.mockReset();
	vi.stubGlobal(
		"createImageBitmap",
		vi.fn(async () => ({
			width: 1,
			height: 1,
			close: bitmapClose,
		})),
	);
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	vi.unstubAllGlobals();
});

describe("saveEditorAssetsFx", () => {
	it("validates, atomically commits and publishes one PNG batch", async () => {
		const fixture = createFixture();
		const png = createPng();
		const saved = await Effect.runPromise(
			saveEditorAssetsFx({
				projectId: "project",
				files: [
					{
						name: "New Asset.png",
						size: png.byteLength,
						arrayBuffer: async () => png.buffer,
					},
					{
						name: "Other Asset.png",
						size: png.byteLength,
						arrayBuffer: async () => png.buffer,
					},
				],
			}).pipe(
				Effect.provideService(EditorProjectRepository, fixture.repository),
				Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
			),
		);

		expect(saved.resourceIds).toEqual([
			"new-asset",
			"other-asset",
		]);
		expect(fixture.upsertResourcesFx).toHaveBeenCalledWith({
			projectId: "project",
			resources: [
				{
					id: "new-asset",
					mime: "image/png",
					bytes: png,
				},
				{
					id: "other-asset",
					mime: "image/png",
					bytes: png,
				},
			],
		});
		expect(fixture.registry.get(EditorProjectAtom("project"))?.revision).toBe(1);
		expect(bitmapClose).toHaveBeenCalledTimes(2);
	});

	it("rejects bytes that only claim a PNG filename before repository admission", async () => {
		const fixture = createFixture();
		vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("decode failed"));
		const fakePng = new Uint8Array(24);
		fakePng.set([
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10,
		]);

		await expect(
			Effect.runPromise(
				saveEditorAssetsFx({
					projectId: "project",
					files: [
						{
							name: "fake.png",
							size: fakePng.byteLength,
							arrayBuffer: async () => fakePng.buffer,
						},
					],
				}).pipe(
					Effect.provideService(EditorProjectRepository, fixture.repository),
					Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
				),
			),
		).rejects.toThrow("must decode as a valid PNG image");
		expect(fixture.upsertResourcesFx).not.toHaveBeenCalled();
	});

	it("rejects colliding generated IDs before the atomic repository transaction", async () => {
		const fixture = createFixture();
		const png = createPng();

		await expect(
			Effect.runPromise(
				saveEditorAssetsFx({
					projectId: "project",
					files: [
						{
							name: "Same Asset.png",
							size: png.byteLength,
							arrayBuffer: async () => png.buffer,
						},
						{
							name: "same asset.PNG",
							size: png.byteLength,
							arrayBuffer: async () => png.buffer,
						},
					],
				}).pipe(
					Effect.provideService(EditorProjectRepository, fixture.repository),
					Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
				),
			),
		).rejects.toThrow("occurs more than once in the selected batch");
		expect(fixture.upsertResourcesFx).not.toHaveBeenCalled();
		expect(bitmapClose).toHaveBeenCalledTimes(2);
	});

	it("releases the decoded bitmap when dimension validation fails", async () => {
		const fixture = createFixture();
		vi.mocked(createImageBitmap).mockResolvedValueOnce({
			width: 9000,
			height: 1,
			close: bitmapClose,
		} as unknown as ImageBitmap);
		const png = createPng();

		await expect(
			Effect.runPromise(
				saveEditorAssetsFx({
					projectId: "project",
					files: [
						{
							name: "oversized.png",
							size: png.byteLength,
							arrayBuffer: async () => png.buffer,
						},
					],
				}).pipe(
					Effect.provideService(EditorProjectRepository, fixture.repository),
					Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
				),
			),
		).rejects.toThrow("exceeds the supported PNG dimensions");
		expect(bitmapClose).toHaveBeenCalledOnce();
		expect(fixture.upsertResourcesFx).not.toHaveBeenCalled();
	});
});
