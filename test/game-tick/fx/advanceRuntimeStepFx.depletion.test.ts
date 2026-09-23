import { Effect } from "effect";
import { expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { createTemporaryLifetimeTestConfig } from "~test/item-schedule/fx/temporaryLifetime.test/createTemporaryLifetimeTestConfig";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { projectCommittedEngineFactsFx } from "~/game-event/fx/projectCommittedEngineFactsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

it("does not announce a job erased by its payer's template outcome", () => {
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
								type: "units",
								query: {
									distance: "close",
									selector: {
										type: "item",
										itemUid: "payer",
									},
								},
								units: {
									from: "target",
									cost: 1,
								},
							},
						],
					},
				],
			},
			payer: {
				...base.items.water,
				uid: "payer",
				units: {
					amount: 1,
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
			},
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			for (const [itemUid, x] of [
				[
					"forge",
					0,
				],
				[
					"payer",
					1,
				],
			] as const) {
				yield* spawnItemFx({
					id: `runtime:${itemUid}`,
					itemUid,
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
				ownerItemId: "runtime:forge",
				lineId: "line:forge:run",
			});
			const before = yield* readRuntimeFx();
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

	expect(result.runtime.templateUidBySpace).toEqual({
		0: "empty",
	});
	expect(result.runtime.items).toEqual([]);
	expect(result.runtime.jobs).toEqual([]);
	expect(result.runtime.jobQueue).toEqual([]);
	expect(result.events.some((event) => event.type === "board:template-applied")).toBe(true);
	expect(result.events.some((event) => event.type === "job:started")).toBe(false);
});

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
				lineId: "line:forge:run",
			});
			const runtime = yield* readRuntimeFx();
			const before = {
				...runtime,
				jobs: [
					{
						id: "job:b",
						ownerItemId: "owner:b",
						lineId: "line:forge:run",
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

it("preserves the full lifetime of temporary depletion outcome created by queue dispatch", () => {
	const base = createTemporaryLifetimeTestConfig();
	const producer = base.items.producer;
	const config = GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			blocker: {
				...base.items.blocker,
				units: {
					amount: 1,
					outcome: producer.lines[0].outcome,
				},
			},
			producer: {
				...producer,
				lines: [
					{
						...producer.lines[0],
						outcome: undefined,
						input: [
							{
								type: "units",
								units: {
									from: "target",
									cost: 1,
								},
								query: {
									distance: "close",
									selector: {
										type: "item",
										itemUid: "blocker",
									},
								},
							},
						],
					},
				],
			},
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			for (const [itemId, x] of [
				[
					"producer",
					0,
				],
				[
					"blocker",
					1,
				],
			] as const) {
				yield* spawnItemFx({
					id: `runtime:${itemId}`,
					itemUid: itemId,
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
				ownerItemId: "runtime:producer",
				lineId: producer.lines[0].id,
			});
			const first = yield* advanceRuntimeStepFx(yield* readRuntimeFx());
			const second = yield* advanceRuntimeStepFx(first.runtime);
			return {
				first,
				second,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

	expect(result.first.runtime.items.some((item) => item.item.uid === "blocker")).toBe(false);
	expect(
		result.first.runtime.items.find((item) => item.item.uid === "temporaryPlain")?.schedule
			?.remainingDurationMs,
	).toBe(600);
	expect(
		result.second.runtime.items.find((item) => item.item.uid === "temporaryPlain")?.schedule
			?.remainingDurationMs,
	).toBe(500);
});
