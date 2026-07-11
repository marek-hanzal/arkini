import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import type { DropSchema } from "~/v1/output/schema/DropSchema";
import type { RollSchema } from "~/v1/roll/schema/RollSchema";
import type { RollSetSchema } from "~/v1/roll/schema/RollSetSchema";
import { setItemFx } from "~/v1/runtime/fx/setItemFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { outputFx } from "./outputFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	meta: {
		id: "game:output-test",
		title: "Output test",
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
			description: "An output origin.",
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
	},
});

const createOriginFx = () => {
	return setItemFx({
		item: {
			id: "origin",
			item: config.items.source,
			quantity: 1,
			location: {
				scope: "board",
				position: {
					x: 5,
					y: 5,
				},
			},
		} satisfies RuntimeItemSchema.Type,
		location: {
			scope: "board",
			position: {
				x: 5,
				y: 5,
			},
		},
	});
};

const createDrop = ({
	itemId,
	placement = "drop",
	quantity = {
		type: "value",
		value: 1,
	},
	rules = [],
}: {
	itemId: string;
	placement?: DropSchema.Type["placement"];
	quantity?: DropSchema.Type["quantity"];
	rules?: DropSchema.Type["rules"];
}): DropSchema.Type => {
	return {
		itemId,
		placement,
		quantity,
		rules,
	};
};

const guaranteedRoll = (first: DropSchema.Type, ...drop: DropSchema.Type[]): RollSchema.Type => {
	return {
		type: "guaranteed",
		drop: [
			first,
			...drop,
		],
	};
};

const chanceRoll = ({
	chance,
	drop,
}: {
	chance: number;
	drop: DropSchema.Type;
}): RollSchema.Type => {
	return {
		type: "chance",
		chance,
		drop: [
			drop,
		],
	};
};

const createRollSet = ({
	roll,
	weight,
}: {
	roll: RollSchema.Type;
	weight?: number;
}): RollSetSchema.Type => {
	return {
		...(weight === undefined
			? {}
			: {
					weight,
				}),
		roll: [
			roll,
		],
	};
};

const missingPermitWhen = {
	type: "exists" as const,
	query: {
		scope: "any" as const,
		selector: {
			type: "item" as const,
			itemId: "permit",
		},
	},
};

describe("outputFx", () => {
	it("selects one roll set and resolves every selected drop in authored order", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();

				return yield* outputFx({
					origin: origin.location.position,
					output: {
						set: [
							createRollSet({
								weight: 1,
								roll: guaranteedRoll(
									createDrop({
										itemId: "item:ignored",
									}),
								),
							}),
							createRollSet({
								weight: 1,
								roll: guaranteedRoll(
									createDrop({
										itemId: "item:log",
										quantity: {
											type: "value",
											value: 2,
										},
									}),
									createDrop({
										itemId: "item:stone",
										placement: "replace",
									}),
								),
							}),
						],
					},
				});
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						0.75,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			drop: [
				{
					itemId: "item:log",
					placement: "drop",
					quantity: 2,
				},
				{
					itemId: "item:stone",
					placement: "replace",
					quantity: 1,
				},
			],
		});
	});

	it("discards rejected drops without disturbing accepted siblings", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();

				return yield* outputFx({
					origin: origin.location.position,
					output: {
						set: [
							createRollSet({
								roll: guaranteedRoll(
									createDrop({
										itemId: "item:rejected",
										quantity: {
											type: "range",
											min: 2,
											max: 4,
										},
										rules: [
											{
												type: "enable",
												when: [
													missingPermitWhen,
												],
											},
										],
									}),
									createDrop({
										itemId: "item:accepted",
										placement: "random",
										quantity: {
											type: "range",
											min: 2,
											max: 4,
										},
									}),
								),
							}),
						],
					},
				});
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						4,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			drop: [
				{
					itemId: "item:accepted",
					placement: "random",
					quantity: 4,
				},
			],
		});
	});

	it("does not evaluate unselected roll sets", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				const output = yield* outputFx({
					origin: origin.location.position,
					output: {
						set: [
							createRollSet({
								roll: chanceRoll({
									chance: 0.5,
									drop: createDrop({
										itemId: "item:unselected",
									}),
								}),
							}),
							createRollSet({
								roll: guaranteedRoll(
									createDrop({
										itemId: "item:selected",
									}),
								),
							}),
						],
					},
				});
				const nextRandom = yield* Random.next;

				return {
					nextRandom,
					output,
				};
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						0.75,
						0.25,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			nextRandom: 0.25,
			output: {
				drop: [
					{
						itemId: "item:selected",
						placement: "drop",
						quantity: 1,
					},
				],
			},
		});
	});
});
