import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { expireItemRuntimeFx } from "~/item-expiry/fx/expireItemRuntimeFx";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";

const origin = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};
const itemOutcome = {
	type: "item",
	itemUid: "reward",
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
} as const;
const tableFn = (outcome: readonly OutcomeSchema.Type[]) =>
	OutcomeTableSchema.parse({
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
	});
const spaceFn = (space: number): OutcomeSchema.Type => ({
	type: "space",
	space,
	rules: [],
});
const definitionFn = (id: string) => ({
	uid: id,

	title: id,
	artwork: {
		scale: 1,
		default: [
			id,
		],
	},
	lines: [],
});
const configFn = (outcome: OutcomeTableSchema.Type, width = 3) =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "outcome-settlement",
			title: "Outcomes",
			board: {
				width,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
			spaces: [],
		},
		items: {
			owner: {
				...definitionFn("owner"),
				lines: [
					{
						id: "run",
						title: "Run",
						description: "Run",
						default: true,
						show: true,
						enable: true,
						runtimeMs: 0,
						input: [
							{
								type: "simple",
							},
						],
						rules: [],
						outcome,
					},
				],
			},
			reward: definitionFn("reward"),
		},
	});
const spawnOwnerFx = () =>
	spawnItemFx({
		id: "owner-live",
		itemUid: "owner",
		location: origin,
	});

const settleFx = (outcome: OutcomeTableSchema.Type) =>
	modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const resolved = yield* resolveOutcomeTableFx({
				ownerItemId: "owner-live",
				origin,
				outcome,
			});
			const [placement, next] = yield* applyOutcomeTableFx({
				outcome: resolved,
				runtime,
			});
			return [
				placement,
				next,
			] as const;
		}),
	);

describe("Outcome settlement", () => {
	it("retains the complete mixed roll and owner origin while only publishing the last Space", () => {
		const outcome = tableFn([
			spaceFn(1),
			{
				...itemOutcome,
				rules: [],
			},
			spaceFn(2),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const resolved = yield* resolveOutcomeTableFx({
					ownerItemId: "owner-live",
					origin,
					outcome,
				});
				yield* settleFx(outcome);
				return {
					resolved,
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: configFn(outcome),
				}),
			),
		);
		expect(result.resolved.roll).toEqual([
			{
				ownerItemId: "owner-live",
				origin,
				outcome: [
					{
						type: "space",
						space: 1,
					},
					{
						type: "item",
						itemUid: "reward",
						quantity: 1,
						placement: "drop",
					},
					{
						type: "space",
						space: 2,
					},
				],
			},
		]);
		expect(result.transition.runtime.currentSpace).toBe(2);
		expect(
			result.transition.runtime.items.find((item) => item.item.uid === "reward")?.location,
		).toMatchObject({
			scope: "board",
			space: 0,
		});
		expect(result.transition.events).toEqual([
			{
				type: "current-space:changed",
				previousSpace: 0,
				currentSpace: 2,
			},
		]);
	});

	it("rolls navigation back with failed item placement, including repeated retries", () => {
		const outcome = tableFn([
			spaceFn(1),
			{
				...itemOutcome,
				rules: [],
			},
			spaceFn(2),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const before = yield* readRuntimeFx();
				const first = yield* settleFx(outcome).pipe(Effect.result);
				const second = yield* settleFx(outcome).pipe(Effect.result);
				return {
					before,
					after: yield* readRuntimeFx(),
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config: configFn(outcome, 1),
				}),
			),
		);
		expect(Result.isFailure(result.first)).toBe(true);
		expect(Result.isFailure(result.second)).toBe(true);
		expect(result.after).toEqual(result.before);
	});

	it("uses the ordinary default queue and completes Space from a non-current Board", () => {
		const outcome = tableFn([
			spaceFn(2),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* enqueueDefaultLineFx({
					ownerItemId: "owner-live",
				});
				const queued = yield* readRuntimeFx();
				yield* modifyRuntimeFx((runtime) =>
					Effect.succeed([
						undefined,
						{
							...runtime,
							currentSpace: 1,
						},
					] as const),
				);
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return {
					queued,
					after: yield* readRuntimeFx(),
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: configFn(outcome),
				}),
			),
		);
		expect(result.queued.currentSpace).toBe(0);
		expect(result.queued.jobQueue).toHaveLength(1);
		expect(result.queued.jobs).toHaveLength(0);
		expect(result.after.currentSpace).toBe(2);
		expect(result.after.jobQueue).toHaveLength(0);
		expect(result.after.jobs).toHaveLength(0);
		expect(
			result.transition.events.filter((event) => event.type === "current-space:changed"),
		).toEqual([
			{
				type: "current-space:changed",
				previousSpace: 1,
				currentSpace: 2,
			},
		]);
	});

	it("Space-only expiry still reports disappearance and uses the captured removed-owner origin", () => {
		const outcome = tableFn([
			spaceFn(2),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnOwnerFx();
				yield* modifyRuntimeFx((runtime) =>
					Effect.gen(function* () {
						const expired = yield* expireItemRuntimeFx({
							item: owner,
							origin,
							outcome,
							randomSeed: "expiry",
							runtime,
						});
						return [
							undefined,
							expired.runtime,
							expired.events,
						] as const;
					}),
				);
				return yield* (yield* CommittedTransitionsFx).read;
			}).pipe(
				useGameFx({
					config: configFn(outcome),
				}),
			),
		);
		expect(result.runtime.items).toHaveLength(0);
		expect(result.runtime.currentSpace).toBe(2);
		expect(result.events.map((event) => event.type)).toContain("item:disappeared");
	});

	it("reports disappearance when a later template erases the expiry Item output", () => {
		const outcome = tableFn([
			{
				...itemOutcome,
				rules: [],
			},
			{
				type: "template",
				templateUid: "empty",
				rules: [],
			},
		]);
		const config = {
			...configFn(outcome),
			templates: [
				{
					uid: "empty",
					title: "Empty",
					width: 3,
					height: 1,
					board: [],
				},
			],
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnOwnerFx();
				yield* modifyRuntimeFx((runtime) =>
					Effect.gen(function* () {
						const expired = yield* expireItemRuntimeFx({
							item: owner,
							origin,
							outcome,
							randomSeed: "expiry-template",
							runtime,
						});
						return [
							undefined,
							expired.runtime,
							expired.events,
						] as const;
					}),
				);
				return yield* (yield* CommittedTransitionsFx).read;
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.runtime.items).toHaveLength(0);
		expect(result.events.map((event) => event.type)).toContain("board:template-applied");
		expect(result.events.map((event) => event.type)).toContain("item:disappeared");
		expect(result.events.map((event) => event.type)).not.toContain("item:spawned");
		expect(
			result.events.some(
				(event) => event.type === "item:removed" && event.snapshot.item.uid === "reward",
			),
		).toBe(false);
	});

	it("does not publish a round-trip Space event or apply rejected Space outcomes", () => {
		const outcome = tableFn([
			spaceFn(2),
			{
				type: "space",
				space: 3,
				rules: [
					{
						type: "enable",
						when: [
							{
								type: "exists",
								query: {
									distance: "far",
									selector: {
										type: "item",
										itemUid: "reward",
									},
								},
							},
						],
					},
				],
			},
			spaceFn(0),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* settleFx(outcome);
				return yield* (yield* CommittedTransitionsFx).read;
			}).pipe(
				useGameFx({
					config: configFn(outcome),
				}),
			),
		);
		expect(result.runtime.currentSpace).toBe(0);
		expect(result.events.filter((event) => event.type === "current-space:changed")).toEqual([]);
	});
});
