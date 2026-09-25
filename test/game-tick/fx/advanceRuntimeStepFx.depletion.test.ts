import { Effect } from "effect";
import { expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { projectCommittedEngineFactsFx } from "~/game-event/fx/projectCommittedEngineFactsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

it("does not announce a queued job erased by another job's template outcome in the same step", () => {
	const base = createJobTestConfig();
	const forge = base.items.forge!;
	const config = GameConfigSchema.parse({
		...base,
		templates: [
			{
				uid: "empty",
				title: "Empty",
				width: 5,
				height: 2,
				board: [],
			},
		],
		items: {
			...base.items,
			forge: {
				...forge,
				lines: [
					{
						...forge.lines[0],
						input: [
							{
								type: "simple",
							},
						],
						outcome: {
							set: [
								{
									weight: 1,
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													type: "template",
													templateUid: "empty",
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					},
				],
			},
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			for (const [id, x] of [
				[
					"owner:a",
					0,
				],
				[
					"owner:b",
					1,
				],
			] as const) {
				yield* spawnItemFx({
					id,
					itemUid: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x,
							y: 0,
						},
					},
				});
			}
			yield* enqueueLineFx({
				ownerItemId: "owner:a",
				lineUid: "line:forge:run",
			});
			const runtime = yield* readRuntimeFx();
			const before = {
				...runtime,
				jobs: [
					{
						id: "job:b",
						ownerItemId: "owner:b",
						lineUid: "line:forge:run",
						durationMs: 1_000,
						remainingMs: 0,
					},
				],
			};
			const step = yield* advanceRuntimeStepFx(before);
			return {
				runtime: step.runtime,
				events: yield* projectCommittedEngineFactsFx({
					previousRuntime: before,
					runtime: step.runtime,
					facts: step.facts,
				}),
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

	expect(result.runtime.jobs).toEqual([]);
	expect(result.runtime.items).toEqual([]);
	expect(result.events.some((event) => event.type === "board:template-applied")).toBe(true);
	expect(
		result.events.some((event) => event.type === "job:completed" && event.jobId === "job:b"),
	).toBe(true);
	expect(result.events.some((event) => event.type === "job:started")).toBe(false);
});
