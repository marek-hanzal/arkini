import { Effect } from "effect";
import { expect, it } from "vitest";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readItemLineInputsFx } from "~/item-detail-read/fx/readItemLineInputsFx";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

const base = lineRunRuntime({
	water: 2,
});
const originalOwner = base.items[0];
const line: LineSchema.Type = {
	...originalOwner.item.lines[0],
	rules: [],
	input: [
		{
			type: "units",
			units: {
				from: "target",
				cost: 1,
			},
			query: {
				distance: "close",
				selector: {
					type: "item",
					itemUid: "water",
				},
			},
		},
	],
};
const owner: RuntimeItemSchema.Type = {
	...originalOwner,
	item: {
		...originalOwner.item,
		lines: [
			line,
		],
	},
};
const payer: RuntimeItemSchema.Type = {
	...base.items[1],
	id: "unit-payer",
	item: {
		...base.items[1].item,
		units: {
			amount: 1,
		},
	},
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 1,
			y: 0,
		},
	},
};
const readFn = (runtime: RuntimeSchema.Type) =>
	Effect.runSync(
		readItemLineInputsFx({
			ownerItemId: owner.id,
			line,
			runtime,
		}).pipe(Effect.provideService(GameConfigFx, lineRunTestConfig)),
	);

it("shows unit payers and excludes missing, reserved, exhausted, and out-of-reach identities", () => {
	const runtime = {
		...base,
		items: [
			owner,
			payer,
		],
	};
	expect(readFn(runtime)[0]).toMatchObject({
		type: "units",
		itemUid: "water",
		filled: 1,
		available: true,
		committed: false,
		canWithdraw: false,
		canAutofill: false,
	});
	const unavailable: Array<readonly RuntimeItemSchema.Type[]> = [
		[],
		[
			{
				...payer,
				remainingUnits: 0,
			},
		],
		[
			{
				...payer,
				location: {
					scope: "reserved",
					jobId: "other-job",
					inputIndex: 0,
				},
			},
		],
		[
			{
				...payer,
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 4,
						y: 0,
					},
				},
			},
		],
	];
	for (const items of unavailable) {
		expect(
			readFn({
				...base,
				items: [
					owner,
					...items,
				],
			})[0],
		).toMatchObject({
			itemUid: "water",
			filled: 0,
			available: false,
			availableQuantity: 0,
			committed: false,
		});
	}
});

it("does not promise the same unit twice across a line's input requirements", () => {
	const repeated: LineSchema.Type = {
		...line,
		input: [
			line.input[0],
			line.input[0],
		],
	};
	const inputs = readFn({
		...base,
		items: [
			{
				...owner,
				item: {
					...owner.item,
					lines: [
						repeated,
					],
				},
			},
			payer,
		],
	});
	expect(inputs.map((input) => input.available)).toEqual([
		true,
		false,
	]);
});

it("shows a running job's paid requirement as committed", () => {
	const runtime: RuntimeSchema.Type = {
		...base,
		items: [
			owner,
		],
		jobs: [
			{
				id: "active",
				ownerItemId: owner.id,
				lineUid: line.uid,
				durationMs: 1000,
				remainingMs: 500,
			},
		],
	};
	expect(readFn(runtime)[0]).toMatchObject({
		filled: 1,
		committed: true,
	});
});
