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
import { saveEditorAssetFx } from "~/bridge/resource/editor/saveEditorAssetFx";
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
	const upsertResourceFx = vi.fn<EditorProjectRepositoryService["upsertResourceFx"]>(
		({ resource }) =>
			Effect.succeed({
				...createProject(1),
				resources: [
					...editorTestPayload.resources,
					resource,
				],
			}),
	);
	const repository: EditorProjectRepositoryService = {
		awaitIdleFx: Effect.void,
		createProjectFx: () => Effect.die("Unexpected create."),
		listProjectsFx: Effect.die("Unexpected list."),
		readProjectFx: () => Effect.die("Unexpected read."),
		upsertItemFx: () => Effect.die("Unexpected item save."),
		upsertResourceFx,
	};
	return {
		registry,
		repository,
		upsertResourceFx,
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

describe("saveEditorAssetFx", () => {
	it("validates, commits and publishes one PNG resource", async () => {
		const fixture = createFixture();
		const png = createPng();
		const saved = await Effect.runPromise(
			saveEditorAssetFx({
				projectId: "project",
				file: {
					name: "New Asset.png",
					size: png.byteLength,
					arrayBuffer: async () => png.buffer,
				},
			}).pipe(
				Effect.provideService(EditorProjectRepository, fixture.repository),
				Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
			),
		);

		expect(saved.resourceId).toBe("new-asset");
		expect(fixture.upsertResourceFx).toHaveBeenCalledWith({
			projectId: "project",
			resource: {
				id: "new-asset",
				mime: "image/png",
				bytes: png,
			},
		});
		expect(fixture.registry.get(EditorProjectAtom("project"))?.revision).toBe(1);
		expect(bitmapClose).toHaveBeenCalledOnce();
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
				saveEditorAssetFx({
					projectId: "project",
					file: {
						name: "fake.png",
						size: fakePng.byteLength,
						arrayBuffer: async () => fakePng.buffer,
					},
				}).pipe(
					Effect.provideService(EditorProjectRepository, fixture.repository),
					Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
				),
			),
		).rejects.toThrow("must decode as a valid PNG image");
		expect(fixture.upsertResourceFx).not.toHaveBeenCalled();
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
				saveEditorAssetFx({
					projectId: "project",
					file: {
						name: "oversized.png",
						size: png.byteLength,
						arrayBuffer: async () => png.buffer,
					},
				}).pipe(
					Effect.provideService(EditorProjectRepository, fixture.repository),
					Effect.provideService(AtomRegistry.AtomRegistry, fixture.registry),
				),
			),
		).rejects.toThrow("exceeds the supported PNG dimensions");
		expect(bitmapClose).toHaveBeenCalledOnce();
		expect(fixture.upsertResourceFx).not.toHaveBeenCalled();
	});
});
