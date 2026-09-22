import { Effect } from "effect";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import {
	createMergeTestConfig,
	weightedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";

export const createConfigFn = (small = false) =>
	createMergeTestConfig({
		board: {
			width: small ? 4 : 20,
			height: small ? 1 : 20,
		},
		rule: {
			target: {
				type: "item",
				itemId: "target",
			},
			action: "use",
			effect: "keep",
			outcome: weightedMergeOutput(),
		},
	});
export const initialState = StateSchema.parse({
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace: 0,
	jobs: [],
	jobQueue: [],
	items: [
		{
			id: "reusable-source",
			itemId: "source",

			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		},
		{
			id: "stable-target",
			itemId: "target",

			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
		},
	],
});
export const mergeFx = () =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const source = before.items.find((item) => item.id === "reusable-source")!;
		const target = before.items.find((item) => item.id === "stable-target")!;
		yield* mergeItemsFx({
			sourceItemId: source.id,
			sourceRevision: source.revision,
			targetItemId: target.id,
			targetRevision: target.revision,
		});
		const after = yield* readRuntimeFx();
		return after.items
			.filter((item) => !before.items.some((previous) => previous.id === item.id))
			.map((item) => item.item.id);
	});
export const repeatFx = (count: number) =>
	Effect.forEach(
		Array.from({
			length: count,
		}),
		() => mergeFx(),
	);
export const saveFx = () =>
	Effect.gen(function* () {
		const runtime = yield* readRuntimeFx();
		return StateSchema.parse(
			JSON.parse(
				JSON.stringify(
					fromRuntimeFn({
						runtime,
					}),
				),
			),
		);
	});
export const removeOutputsFx = () =>
	Effect.gen(function* () {
		const runtime = yield* readRuntimeFx();
		for (const item of runtime.items.filter((item) => item.item.id.startsWith("output:"))) {
			yield* removeRuntimeItemForTestFx({
				itemId: item.id,
				revision: item.revision,
			});
		}
	});
