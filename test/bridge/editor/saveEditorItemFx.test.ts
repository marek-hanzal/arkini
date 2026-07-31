import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorProjectFile } from "../../../electron/contract/editor/EditorProjectFile";
import type { EditorProjectRecord } from "../../../electron/contract/editor/EditorProjectRecord";
import { createEditorProjectManifestFileFx } from "~/bridge/editor/createEditorProjectManifestFileFx";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { saveEditorItemFx } from "~/bridge/editor/saveEditorItemFx";
import { createEditorProjectPlanFx } from "~/engine/editor/fx/createEditorProjectPlanFx";
import { GameSourceSchema } from "~/engine/schema/GameSourceSchema";
import { editorTestConfig, editorTestPayload } from "~test/editor/support/editorTestPayload";

describe("saveEditorItemFx", () => {
	it("patches one source-owned item without deleting sibling definitions", async () => {
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
		const waterPath = "simple/water.json";
		const source = plan.files.find(({ path }) => path === waterPath);
		if (source === undefined) throw new Error("Missing water source.");
		const sibling = {
			...editorTestConfig.items.water,
			uid: "sibling",
			id: "sibling",
			title: "Sibling",
		};
		const groupedSource = {
			...source,
			bytes: new TextEncoder().encode(
				`${JSON.stringify(
					{
						$schema: "https://example.invalid/game-source.schema.json",
						items: {
							water: editorTestConfig.items.water,
							sibling,
						},
					},
					null,
					"\t",
				)}\n`,
			),
		};
		let record: EditorProjectRecord = {
			projectId: plan.projectId,
			revision: "0".repeat(64),
			files: [
				manifest.file,
				...plan.files.filter(({ path }) => path !== waterPath),
				groupedSource,
			],
		};
		let written: EditorProjectFile | undefined;
		const workspace: EditorWorkspace = {
			listFx: () => Effect.succeed([]),
			createFx: () => Effect.void,
			readFx: () => Effect.succeed(record),
			writeFileFx: (mutation) =>
				Effect.sync(() => {
					written = mutation.file;
					record = {
						...record,
						revision: "1".repeat(64),
						files: [
							...record.files.filter(({ path }) => path !== mutation.file.path),
							mutation.file,
						],
					};
					return "1".repeat(64);
				}),
			openDirectoryFx: () => Effect.void,
		};
		const saved = await Effect.runPromise(
			saveEditorItemFx({
				projectId: plan.projectId,
				expectedRevision: "0".repeat(64),
				sourceItemId: "water",
				sourcePath: waterPath,
				item: {
					...editorTestConfig.items.water,
					title: "Edited water",
				},
				workspace,
			}),
		);
		if (written === undefined) throw new Error("The source was not written.");
		const parsed = GameSourceSchema.parse(
			JSON.parse(new TextDecoder().decode(written.bytes)) as unknown,
		);
		expect(parsed.$schema).toBe("https://example.invalid/game-source.schema.json");
		expect(parsed.items?.water?.title).toBe("Edited water");
		expect(parsed.items?.sibling).toEqual(sibling);
		expect(saved.project.config?.items.sibling).toEqual(sibling);
		expect(saved.revision).toBe("1".repeat(64));
	});
});
