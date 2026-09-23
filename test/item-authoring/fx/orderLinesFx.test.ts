import { Effect, Result } from "effect";
import { describe, expect, it, vi } from "vitest";

import { orderLinesFx } from "~/item-authoring/fx/orderLinesFx";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const fixtureFn = () => {
	const config = createJobTestConfig();
	const first = config.items.forge.lines[0]!;
	const lines = [
		first,
		{
			...first,
			uid: "second",
			default: false,
			title: "Second",
		},
		{
			...first,
			uid: "third",
			default: false,
			title: "Third",
		},
	];
	const project: Project = {
		projectId: "line-order",
		title: "Order test",
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 0,
		updatedAtMs: 0,
		revision: 7,
		resources: [],
		config: {
			...config,
			items: {
				...config.items,
				forge: {
					...config.items.forge,
					lines,
				},
			},
		},
	};
	const { resources: _resources, ...commit } = project;
	const upsertItemFx = vi.fn<ProjectRepositoryService["upsertItemFx"]>(({ item }) =>
		Effect.succeed({
			...commit,
			previousRevision: 7,
			revision: 8,
			config: {
				...project.config,
				items: {
					...project.config.items,
					[item.uid]: item,
				},
			},
		}),
	);
	const repository: ProjectRepositoryService = {
		...UnusedEditorProjectRepository,
		awaitIdleFx: Effect.void,
		createProjectFx: () => Effect.die("Unexpected create"),
		deleteItemFx: () => Effect.die("Unexpected delete"),
		listProjectsFx: Effect.die("Unexpected list"),
		readProjectFx: () => Effect.die("Unexpected read"),
		replaceConfigFx: () => Effect.die("Unexpected config replacement"),
		replaceResourceFx: () => Effect.die("Unexpected resource replacement"),
		upsertItemFx,
	};
	return {
		project,
		repository,
		upsertItemFx,
		lines,
	};
};

describe("exact item line ordering", () => {
	it("preserves complete line values and item metadata, passing the revision to one write", () => {
		const { project, repository, upsertItemFx, lines } = fixtureFn();
		const result = Effect.runSync(
			orderLinesFx({
				project,
				repository,
				itemUid: "forge",
				revision: 7,
				lineUids: [
					lines[2]!.uid,
					lines[0]!.uid,
					lines[1]!.uid,
				],
			}),
		);
		expect(result.item).toEqual({
			...project.config.items.forge,
			lines: [
				lines[2],
				lines[0],
				lines[1],
			],
		});
		expect(project.config.items.forge.lines).toEqual(lines);
		expect(upsertItemFx).toHaveBeenCalledExactlyOnceWith({
			projectId: project.projectId,
			expectedRevision: 7,
			item: result.item,
		});
	});

	it("rejects every invalid permutation before invoking persistence", () => {
		const { project, repository, upsertItemFx, lines } = fixtureFn();
		const original = structuredClone(project);
		for (const lineUids of [
			[],
			[
				lines[0]!.uid,
				lines[1]!.uid,
			],
			[
				lines[0]!.uid,
				lines[1]!.uid,
				"missing",
			],
			[
				lines[0]!.uid,
				lines[1]!.uid,
				lines[1]!.uid,
			],
			[
				...lines.map((line) => line.uid),
				"extra",
			],
		]) {
			const result = Effect.runSync(
				orderLinesFx({
					project,
					repository,
					itemUid: "forge",
					revision: 7,
					lineUids,
				}).pipe(Effect.result),
			);
			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result))
				expect(result.failure).toMatchObject({
					reason: "invalid-item",
				});
		}
		for (const input of [
			{
				project,
				itemUid: "missing",
				revision: 7,
				lineUids: [],
			},
			{
				project,
				itemUid: "forge",
				revision: 6,
				lineUids: lines.map((line) => line.uid),
			},
		])
			expect(
				Result.isFailure(
					Effect.runSync(
						orderLinesFx({
							...input,
							repository,
						}).pipe(Effect.result),
					),
				),
			).toBe(true);
		expect(upsertItemFx).not.toHaveBeenCalled();
		expect(project).toEqual(original);
	});

	it("accepts the empty permutation only for an item with no lines", () => {
		const { project, repository } = fixtureFn();
		expect(project.config.items.tool.lines).toEqual([]);
		const result = Effect.runSync(
			orderLinesFx({
				project,
				repository,
				itemUid: "tool",
				revision: 7,
				lineUids: [],
			}),
		);
		expect(result.item).toEqual(project.config.items.tool);
	});
});
