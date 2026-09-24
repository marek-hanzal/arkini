import { Effect } from "effect";
import { expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	inventoryTestConfigFn,
	inventoryStateFn,
	mergeInventoryItemsFx,
} from "~test/space/support/inventoryTestConfig";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";

it("consuming a container destroys its interior producer and detached job reservations without output or returns", () => {
	const config = inventoryTestConfigFn();
	config.items.token!.lines = [
		LineSchema.parse({
			uid: "consume-container",
			default: true,
			title: "Consume",
			description: "Consume",
			runtimeMs: 100,
			input: [
				{
					type: "materials",
					mode: "consume",
					query: {
						distance: "far",
						selector: {
							type: "item",
							itemUid: "warehouse",
						},
					},
					quantity: {
						min: 1,
						max: 1,
					},
				},
				{
					type: "materials",
					mode: "reserve",
					query: {
						distance: "far",
						selector: {
							type: "item",
							itemUid: "upgrade",
						},
					},
					quantity: {
						min: 1,
						max: 1,
					},
				},
			],
			rules: [],
			outcome: {
				set: [
					{
						rules: [],
						roll: [
							{
								type: "guaranteed",
								outcome: [
									{
										type: "item",
										itemUid: "token",
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
		}),
	];
	const state = inventoryStateFn([]);
	state.currentSpace = 1;
	state.previousSpace = 0;
	state.templateUidBySpace = {
		1: "room",
	};
	state.jobs = [
		{
			id: "work",
			ownerItemId: "producer",
			lineUid: "consume-container",
			durationMs: 100,
			remainingMs: 0,
		},
	];
	state.items = [
		{
			id: "container",
			itemUid: "warehouse",
			inventory: 1,
			location: {
				scope: "job",
				jobId: "work",
				inputIndex: 0,
			},
		},
		{
			id: "producer",
			itemUid: "token",
			location: {
				scope: "board",
				space: 1,
				position: {
					x: 0,
					y: 0,
				},
			},
		},
		{
			id: "reserved",
			itemUid: "upgrade",
			location: {
				scope: "reserved",
				jobId: "work",
				inputIndex: 1,
			},
		},
	];
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* runTickRuntimeByFx({
				elapsedMs: 100,
			});
			const settled = yield* readRuntimeFx();
			const transition = yield* (yield* CommittedTransitionsFx).read;
			yield* runTickRuntimeByFx({
				elapsedMs: 1000,
			});
			return {
				settled,
				transition,
				later: yield* readRuntimeFx(),
			};
		}).pipe(
			useGameFx({
				config,
				state,
			}),
		),
	);
	expect(result.settled.items).toEqual([]);
	expect(result.settled.jobs).toEqual([]);
	expect(result.settled.jobQueue).toEqual([]);
	expect(result.settled.templateUidBySpace).toEqual({});
	expect(result.settled.currentSpace).toBe(0);
	expect(result.settled.previousSpace).not.toBe(1);
	expect(result.transition.events.some((event) => event.type === "item:placed")).toBe(false);
	expect(result.later.items).toEqual([]);
});

it("removing a container releases its passive input but destroys the room after the owner was temporarily detached", () => {
	const config = inventoryTestConfigFn();
	config.items.warehouse!.lines.push(
		LineSchema.parse({
			uid: "storage",
			title: "Storage",
			description: "Storage",
			runtimeMs: 100,
			rules: [],
			input: [
				{
					type: "materials",
					mode: "consume",
					query: {
						distance: "far",
						selector: {
							type: "item",
							itemUid: "token",
						},
					},
					quantity: {
						min: 1,
						max: 1,
					},
				},
			],
		}),
	);
	config.items.upgrade!.merge = [
		{
			action: "consume",
			target: {
				type: "item",
				itemUid: "warehouse",
			},
			effect: "remove",
		},
	];
	const state = inventoryStateFn([
		{
			id: "first",
			itemUid: "warehouse",
			x: 0,
		},
		{
			id: "tool",
			itemUid: "upgrade",
			x: 1,
		},
	]);
	state.items[0]!.inventory = 1;
	state.templateUidBySpace = {
		1: "room",
	};
	state.items.push(
		{
			id: "buffered",
			itemUid: "token",
			location: {
				scope: "input",
				ownerItemId: "first",
				lineUid: "storage",
				inputIndex: 0,
			},
		},
		{
			id: "interior",
			itemUid: "token",
			location: {
				scope: "board",
				space: 1,
				position: {
					x: 0,
					y: 0,
				},
			},
		},
	);
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* mergeInventoryItemsFx("tool", "first");
			return yield* readRuntimeFx();
		}).pipe(
			useGameFx({
				config,
				state,
			}),
		),
	);
	expect(result.items.map((item) => item.id)).toEqual([
		"buffered",
	]);
	expect(result.items[0]!.location).toEqual({
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	});
	expect(result.templateUidBySpace).toEqual({});
});
