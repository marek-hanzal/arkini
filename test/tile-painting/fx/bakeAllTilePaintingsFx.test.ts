import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { Effect, Encoding } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ProjectRepository,
	type ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import type { Project } from "~/project-authoring/type/Project";
import type { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import {
	createTestPngBytes,
	createAlternateTestPngBytes,
} from "~test/arkpack-support/fn/createTestPngBytes";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

const calls = vi.hoisted(() => ({
	renderFn: vi.fn(),
	publishFn: vi.fn(),
}));
vi.mock("~/tile-painting/fx/renderTilePaintingPngFx", () => ({
	renderTilePaintingPngFx: (document: unknown) => calls.renderFn(document),
}));
vi.mock("~/authoring-session/fx/publishEditorProjectFx", () => ({
	publishEditorProjectFx: (...args: unknown[]) => calls.publishFn(...args),
}));
import { bakeAllTilePaintingsFx } from "~/tile-painting/fx/bakeAllTilePaintingsFx";
import { prepareTilePaintingBakeFx } from "~/tile-painting/fx/prepareTilePaintingBakeFx";

const original = createTestPngBytes();
const replacement = createAlternateTestPngBytes();
const originalPng = `data:image/png;base64,${Encoding.encodeBase64(original)}`;
const replacementPng = `data:image/png;base64,${Encoding.encodeBase64(replacement)}`;
const paintingFn = (
	paintingId: string,
	source: string,
	guide: string,
): TilePaintingSchema.Type => ({
	paintingId,
	projectId: "project",
	updatedAtMs: 10,
	outputResourceId: paintingId,
	document: {
		name: paintingId,
		images: [
			{
				id: "material",
				label: source,
				sourceResourceId: source,
				png: originalPng,
			},
			{
				id: "guide",
				label: guide,
				sourceResourceId: guide,
				png: originalPng,
			},
		],
		layers: [
			{
				id: "layer",
				name: "Layer",
				imageId: "material",
				visible: true,
				opacity: 1,
				tileSize: 256,
				strokes: [],
			},
		],
		catalog: [],
		scatter: [],
		reference: {
			imageId: "guide",
			opacity: 1,
			visible: true,
		},
		preview: {
			rows: 1,
			columns: 1,
			cells: [
				{
					kind: "painting",
				},
			],
		},
	},
});
const project: Project = {
	projectId: "project",
	title: "Test",
	version: {
		major: 1,
		minor: 0,
	},
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 100,
	config: editorTestConfig,
	resources: [
		"texture",
		"parent",
		"child",
	].map((id) => ({
		id,
		mime: "image/png" as const,
		bytes: original,
	})),
};
const fixtureFn = () => {
	const records = [
		paintingFn("child", "parent", "child"),
		paintingFn("parent", "texture", "child"),
	];
	const batchFn = vi.fn((props: ProjectRepository.BakeTilePaintingsProps) =>
		Effect.succeed({
			project: {
				...project,
				revision: 101,
			},
			paintings: props.paintings.map((prepared) => ({
				...records.find((record) => record.paintingId === prepared.paintingId)!,
				document: prepared.document,
				updatedAtMs: 11,
			})),
		}),
	);
	const repository = {
		readProjectFx: () => Effect.succeed(project),
		listTilePaintingsFx: () => Effect.succeed(records),
		bakeTilePaintingsFx: batchFn,
	} as unknown as ProjectRepositoryService;
	return {
		repository,
		records,
		batchFn,
	};
};
beforeEach(() => {
	calls.renderFn.mockReset();
	calls.publishFn.mockReset();
	calls.publishFn.mockReturnValue(Effect.void);
	calls.renderFn.mockReturnValue(Effect.succeed(replacementPng));
});

describe("painting bake orchestration", () => {
	it("refreshes source bytes for rendering and captures its own output only as a guide without making a render cycle", async () => {
		const painting = paintingFn("output", "texture", "output");
		const result = await Effect.runPromise(
			prepareTilePaintingBakeFx({
				document: painting.document,
				outputResourceId: "output",
				resources: [
					{
						id: "texture",
						mime: "image/png",
						bytes: replacement,
					},
				],
			}),
		);
		expect(calls.renderFn.mock.calls[0][0].images[0].png).toBe(replacementPng);
		expect(result.document.images[1].png).toBe(replacementPng);
		expect(painting.document.images[0].png).toBe(originalPng);
	});

	it("feeds freshly rendered parent bytes into its child and submits all final guide snapshots in one commit", async () => {
		const fixture = fixtureFn();
		const progressFn = vi.fn();
		const result = await Effect.runPromise(
			bakeAllTilePaintingsFx({
				projectId: "project",
				onProgressFn: progressFn,
			}).pipe(
				Effect.provideService(ProjectRepository, fixture.repository),
				Effect.provide(AtomRegistry.layer),
			),
		);
		expect(calls.renderFn.mock.calls.map(([document]) => document.name)).toEqual([
			"parent",
			"child",
		]);
		expect(calls.renderFn.mock.calls[1][0].images[0].png).toBe(replacementPng);
		expect(fixture.batchFn).toHaveBeenCalledOnce();
		const committed = fixture.batchFn.mock.calls[0][0];
		expect(committed.expectedRevision).toBe(100);
		expect(committed.paintings[0].document.images[1].png).toBe(replacementPng);
		expect(
			committed.paintings[1].document.images.every((image) => image.png === replacementPng),
		).toBe(true);
		expect(calls.publishFn).toHaveBeenCalledOnce();
		expect(result.bakedCount).toBe(2);
		expect(progressFn.mock.calls).toEqual([
			[
				0,
				2,
			],
			[
				1,
				2,
			],
			[
				2,
				2,
			],
		]);
	});

	it("does not commit or publish any output when rendering a later child fails", async () => {
		const fixture = fixtureFn();
		calls.renderFn.mockImplementation((document: TilePaintingDocumentSchema.Type) =>
			document.name === "child"
				? Effect.fail(
						new ProjectOperationError({
							reason: "invalid-asset",
							message: "decode failed",
						}),
					)
				: Effect.succeed(replacementPng),
		);
		await expect(
			Effect.runPromise(
				bakeAllTilePaintingsFx({
					projectId: "project",
				}).pipe(
					Effect.provideService(ProjectRepository, fixture.repository),
					Effect.provide(AtomRegistry.layer),
				),
			),
		).rejects.toThrow("decode failed");
		expect(fixture.batchFn).not.toHaveBeenCalled();
		expect(calls.publishFn).not.toHaveBeenCalled();
	});

	it("preserves an unused captured brush snapshot even if its former source was deleted", async () => {
		const painting = paintingFn("output", "texture", "output");
		painting.document.images.push({
			id: "unused",
			label: "Deleted brush",
			sourceResourceId: "deleted",
			png: originalPng,
		});
		const result = await Effect.runPromise(
			prepareTilePaintingBakeFx({
				document: painting.document,
				outputResourceId: "output",
				resources: [
					{
						id: "texture",
						mime: "image/png",
						bytes: replacement,
					},
				],
			}),
		);
		expect(result.document.images[2]).toEqual(painting.document.images[2]);
	});
});
