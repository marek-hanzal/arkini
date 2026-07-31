import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProjectRecord } from "../../../electron/contract/editor/EditorProjectRecord";
import { createEditorProjectManifestFileFx } from "~/bridge/editor/createEditorProjectManifestFileFx";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { saveEditorAssetFx } from "~/bridge/editor/saveEditorAssetFx";
import { createEditorProjectPlanFx } from "~/engine/editor/fx/createEditorProjectPlanFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const createPng = () =>
	Uint8Array.from(
		Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
			"base64",
		),
	);

const bitmapClose = vi.fn();

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
	vi.unstubAllGlobals();
});

describe("saveEditorAssetFx", () => {
	it("validates and publishes one immediate PNG mutation", async () => {
		const plan = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "a".repeat(64),
				payload: editorTestPayload,
			}),
		);
		const manifest = await Effect.runPromise(
			createEditorProjectManifestFileFx({
				projectId: plan.projectId,
				title: plan.title,
				game: plan.version,
				nowMs: 123,
			}),
		);
		let record: EditorProjectRecord = {
			projectId: plan.projectId,
			revision: "0".repeat(64),
			files: [
				manifest.file,
				...plan.files,
			],
		};
		const write = vi.fn<EditorWorkspace["writeFileFx"]>((mutation) =>
			Effect.sync(() => {
				record = {
					...record,
					revision: "1".repeat(64),
					files: [
						...record.files,
						mutation.file,
					],
				};
				return "1".repeat(64);
			}),
		);
		const workspace: EditorWorkspace = {
			listFx: () => Effect.succeed([]),
			createFx: () => Effect.void,
			readFx: () => Effect.succeed(record),
			writeFileFx: write,
			openDirectoryFx: () => Effect.void,
		};
		const saved = await Effect.runPromise(
			saveEditorAssetFx({
				projectId: plan.projectId,
				expectedRevision: "0".repeat(64),
				file: {
					name: "new-asset.png",
					size: createPng().byteLength,
					arrayBuffer: async () => createPng().buffer,
				},
				workspace,
			}),
		);
		expect(write).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "create",
				file: expect.objectContaining({
					path: "assets/new-asset.png",
				}),
			}),
		);
		expect(saved.project.resources.map(({ id }) => id)).toContain("new-asset");
		expect(saved.project.revision).toBe(saved.revision);
	});

	it("rejects bytes that only claim a png filename", async () => {
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
		const workspace = {
			readFx: vi.fn(),
		} as unknown as EditorWorkspace;
		await expect(
			Effect.runPromise(
				saveEditorAssetFx({
					projectId: "project",
					expectedRevision: "0".repeat(64),
					file: {
						name: "fake.png",
						size: fakePng.byteLength,
						arrayBuffer: async () => fakePng.buffer,
					},
					workspace,
				}),
			),
		).rejects.toThrow("must decode as a valid PNG image");
		expect(workspace.readFx).not.toHaveBeenCalled();
	});

	it("releases the decoded bitmap when dimension validation fails", async () => {
		vi.mocked(createImageBitmap).mockResolvedValueOnce({
			width: 9000,
			height: 1,
			close: bitmapClose,
		} as unknown as ImageBitmap);
		const png = createPng();
		const workspace = {
			readFx: vi.fn(),
		} as unknown as EditorWorkspace;

		await expect(
			Effect.runPromise(
				saveEditorAssetFx({
					projectId: "project",
					expectedRevision: "0".repeat(64),
					file: {
						name: "oversized.png",
						size: png.byteLength,
						arrayBuffer: async () => png.buffer,
					},
					workspace,
				}),
			),
		).rejects.toThrow("exceeds the supported PNG dimensions");
		expect(bitmapClose).toHaveBeenCalledOnce();
		expect(workspace.readFx).not.toHaveBeenCalled();
	});
});
