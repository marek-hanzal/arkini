import { Effect } from "effect";
import { expect, it } from "vitest";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

it("commits a production template reset without resurrecting captured reserved material", () => {
	const config = createJobTestConfig();
	config.templates = [
		{
			uid: "empty",
			title: "Empty",
			width: 2,
			height: 2,
			board: [],
		},
	];
	config.items.forge!.lines[0]!.outcome = {
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
	};
	Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* prepareJobLineFx();
			yield* startLineFx({
				ownerItemId: owner.id,
				lineUid: "line:forge:run",
			});
			expect(
				(yield* readRuntimeFx()).items.some((item) => item.location.scope === "reserved"),
			).toBe(true);
			yield* runTickRuntimeByFx({
				elapsedMs: 5000,
			});
			const runtime = yield* readRuntimeFx();
			expect(runtime.items).toEqual([]);
			expect(runtime.jobs).toEqual([]);
			expect(runtime.jobQueue).toEqual([]);
			expect(runtime.templateUidBySpace).toEqual({
				0: "empty",
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});

it("does not publish a line spawn erased by the owner's depletion Template", () => {
	const config = createJobTestConfig();
	config.templates = [
		{
			uid: "empty",
			title: "Empty",
			width: 5,
			height: 2,
			board: [],
		},
	];
	config.items.forge!.lines[0]!.outcome = {
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
								quantity: {
									min: 1,
									max: 1,
								},
								placement: "drop",
								rules: [],
							},
						],
					},
				],
			},
		],
	};
	config.items.forge!.units = {
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
	};
	const materialInput = config.items.forge!.lines[0]!.input[0]!;
	if (materialInput.type !== "materials") throw new Error("Expected material input fixture.");
	materialInput.units = {
		from: "self",
		cost: 1,
	};
	const result = Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* prepareJobLineFx();
			yield* startLineFx({
				ownerItemId: owner.id,
				lineUid: "line:forge:run",
			});
			yield* runTickRuntimeByFx({
				elapsedMs: 5000,
			});
			return {
				runtime: yield* readRuntimeFx(),
				transition: yield* (yield* CommittedTransitionsFx).read,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.runtime.items).toEqual([]);
	expect(result.transition.events.some((event) => event.type === "item:spawned")).toBe(false);
	expect(result.transition.events.some((event) => event.type === "item:disappeared")).toBe(true);
});

it("keeps line output without mistaking it for a depleted owner's expired replacement", () => {
	const config = createJobTestConfig();
	config.items.short = {
		...config.items.water!,
		uid: "short",
		clock: {
			durationMs: 100,
			enable: true,
			rules: [],
		},
	};
	config.items.forge!.lines[0]!.outcome = {
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
								quantity: {
									min: 1,
									max: 1,
								},
								placement: "drop",
								rules: [],
							},
						],
					},
				],
			},
		],
	};
	config.items.forge!.units = {
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
									itemUid: "short",
									quantity: {
										min: 1,
										max: 1,
									},
									placement: "drop",
									rules: [],
								},
							],
						},
					],
				},
			],
		},
	};
	const materialInput = config.items.forge!.lines[0]!.input[0]!;
	if (materialInput.type !== "materials") throw new Error("Expected material input fixture.");
	materialInput.units = {
		from: "self",
		cost: 1,
	};
	const result = Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* prepareJobLineFx();
			yield* startLineFx({
				ownerItemId: owner.id,
				lineUid: "line:forge:run",
			});
			yield* runTickRuntimeByFx({
				elapsedMs: 1200,
			});
			return {
				runtime: yield* readRuntimeFx(),
				transition: yield* (yield* CommittedTransitionsFx).read,
			};
		}).pipe(
			useGameFx({
				config: GameConfigSchema.parse(config),
			}),
		),
	);
	expect(
		result.runtime.items.some(
			(item) => item.item.uid === "water" && item.location.scope === "board",
		),
	).toBe(true);
	expect(result.runtime.items.some((item) => item.item.uid === "short")).toBe(false);
	expect(
		result.transition.events.some(
			(event) =>
				(event.type === "item:expired" || event.type === "item:disappeared") &&
				event.itemUid === "short",
		),
	).toBe(false);
	expect(result.transition.events).toContainEqual(
		expect.objectContaining({
			type: "item:disappeared",
			itemId: "runtime:forge",
		}),
	);
	expect(result.transition.events.filter((event) => event.type === "item:spawned")).toHaveLength(
		1,
	);
});
