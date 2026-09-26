import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { useGameFx } from "~test/support/useGameFx";
import { startFx } from "~/game-start/fx/startFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";

const config = {
	...startTestConfig,
	templates: [
		...startTestConfig.templates!,
		{
			uid: "next",
			title: "Next",
			width: 2,
			height: 1,
			board: [
				{
					itemUid: "lens",
					x: 0,
					y: 0,
				},
			],
		},
	],
	start: {
		currentSpace: 0,
		spaces: [
			{
				space: 0,
				templateUid: "start",
			},
			{
				space: 1,
				templateUid: "start",
			},
		],
	},
};
const template: OutcomeSchema.Type = {
	type: "template",
	templateUid: "next",
	rules: [],
};
const item: OutcomeSchema.Type = {
	type: "item",
	itemUid: "log",
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "random",
	rules: [],
};
const applyFx = (outcome: OutcomeSchema.Type[]) =>
	modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const origin = {
				scope: "board" as const,
				space: 1,
				position: {
					x: 0,
					y: 0,
				},
			};
			const resolved = yield* resolveOutcomeTableFx({
				ownerItemId: "test-outcome-owner",
				origin,
				outcome: OutcomeTableSchema.parse({
					set: [
						{
							weight: 1,
							rules: [],
							roll: [
								{
									type: "guaranteed",
									outcome,
								},
							],
						},
					],
				}),
			});
			const [placement, next] = yield* applyOutcomeTableFx({
				outcome: resolved,
				runtime,
			});
			return [
				next,
				next,
				[
					{
						type: "outcome:applied",
						originItemId: "source",
						effects: placement.effects,
					},
				] as const,
			] as const;
		}),
	);

it("resets only the outcome origin space, preserving authored item/reset order and final spawn facts", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			const before = yield* startFx();
			const after = yield* applyFx([
				item,
				template,
				item,
			]);
			const store = yield* RuntimeStoreFx;
			return {
				before,
				after,
				transition: yield* store.read,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.after.currentSpace).toBe(0);
	const untouched = result.before.items.find(
		(entry) => entry.location.scope === "board" && entry.location.space === 0,
	)!;
	expect(result.after.items.find((entry) => entry.id === untouched.id)).toBe(untouched);
	expect(result.after.templateUidBySpace).toEqual({
		0: "start",
		1: "next",
	});
	expect(
		result.after.items
			.filter((entry) => entry.location.scope === "board" && entry.location.space === 1)
			.map((entry) => entry.item.uid),
	).toEqual([
		"lens",
		"log",
	]);
	expect(
		result.transition.events.filter((event) => event.type === "board:template-applied"),
	).toEqual([
		{
			type: "board:template-applied",
			space: 1,
			templateUid: "next",
		},
	]);
	const spawns = result.transition.events.filter((event) => event.type === "item:spawned");
	expect(spawns).toHaveLength(1);
	expect(result.after.items.some((entry) => entry.id === spawns[0]?.itemId)).toBe(true);
});

it("creates and replaces explicit target spaces without moving the player or retargeting later outcomes", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* startFx();
			const after = yield* applyFx([
				{
					...template,
					space: 0,
				},
				{
					...template,
					space: 2,
				},
				item,
			]);
			return {
				after,
				transition: yield* (yield* RuntimeStoreFx).read,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.after.currentSpace).toBe(0);
	expect(result.after.templateUidBySpace).toEqual({
		0: "next",
		1: "start",
		2: "next",
	});
	expect(
		result.after.items
			.filter((entry) => entry.location.scope === "board")
			.map((entry) => [
				entry.location.scope === "board" ? entry.location.space : undefined,
				entry.item.uid,
			]),
	).toEqual(
		expect.arrayContaining([
			[
				0,
				"lens",
			],
			[
				1,
				"log",
			],
			[
				2,
				"lens",
			],
		]),
	);
	expect(
		result.transition.events.filter((event) => event.type === "board:template-applied"),
	).toEqual([
		{
			type: "board:template-applied",
			space: 0,
			templateUid: "next",
		},
		{
			type: "board:template-applied",
			space: 2,
			templateUid: "next",
		},
	]);
});

it("missing template rolls back earlier outcome placements and publishes no reset", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* startFx();
			const store = yield* RuntimeStoreFx;
			const before = yield* store.read;
			const failed = yield* Effect.result(
				applyFx([
					item,
					{
						...template,
						templateUid: "missing",
					},
				]),
			);
			return {
				before,
				failed,
				after: yield* store.read,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(Result.isFailure(result.failed)).toBe(true);
	expect(result.after).toBe(result.before);
});
