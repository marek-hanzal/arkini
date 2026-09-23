import { Effect } from "effect";
import { expect, it } from "vitest";
import { applyBoardTemplateRuntimeFx } from "~/board-template/fx/applyBoardTemplateRuntimeFx";
import { assertRuntimeFx } from "~/game-runtime/fx/assertRuntimeFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { useGameFx } from "~test/support/useGameFx";

it("replaces one space and its full ownership tree while retaining another space's work", () => {
	const base = createJobTestConfig();
	const config = GameConfigSchema.parse({
		...base,
		templates: [
			{
				uid: "replacement",
				title: "Replacement",
				width: 2,
				height: 1,
				board: [
					{
						itemId: "tool",
						x: 1,
						y: 0,
					},
				],
			},
		],
		items: {
			...base.items,
			water: {
				...base.items.water,
				clock: {
					durationMs: 10000,
				},
				lines: [
					{
						id: "water:buffer",
						title: "Buffer",
						description: "Buffer",
						runtimeMs: 1000,
						input: [
							{
								type: "materials",
								query: {
									distance: "far",
									selector: {
										type: "item",
										itemId: "tool",
									},
								},
								quantity: {
									min: 1,
									max: 1,
								},
								mode: "consume",
							},
						],
						rules: [],
					},
				],
			},
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* prepareJobLineFx();
			yield* startLineFx({
				ownerItemId: "runtime:forge",
				lineId: "line:forge:run",
			});
			const prepared = yield* readRuntimeFx();
			const buffered = prepared.items.find(
				(item) => item.item.id === "water" && item.location.scope === "board",
			)!;
			const travelling = prepared.items.find(
				(item) =>
					item.item.id === "water" &&
					item.location.scope === "board" &&
					item.id !== buffered.id,
			)!;
			const source: RuntimeSchema.Type = {
				...prepared,
				items: [
					...prepared.items.map((item) => {
						if (item.id === buffered.id)
							return {
								...item,
								location: {
									scope: "input" as const,
									ownerItemId: "buffer-owner",
									lineId: "line:forge:run",
									inputIndex: 0,
								},
							};
						if (item.id === travelling.id && item.location.scope === "board")
							return {
								...item,
								location: {
									scope: "delivery" as const,
									phase: "outbound" as const,
									generation: 0,
									remainingDurationMs: 100,
									origin: item.location,
									target: {
										kind: "line-input" as const,
										ownerItemId: "buffer-owner",
										lineId: "line:forge:run",
										inputIndex: 0,
									},
								},
							};
						return item;
					}),
					{
						id: "buffer-owner",
						revision: "buffer-owner-revision",
						item: config.items.forge!,
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 4,
								y: 0,
							},
						},
					},
					{
						id: "nested-tool",
						revision: "nested-revision",
						item: config.items.tool!,
						location: {
							scope: "input",
							ownerItemId: buffered.id,
							lineId: "water:buffer",
							inputIndex: 0,
						},
					},
				],
				jobQueue: [
					{
						id: "queued-forge",
						ownerItemId: "runtime:forge",
						lineId: "line:forge:run",
					},
				],
				defaultLineByOwnerItemId: {
					"runtime:forge": "line:forge:run",
					[buffered.id]: "water:buffer",
				},
			};
			// Duplicate complete runtime work with explicit independent IDs in space 7.
			const ids = new Map([
				...source.items.map(
					({ id }) =>
						[
							id,
							`other:${id}`,
						] as const,
				),
				...source.jobs.map(
					({ id }) =>
						[
							id,
							`other:${id}`,
						] as const,
				),
			]);
			const other: RuntimeSchema.Type = {
				...source,
				items: source.items.map((item) => ({
					...item,
					id: ids.get(item.id)!,
					location:
						item.location.scope === "board"
							? {
									...item.location,
									space: 7,
								}
							: item.location.scope === "input"
								? {
										...item.location,
										ownerItemId: ids.get(item.location.ownerItemId)!,
									}
								: item.location.scope === "delivery" &&
										item.location.phase === "outbound"
									? {
											...item.location,
											origin: {
												...item.location.origin,
												space: 7,
											},
											target: {
												...item.location.target,
												ownerItemId: ids.get(
													item.location.target.ownerItemId,
												)!,
											},
										}
									: item.location.scope === "job" ||
											item.location.scope === "reserved"
										? {
												...item.location,
												jobId: ids.get(item.location.jobId)!,
											}
										: item.location,
				})),
				jobs: source.jobs.map((job) => ({
					...job,
					id: ids.get(job.id)!,
					ownerItemId: ids.get(job.ownerItemId)!,
				})),
				jobQueue: source.jobQueue.map((request) => ({
					...request,
					id: `other:${request.id}`,
					ownerItemId: ids.get(request.ownerItemId)!,
				})),
				defaultLineByOwnerItemId: Object.fromEntries(
					Object.entries(source.defaultLineByOwnerItemId).map(([id, lineId]) => [
						ids.get(id)!,
						lineId,
					]),
				),
			};
			const before: RuntimeSchema.Type = {
				...source,
				items: [
					...source.items,
					...other.items,
				],
				jobs: [
					...source.jobs,
					...other.jobs,
				],
				jobQueue: [
					...source.jobQueue,
					...other.jobQueue,
				],
				defaultLineByOwnerItemId: {
					...source.defaultLineByOwnerItemId,
					...other.defaultLineByOwnerItemId,
				},
			};
			yield* assertRuntimeFx({
				runtime: before,
			});
			const transition = yield* applyBoardTemplateRuntimeFx({
				runtime: before,
				space: 0,
				templateUid: "replacement",
			});
			yield* assertRuntimeFx({
				runtime: transition.runtime,
			});
			return {
				before,
				other,
				after: transition.runtime,
				removedIds: source.items.map(({ id }) => id),
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

	expect(result.before.jobs).toHaveLength(2);
	expect(result.before.items.some((item) => item.location.scope === "delivery")).toBe(true);
	expect(result.before.items.some((item) => item.location.scope === "reserved")).toBe(true);
	expect(result.before.items.some((item) => item.schedule !== undefined)).toBe(true);
	expect(result.after.items.filter((item) => item.id.startsWith("other:"))).toEqual(
		result.other.items,
	);
	expect(result.after.jobs).toEqual(result.other.jobs);
	expect(result.after.jobQueue).toEqual(result.other.jobQueue);
	expect(result.after.defaultLineByOwnerItemId).toEqual(result.other.defaultLineByOwnerItemId);
	expect(result.after.items.some(({ id }) => result.removedIds.includes(id))).toBe(false);
	const created = result.after.items.filter((item) => !item.id.startsWith("other:"));
	expect(created).toHaveLength(1);
	expect(created[0]).toMatchObject({
		item: {
			id: "tool",
		},
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
	});
	expect(result.after.templateUidBySpace[0]).toBe("replacement");
	expect(result.after.templateUidBySpace[7]).toBe(result.before.templateUidBySpace[7]);
});
