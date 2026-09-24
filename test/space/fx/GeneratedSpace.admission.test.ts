import { Effect } from "effect";
import { expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	generatedSpaceTestConfigFn,
	generatedSpaceStateFn,
} from "~test/space/support/generatedSpaceTestConfig";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";

it("room destruction during first material admission discards later allocations and terminates the producer start", () => {
	const config = generatedSpaceTestConfigFn();
	config.items.token!.lines = [
		LineSchema.parse({
			uid: "consume-buffers",
			default: true,
			title: "Consume",
			description: "Consume",
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
							itemUid: "upgrade",
						},
					},
					quantity: {
						min: 2,
						max: 2,
					},
				},
			],
		}),
	];
	config.items.upgrade!.lines = [
		LineSchema.parse({
			uid: "stash",
			title: "Stash",
			description: "Stash",
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
							itemUid: "warehouse",
						},
					},
					quantity: {
						min: 1,
						max: 1,
					},
				},
			],
		}),
	];
	const state = generatedSpaceStateFn([]);
	state.currentSpace = 1;
	state.previousSpace = 0;
	state.templateUidBySpace = {
		1: "room",
	};
	state.items = [
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
			id: "first-material",
			itemUid: "upgrade",
			location: {
				scope: "input",
				ownerItemId: "producer",
				lineUid: "consume-buffers",
				inputIndex: 0,
			},
		},
		{
			id: "second-material",
			itemUid: "upgrade",
			location: {
				scope: "input",
				ownerItemId: "producer",
				lineUid: "consume-buffers",
				inputIndex: 0,
			},
		},
		{
			id: "container",
			itemUid: "warehouse",
			generatedSpace: 1,
			location: {
				scope: "input",
				ownerItemId: "first-material",
				lineUid: "stash",
				inputIndex: 0,
			},
		},
	];
	const result = Effect.runSync(
		Effect.gen(function* () {
			yield* enqueueDefaultLineFx({
				ownerItemId: "producer",
			});
			yield* runTickRuntimeByFx({
				elapsedMs: 100,
			});
			const settled = yield* readRuntimeFx();
			yield* runTickRuntimeByFx({
				elapsedMs: 1000,
			});
			return {
				settled,
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
	expect(result.later.items).toEqual([]);
});
