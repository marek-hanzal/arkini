import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";

const makeConfig = (
	rule: MergeSchema.Type = {
		action: "space",
		space: 7,
		effect: "keep",
	},
) => {
	const config = createMergeTestConfig({
		rule: {
			action: "consume",
			target: {
				type: "item",
				itemUid: "target",
			},
			effect: "keep",
		},
	});
	delete config.items.source.merge;
	config.items.target.merge = [
		rule,
	];
	return config;
};

const boardItem = (id: string, itemId: string, x: number, space = 0, y = 0) => ({
	id,
	itemUid: itemId,
	location: {
		scope: "board" as const,
		space,
		position: {
			x,
			y,
		},
	},
});

const makeState = (): StateSchema.Type => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace: 0,
	templateUidBySpace: {},
	items: [
		boardItem("runtime:source", "source", 0),
		boardItem("runtime:target", "target", 3),
	],
	jobQueue: [],
	jobs: [],
});

const attemptFx = (drop = false) =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const source = before.items.find((item) => item.id === "runtime:source")!;
		const target = before.items.find((item) => item.id === "runtime:target")!;
		if (source.location.scope !== "board" || target.location.scope !== "board") {
			return yield* Effect.die(new Error("Expected Board participants"));
		}
		const attempt = drop
			? yield* Effect.result(
					dropItemFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation: source.location,
						target: {
							kind: "slot",
							location: target.location,
							occupant: {
								itemId: target.id,
								revision: target.revision,
							},
						},
					}),
				)
			: yield* Effect.result(
					mergeItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: target.id,
						targetRevision: target.revision,
					}),
				);
		return {
			before,
			after: yield* readRuntimeFx(),
			attempt,
		};
	});

describe("receiver-owned Space merge", () => {
	it("rejects Previous Space without history before target effects or outcomes and never swaps", () => {
		const result = Effect.runSync(
			attemptFx(true).pipe(
				useGameFx({
					config: makeConfig({
						action: "space",
						space: "previous",
						effect: "replace",
						result: "result",
						outcome: guaranteedMergeOutput(),
					}),
					state: makeState(),
				}),
			),
		);
		expect(result.attempt).toMatchObject({
			_tag: "Success",
			success: {
				kind: "reject",
				reason: "blocked",
			},
		});
		expect(result.after).toBe(result.before);
	});

	it.each([
		7,
		"previous",
	] as const)("transports to %s with lifetime and units, without player navigation", (space) => {
		const config = makeConfig({
			action: "space",
			space,
			effect: "keep",
		});
		config.meta.board = {
			width: 8,
			height: 4,
		};
		config.items.source.units = {
			amount: 10,
		};
		config.items.source.clock = {
			durationMs: 100_000,
			enable: true,
			rules: [],
		};
		const state = makeState();
		state.previousSpace = 7;
		state.items[0]!.mergeSequence = 9;
		state.items[1]!.mergeSequence = 5;
		state.items[0]!.remainingUnits = 4;
		state.items[0]!.schedule = {
			remainingDurationMs: 12_345,
		};
		const result = Effect.runSync(
			attemptFx(true).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);
		expect(result.attempt._tag === "Success").toBe(true);
		expect(result.after.items.find((item) => item.id === "runtime:source")).toMatchObject({
			item: {
				uid: "source",
			},
			mergeSequence: 9,
			remainingUnits: 4,
			schedule: {
				remainingDurationMs: 12_345,
			},
			location: {
				scope: "board",
				space: 7,
				position: {
					x: 4,
					y: 2,
				},
			},
		});
		expect(result.after.currentSpace).toBe(0);
		expect(result.after.previousSpace).toBe(7);
		expect(result.after.items.find((item) => item.id === "runtime:target")?.mergeSequence).toBe(
			6,
		);
	});

	it("keeps replacement and generated items at the receiver origin while transporting the source", () => {
		const config = makeConfig({
			action: "space",
			space: 7,
			effect: "replace",
			result: "result",
			outcome: guaranteedMergeOutput(),
		});
		const result = Effect.runSync(
			attemptFx().pipe(
				useGameFx({
					config,
					state: makeState(),
				}),
			),
		);
		expect(result.attempt._tag === "Success").toBe(true);
		expect(result.after.items.find((item) => item.id === "runtime:target")).toMatchObject({
			item: {
				uid: "result",
			},
			location: {
				space: 0,
				position: {
					x: 3,
					y: 0,
				},
			},
		});
		const output = result.after.items.find((item) => item.item.uid === "output");
		expect(output?.location).toMatchObject({
			scope: "board",
			space: 0,
		});
		if (output?.location.scope === "board") {
			expect(
				Math.abs(output.location.position.x - 3) + Math.abs(output.location.position.y),
			).toBe(1);
		}
		expect(
			result.after.items.find((item) => item.id === "runtime:source")?.location,
		).toMatchObject({
			space: 7,
		});
	});

	it("removes the receiver and emits its outcome from the vacated receiver cell", () => {
		const config = makeConfig({
			action: "space",
			space: 7,
			effect: "remove",
			outcome: guaranteedMergeOutput(),
		});
		const result = Effect.runSync(
			attemptFx().pipe(
				useGameFx({
					config,
					state: makeState(),
				}),
			),
		);
		expect(result.attempt._tag === "Success").toBe(true);
		expect(result.after.items.some((item) => item.id === "runtime:target")).toBe(false);
		expect(result.after.items.find((item) => item.item.uid === "output")?.location).toEqual({
			scope: "board",
			space: 0,
			position: {
				x: 3,
				y: 0,
			},
		});
	});

	it("spends a receiver unit independently of transport and explicit player navigation outcome", () => {
		const config = makeConfig({
			action: "space",
			space: 7,
			effect: "spend",
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
										type: "space",
										space: 9,
										rules: [],
									},
								],
							},
						],
					},
				],
			},
		});
		config.items.target.units = {
			amount: 3,
		};
		const result = Effect.runSync(
			attemptFx().pipe(
				useGameFx({
					config,
					state: makeState(),
				}),
			),
		);
		expect(result.attempt._tag === "Success").toBe(true);
		expect(
			result.after.items.find((item) => item.id === "runtime:target")?.remainingUnits,
		).toBe(2);
		expect(
			result.after.items.find((item) => item.id === "runtime:source")?.location,
		).toMatchObject({
			space: 7,
		});
		expect(result.after.currentSpace).toBe(9);
	});

	it("preserves buffered material ownership and queued production when its owner travels", () => {
		const config = makeConfig();
		config.items.source.lines = [
			{
				uid: "line",
				title: "line",
				description: "line",
				default: false,
				enable: true,
				show: true,
				clockWeight: 1,
				runtimeMs: 1_000,
				rules: [],
				input: [
					{
						type: "materials",
						query: {
							distance: "close",
							selector: {
								type: "item",
								itemUid: "blocker",
							},
						},
						quantity: {
							min: 1,
							max: 1,
						},
						mode: "reserve",
					},
				],
			},
		];
		const state = makeState();
		state.items.push({
			id: "buffer",
			itemUid: "blocker",
			location: {
				scope: "input",
				ownerItemId: "runtime:source",
				lineUid: "line",
				inputIndex: 0,
			},
		});
		state.jobQueue.push({
			id: "request",
			ownerItemId: "runtime:source",
			lineUid: "line",
		});
		const result = Effect.runSync(
			attemptFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);
		expect(result.attempt._tag === "Success").toBe(true);
		expect(result.after.items.find((item) => item.id === "buffer")).toEqual(
			result.before.items.find((item) => item.id === "buffer"),
		);
		expect(result.after.jobQueue).toEqual(result.before.jobQueue);
		expect(
			result.after.items.find((item) => item.id === "runtime:source")?.location,
		).toMatchObject({
			space: 7,
		});
	});

	it.each([
		7,
		"previous",
	] as const)(
		"rolls back successful transport and receiver replacement when later item outcomes cannot fit (%s)",
		(space) => {
			const config = makeConfig({
				action: "space",
				space,
				effect: "replace",
				result: "result",
				outcome: guaranteedMergeOutput({
					quantity: 9,
				}),
			});
			const result = Effect.runSync(
				attemptFx().pipe(
					useGameFx({
						config,
						state: {
							...makeState(),
							previousSpace: 7,
						},
					}),
				),
			);
			expect(result.attempt._tag === "Failure").toBe(true);
			expect(result.after).toEqual(result.before);
		},
	);

	it.each([
		7,
		"previous",
	] as const)(
		"rolls back transport, target replacement and outcomes when the destination is full (%s)",
		(space) => {
			const config = makeConfig({
				action: "space",
				space,
				effect: "replace",
				result: "result",
				outcome: guaranteedMergeOutput(),
			});
			const state = {
				...makeState(),
				previousSpace: 7,
			};
			for (let y = 0; y < 2; y++)
				for (let x = 0; x < 4; x++)
					state.items.push(boardItem(`blocker:${x}:${y}`, "blocker", x, 7, y));
			const result = Effect.runSync(
				attemptFx().pipe(
					useGameFx({
						config,
						state,
					}),
				),
			);
			expect(result.attempt._tag === "Failure").toBe(true);
			expect(result.after).toEqual(result.before);
		},
	);

	it("executes an explicit source merge instead of the receiver transport", () => {
		const config = makeConfig();
		config.items.source.merge = [
			{
				action: "consume",
				target: {
					type: "item",
					itemUid: "target",
				},
				effect: "keep",
			},
		];
		const result = Effect.runSync(
			attemptFx(true).pipe(
				useGameFx({
					config,
					state: makeState(),
				}),
			),
		);
		expect(result.attempt._tag === "Success").toBe(true);
		expect(result.after.items.some((item) => item.id === "runtime:source")).toBe(false);
	});

	it("does not fall back to receiver transport or swap when the explicit source merge rejects", () => {
		const config = makeConfig();
		config.items.source.units = {
			amount: 3,
		};
		config.items.source.merge = [
			{
				action: "use",
				target: {
					type: "item",
					itemUid: "target",
				},
				effect: "keep",
			},
		];
		const state = makeState();
		state.items[0]!.remainingUnits = 2;
		const result = Effect.runSync(
			attemptFx(true).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);
		expect(result.attempt._tag === "Success").toBe(true);
		if (result.attempt._tag === "Success")
			expect(result.attempt.success).toMatchObject({
				kind: "reject",
			});
		expect(result.after).toEqual(result.before);
	});
});
