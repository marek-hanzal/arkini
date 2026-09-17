import { Effect, SubscriptionRef } from "effect";

import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { RuntimeIdentityFx } from "~/runtime-identity/context/RuntimeIdentityFx";

const dust = {
	uid: "item:dust",
	id: "item:dust",
	title: "Dust",
	description: "Dust",
	artwork: {
		scale: 0.8,
		default: [
			"artwork:dust",
		],
	},
	scope: "board",
	maxStackSize: 1,
	maxQueueSize: 1,
	lines: [],
};
const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:spawn-origin-handoff",
		title: "Spawn origin handoff",
		board: {
			width: 4,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		"item:dust": dust,
		"producer:shrine": {
			...dust,
			uid: "producer:shrine",
			id: "producer:shrine",
			units: {
				amount: 1,
				output: {
					set: [
						{
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "item:dust",
											quantity: {
												min: 1,
												max: 1,
											},
											placement: "random",
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
					id: "line:shrine:pray",
					title: "Pray",
					description: "Spend the final unit",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
	},
});

export const createDepletedSpawnTransitionFx = () => {
	let identity = 0;
	return Effect.gen(function* () {
		const origin = yield* spawnItemFx({
			id: "removed-origin",
			itemId: "producer:shrine",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
		});
		yield* startLineFx({
			ownerItemId: origin.id,
			lineId: "line:shrine:pray",
		});
		yield* runTickRuntimeByFx({
			elapsedMs: 200,
		});
		const transitions = yield* CommittedTransitionsFx;
		const transition = yield* SubscriptionRef.get(transitions.ref);
		yield* runTickRuntimeByFx({
			elapsedMs: 1000,
		});
		return {
			transition,
			afterIdleTick: yield* SubscriptionRef.get(transitions.ref),
		};
	}).pipe(
		useGameFx({
			config,
		}),
		// Fixed runtime identities also fix the completion seed and its off-origin output.
		Effect.provideService(
			RuntimeIdentityFx,
			Effect.sync(() => `motion-handoff:${identity++}`),
		),
	);
};
