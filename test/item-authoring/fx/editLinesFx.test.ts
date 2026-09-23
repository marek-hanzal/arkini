import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { editLinesFx } from "~/item-authoring/fx/editLinesFx";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import {
	createLine,
	createProducerItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

it("generates distinct batch create UIDs and preserves replacement identity through the committed result", () => {
	const original = createLine({
		uid: "line:original",
	});
	const { uid: _uid, ...line } = original;
	const project: Project = {
		projectId: "project",
		title: "Project",
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 0,
		updatedAtMs: 0,
		revision: 7,
		resources: [],
		config: {
			...editorTestConfig,
			items: {
				producer: createProducerItem({
					id: "producer",
					lines: [
						original,
					],
				}),
			},
		},
	};
	const replaceConfigFx = vi.fn<ProjectRepositoryService["replaceConfigFx"]>(({ config }) =>
		Effect.succeed({
			...project,
			config,
			previousRevision: 7,
			revision: 8,
		}),
	);
	const output = Effect.runSync(
		editLinesFx({
			project,
			revision: 7,
			repository: {
				...UnusedEditorProjectRepository,
				awaitIdleFx: Effect.void,
				createProjectFx: () => Effect.die("Unexpected project creation."),
				deleteItemFx: () => Effect.die("Unexpected item deletion."),
				listProjectsFx: Effect.die("Unexpected project listing."),
				readProjectFx: () => Effect.die("Unexpected project read."),
				replaceResourceFx: () => Effect.die("Unexpected resource write."),
				upsertItemFx: () => Effect.die("Unexpected item write."),
				replaceConfigFx,
			},
			operations: [
				{
					operation: "create",
					itemUid: "producer",
					line: {
						...line,
						default: false,
					},
				},
				{
					operation: "replace",
					itemUid: "producer",
					lineUid: original.uid,
					line: {
						...line,
						title: "Renamed",
					},
				},
				{
					operation: "create",
					itemUid: "producer",
					line: {
						...line,
						default: false,
					},
				},
			],
		}),
	);
	expect(replaceConfigFx).toHaveBeenCalledTimes(1);
	const saved = output.commit.config.items.producer.lines;
	expect(saved[0]).toEqual({
		...original,
		title: "Renamed",
	});
	expect(new Set(saved.map((candidate) => candidate.uid)).size).toBe(3);
	expect(output.operations).toEqual([
		{
			operation: "create",
			itemUid: "producer",
			line: saved[1],
		},
		{
			operation: "replace",
			itemUid: "producer",
			lineUid: original.uid,
			line: saved[0],
		},
		{
			operation: "create",
			itemUid: "producer",
			line: saved[2],
		},
	]);
	expect(project.config.items.producer.lines).toEqual([
		original,
	]);
	expect(output.commit.revision).toBe(8);
});
