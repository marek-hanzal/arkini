import { Effect } from "effect";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { removeCheatItemFx } from "~/game-cheat/fx/removeCheatItemFx";

const itemFn = (uid: string) => ({
	uid,
	title: uid,
	description: uid,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${uid}`,
		],
	},
	lines: [],
	maxQueueSize: 1,
});

export const inventoryTestConfigFn = () =>
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "inventory-test",
			title: "Inventory",
			board: {
				width: 6,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
			spaces: [],
		},
		templates: [
			{
				uid: "room",
				title: "Room",
				width: 2,
				height: 1,
				board: [
					{
						itemUid: "token",
						x: 0,
						y: 0,
					},
				],
			},
		],
		items: {
			token: itemFn("token"),
			warehouse: {
				...itemFn("warehouse"),
				lines: [
					{
						uid: "enter",
						default: true,
						title: "Enter",
						description: "Enter",
						runtimeMs: 0,
						input: [],
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
													type: "space",
													space: {
														type: "inventory",
														templateUid: "room",
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
				],
				merge: [
					{
						action: "space",
						space: {
							type: "inventory",
							templateUid: "room",
						},
						effect: "keep",
					},
				],
			},
			upgrade: {
				...itemFn("upgrade"),
				merge: [
					{
						action: "consume",
						target: {
							type: "item",
							itemUid: "warehouse",
						},
						effect: "replace",
						result: "warehouse",
					},
				],
			},
		},
	});

export const inventoryStateFn = (
	items = [
		{
			id: "first",
			itemUid: "warehouse",
			x: 0,
		},
		{
			id: "second",
			itemUid: "warehouse",
			x: 1,
		},
		{
			id: "cargo",
			itemUid: "token",
			x: 2,
		},
	],
) =>
	StateSchema.parse({
		cheats: {
			enabled: true,
			everEnabled: true,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: items.map(({ id, itemUid, x }) => ({
			id,
			itemUid,
			location: {
				scope: "board",
				space: 0,
				position: {
					x,
					y: 0,
				},
			},
		})),
		jobs: [],
		jobQueue: [],
	});

export const enterInventoryFx = (ownerItemId: string) =>
	Effect.gen(function* () {
		yield* enqueueDefaultLineFx({
			ownerItemId,
		});
		yield* runTickRuntimeByFx({
			elapsedMs: 100,
		});
		return yield* readRuntimeFx();
	});

export const mergeInventoryItemsFx = (sourceItemId: string, targetItemId: string) =>
	Effect.gen(function* () {
		const runtime = yield* readRuntimeFx();
		const source = runtime.items.find((item) => item.id === sourceItemId)!;
		const target = runtime.items.find((item) => item.id === targetItemId)!;
		return yield* mergeItemsFx({
			sourceItemId,
			targetItemId,
			sourceRevision: source.revision,
			targetRevision: target.revision,
		});
	});

export const removeInventoryItemFx = (itemId: string) =>
	Effect.gen(function* () {
		const runtime = yield* readRuntimeFx();
		const item = runtime.items.find((candidate) => candidate.id === itemId)!;
		yield* removeCheatItemFx({
			itemId,
			revision: item.revision,
		});
		return yield* readRuntimeFx();
	});
