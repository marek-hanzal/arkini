import { Effect } from "effect";
import { expect, it } from "vitest";

import {
	inputRuntimeTestConfig,
	sourceLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { checkRuntimeDeliveriesFn } from "~/production-delivery/fn/checkRuntimeDeliveriesFn";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";

const workshop = inputRuntimeTestConfig.items.workshop;
if (workshop.type !== "producer") throw new Error("Expected producer fixture.");
const config = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...workshop,
			lines: [
				"b:c",
				"c",
			].map((id) => ({
				...workshop.lines[0],
				id,
			})),
		},
	},
});

const createDeliveriesFx = Effect.gen(function* () {
	for (const [id, itemId, x] of [
		[
			"runtime:a",
			"workshop",
			0,
		],
		[
			"runtime:a:b",
			"workshop",
			1,
		],
		[
			"water:first",
			"water",
			2,
		],
		[
			"water:second",
			"water",
			3,
		],
	] as const) {
		yield* spawnItemFx({
			id,
			itemId,
			location: sourceLocation(x),
			quantity: itemId === "water" ? 4 : 1,
		});
	}
	const runtime = yield* readRuntimeFx();
	return {
		...runtime,
		items: runtime.items.map((item) => {
			if (item.item.id !== "water") return item;
			const first = item.id === "water:first";
			return {
				...item,
				location: {
					scope: "delivery" as const,
					phase: "outbound" as const,
					generation: 0,
					origin: sourceLocation(first ? 2 : 3),
					remainingDurationMs: 100,
					target: {
						kind: "line-input" as const,
						ownerItemId: first ? "runtime:a" : "runtime:a:b",
						lineId: first ? "b:c" : "c",
						input: [
							{
								inputIndex: 0,
								quantity: 3,
							},
						],
					},
				},
			};
		}),
	} satisfies RuntimeSchema.Type;
});

it("keeps distinct owner and line identities independent during delivery reconciliation", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			const runtime = yield* createDeliveriesFx;
			expect(
				checkRuntimeDeliveriesFn({
					runtime,
				}),
			).toEqual([]);
			const reconciled = yield* reconcileOutboundDeliveriesRuntimeFx({
				runtime,
			});
			return {
				runtime,
				reconciled,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.reconciled).toBe(result.runtime);
});

it("validates every distinct slot when owner and line identifiers contain separators", () => {
	const issues = Effect.runSync(
		Effect.gen(function* () {
			const initial = yield* createDeliveriesFx;
			const runtime: RuntimeSchema.Type = {
				...initial,
				items: initial.items.map((item) =>
					item.id === "water:second" &&
					item.location.scope === "delivery" &&
					item.location.phase === "outbound"
						? {
								...item,
								location: {
									...item.location,
									target: {
										...item.location.target,
										input: [
											{
												inputIndex: 0,
												quantity: 4,
											},
										],
									},
								},
							}
						: item,
				),
			};
			return checkRuntimeDeliveriesFn({
				runtime,
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(issues).toMatchObject([
		{
			itemIds: [
				"water:second",
			],
			reason: "claims-exceed-target",
		},
	]);
});
