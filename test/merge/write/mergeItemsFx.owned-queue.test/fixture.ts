import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { createMergeTestConfig } from "~test/merge/support/createMergeTestConfig";

const base = createMergeTestConfig({
	rule: {
		action: "consume",
		effect: "keep",
		target: {
			itemId: "target",
			type: "item",
		},
	},
});

const producer = (id: string, item: (typeof base.items)[string], inputItemId?: string) => ({
	...item,
	description: id,
	id,
	lines: [
		{
			description: `line:${id}`,
			id: `line:${id}`,
			input:
				inputItemId === undefined
					? [
							{
								type: "simple" as const,
							},
						]
					: [
							{
								capacity: 1,
								mode: "reserve" as const,
								quantity: {
									max: 1,
									min: 1,
								},
								selector: {
									itemId: inputItemId,
									type: "item" as const,
								},
								type: "materials" as const,
							},
						],
			rules: [],
			runtimeMs: 1_000,
			title: `line:${id}`,
		},
	],
	maxQueueSize: 2,
	title: id,
	type: "producer" as const,
	uid: id,
});

const config = GameConfigSchema.parse({
	...base,
	items: {
		...base.items,
		child: producer("child", base.items.output),
		source: producer("source", base.items.source, "child"),
	},
});

const boardItem = (id: "source" | "target", x: number) =>
	({
		id: `runtime:${id}`,
		item: config.items[id],
		location: {
			position: {
				x,
				y: 0,
			},
			scope: "board" as const,
			space: 0,
		},
		quantity: 1,
		revision: `revision:${id}`,
	}) satisfies BoardRuntimeItemSchema.Type;

const source = boardItem("source", 0);
const target = boardItem("target", 1);
const runtime = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [
		source,
		target,
		{
			id: "runtime:unrelated",
			item: config.items.child,
			location: {
				position: {
					x: 2,
					y: 0,
				},
				scope: "board",
				space: 0,
			},
			quantity: 1,
			revision: "revision:unrelated",
		},
		{
			id: "runtime:child",
			item: config.items.child,
			location: {
				inputIndex: 0,
				lineId: "line:source",
				ownerItemId: "runtime:source",
				scope: "input" as const,
			},
			quantity: 1,
			revision: "revision:child",
		},
	],
	jobQueue: [
		{
			id: "request:unrelated",
			lineId: "line:child",
			ownerItemId: "runtime:unrelated",
		},
		{
			id: "request:child",
			lineId: "line:child",
			ownerItemId: "runtime:child",
		},
	],
	jobs: [],

	defaultLineByOwnerItemId: {},
} satisfies RuntimeSchema.Type;

const rule = config.items.source.merge?.[0];
if (rule === undefined) throw new Error("Expected source merge rule.");
const serviceState = {
	cheats: runtime.cheats,
	currentSpace: 0,
	items: [
		{
			id: source.id,
			itemId: source.item.id,
			location: source.location,
			quantity: 1,
		},
		{
			id: target.id,
			itemId: target.item.id,
			location: target.location,
			quantity: 1,
		},
	],
	jobs: [],

	jobQueue: [],
	defaultLineByOwnerItemId: {},
} satisfies StateSchema.Type;

export const queuedOwnedInputMergeFixture = {
	config,
	rule,
	runtime,
	serviceState,
	source,
	target,
};
