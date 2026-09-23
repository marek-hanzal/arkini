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

it("keeps a depletion replacement when Autofill moves it into Delivery in the same step", () => {
	const base = createJobTestConfig();
	const forge = base.items.forge!;
	const config = GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			forge: {
				...forge,
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
												type: "item",
												itemUid: "water",
												placement: "drop",
												quantity: {
													min: 1,
													max: 1,
												},
												rules: [],
											},
										],
									},
								],
							},
						],
					},
				},
				lines: [
					{
						...forge.lines[0],
						runtimeMs: 100,
						input: [
							{
								type: "simple",
								units: {
									from: "self",
									cost: 1,
								},
							},
						],
					},
				],
			},
			collector: {
				...forge,
				uid: "collector",
				lines: [
					{
						...forge.lines[0],
						uid: "line:collector:run",
						input: [
							{
								type: "materials",
								query: {
									distance: "far",
									selector: {
										type: "item",
										itemUid: "water",
									},
								},
								quantity: {
									min: 1,
									max: 1,
								},
								mode: "consume",
							},
						],
					},
				],
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
					"collector",
					3,
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
				lineUid: "line:forge:run",
			});
			yield* enqueueLineFx({
				ownerItemId: "runtime:collector",
				lineUid: "line:collector:run",
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

	expect(result.runtime.items.find((item) => item.item.uid === "water")).toMatchObject({
		location: {
			scope: "delivery",
			phase: "outbound",
			target: {
				ownerItemId: "runtime:collector",
				lineUid: "line:collector:run",
			},
		},
	});
	expect(result.events.some((event) => event.type === "item:depleted")).toBe(true);
	expect(result.events.some((event) => event.type === "item:spawned")).toBe(false);
	expect(result.events.some((event) => event.type === "item:disappeared")).toBe(false);
});
