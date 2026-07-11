import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { setItemFx } from "~/v1/runtime/fx/setItemFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { dropRuleFx } from "./dropRuleFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	meta: {
		id: "game:drop-rule-test",
		title: "Drop rule test",
		board: {
			width: 10,
			height: 10,
		},
		inventory: {
			width: 2,
			height: 2,
		},
	},
	start: {},
	categories: {},
	items: {
		source: {
			id: "source",
			title: "Source",
			description: "A drop origin.",
			asset: {
				source: [
					"asset:source",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
		permit: {
			id: "permit",
			title: "Permit",
			description: "An availability token.",
			asset: {
				source: [
					"asset:permit",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
	},
});

const permitQuery = {
	scope: "any" as const,
	selector: {
		type: "item" as const,
		itemId: "permit",
	},
};

describe("dropRuleFx", () => {
	it("treats enable as an all-condition gate and disable as an all-condition veto", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* setItemFx({
					item: {
						id: "origin",
						item: config.items.source,
						quantity: 1,
						scope: "board",
						x: 5,
						y: 5,
					} satisfies RuntimeItemSchema.Type,
					scope: "board",
					x: 5,
					y: 5,
				});
				yield* setItemFx({
					item: {
						id: "permit-stack",
						item: config.items.permit,
						quantity: 2,
						scope: "inventory",
						x: 0,
						y: 0,
					} satisfies RuntimeItemSchema.Type,
					scope: "inventory",
					x: 0,
					y: 0,
				});

				const enablePassed = yield* dropRuleFx({
					origin,
					rule: {
						type: "enable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
							{
								type: "count",
								query: permitQuery,
								count: 2,
							},
						],
					},
				});
				const enableRejected = yield* dropRuleFx({
					origin,
					rule: {
						type: "enable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
							{
								type: "count",
								query: permitQuery,
								count: 3,
							},
						],
					},
				});
				const disableApplied = yield* dropRuleFx({
					origin,
					rule: {
						type: "disable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
							{
								type: "count",
								query: permitQuery,
								count: 2,
							},
						],
					},
				});
				const disableIgnored = yield* dropRuleFx({
					origin,
					rule: {
						type: "disable",
						when: [
							{
								type: "exists",
								query: permitQuery,
							},
							{
								type: "count",
								query: permitQuery,
								count: 3,
							},
						],
					},
				});

				return {
					disableApplied,
					disableIgnored,
					enablePassed,
					enableRejected,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			disableApplied: false,
			disableIgnored: true,
			enablePassed: true,
			enableRejected: false,
		});
	});
});
