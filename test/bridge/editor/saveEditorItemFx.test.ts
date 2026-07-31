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

const createFixture = async () => {
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
		uid: "sibling-uid",
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
		writeFx: (mutation) =>
			Effect.sync(() => {
				written = mutation.file;
				const manifestFile = record.files.find(({ path }) => path === "editor.json");
				const manifest = JSON.parse(
					new TextDecoder().decode(manifestFile?.bytes),
				) as Record<string, unknown>;
				record = {
					...record,
					revision: "1".repeat(64),
					files: [
						...record.files.filter(
							({ path }) => path !== mutation.file.path && path !== "editor.json",
						),
						mutation.file,
						{
							path: "editor.json",
							bytes: new TextEncoder().encode(
								`${JSON.stringify({ ...manifest, updatedAtMs: 456 }, null, "\t")}\n`,
							),
						},
					],
				};
				return record;
			}),
		openDirectoryFx: () => Effect.void,
	};
	return {
		plan,
		sibling,
		waterPath,
		workspace,
		readWritten: () => written,
	};
};

const parseWrittenSource = (file: EditorProjectFile | undefined) => {
	if (file === undefined) throw new Error("The source was not written.");
	return GameSourceSchema.parse(
		JSON.parse(new TextDecoder().decode(file.bytes)) as unknown,
	);
};

describe("saveEditorItemFx", () => {
	it("updates one source-owned item by UID without deleting sibling definitions", async () => {
		const fixture = await createFixture();
		const saved = await Effect.runPromise(
			saveEditorItemFx({
				projectId: fixture.plan.projectId,
				expectedRevision: "0".repeat(64),
				item: {
					...editorTestConfig.items.water,
					title: "Edited water",
				},
				workspace: fixture.workspace,
			}),
		);
		const parsed = parseWrittenSource(fixture.readWritten());

		expect(parsed.$schema).toBe("https://example.invalid/game-source.schema.json");
		expect(parsed.items?.water?.title).toBe("Edited water");
		expect(parsed.items?.sibling).toEqual(fixture.sibling);
		expect(saved.project.config?.items.sibling).toEqual(fixture.sibling);
		expect(saved.revision).toBe("1".repeat(64));
		expect(saved.project.updatedAtMs).toBe(456);
	});

	it("renames the source entry selected by UID instead of guessing from item ID", async () => {
		const fixture = await createFixture();
		const renamed = {
			...fixture.sibling,
			id: "renamed-sibling",
			title: "Renamed sibling",
		};
		const saved = await Effect.runPromise(
			saveEditorItemFx({
				projectId: fixture.plan.projectId,
				expectedRevision: "0".repeat(64),
				item: renamed,
				workspace: fixture.workspace,
			}),
		);
		const parsed = parseWrittenSource(fixture.readWritten());

		expect(fixture.readWritten()?.path).toBe(fixture.waterPath);
		expect(parsed.items?.sibling).toBeUndefined();
		expect(parsed.items?.[renamed.id]).toEqual(renamed);
		expect(parsed.items?.water).toEqual(editorTestConfig.items.water);
		expect(saved.project.config?.items[renamed.id]).toEqual(renamed);
	});

	it("creates a new source entry when no canonical item owns the UID", async () => {
		const fixture = await createFixture();
		const created = {
			...editorTestConfig.items.water,
			uid: "new-item-uid",
			id: "item:new-water",
			title: "New water",
		};
		const saved = await Effect.runPromise(
			saveEditorItemFx({
				projectId: fixture.plan.projectId,
				expectedRevision: "0".repeat(64),
				item: created,
				workspace: fixture.workspace,
			}),
		);
		const parsed = parseWrittenSource(fixture.readWritten());

		expect(fixture.readWritten()?.path).toBe("simple/new-water.json");
		expect(parsed.items?.[created.id]).toEqual(created);
		expect(saved.project.config?.items[created.id]).toEqual(created);
	});
});
