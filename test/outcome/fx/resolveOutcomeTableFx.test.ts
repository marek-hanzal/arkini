import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import type { ItemOutcomeSchema as OutcomeSchema } from "~/outcome/schema/ItemOutcomeSchema";
import type { RollSchema } from "~/outcome/schema/RollSchema";
import type { RollSetSchema } from "~/outcome/schema/RollSetSchema";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:table-test",
		title: "Output test",
		board: {
			width: 10,
			height: 10,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		source: {
			maxQueueSize: 1,
			lines: [],

			uid: "source",
			id: "source",
			title: "Source",
			description: "An table origin.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:source",
				],
			},
		},
	},
});

const createOriginFx = () => {
	return spawnItemFx({
		id: "origin",
		itemId: "source",
		location: {
			scope: "board",
			space: 0,
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
		min: 1,
		max: 1,
	},
	rules = [],
}: {
	itemId: string;
	placement?: OutcomeSchema.Type["placement"];
	quantity?: OutcomeSchema.Type["quantity"];
	rules?: OutcomeSchema.Type["rules"];
}): OutcomeSchema.Type => {
	return {
		type: "item",
		itemId,
		placement,
		quantity,
		rules,
	};
};

const guaranteedRoll = (
	first: OutcomeSchema.Type,
	...outcome: OutcomeSchema.Type[]
): RollSchema.Type => {
	return {
		type: "guaranteed",
		outcome: [
			first,
			...outcome,
		],
	};
};

const chanceRoll = ({
	chance,
	outcome,
}: {
	chance: number;
	outcome: OutcomeSchema.Type;
}): RollSchema.Type => {
	return {
		type: "chance",
		chance,
		outcome: [
			outcome,
		],
	};
};

const createRollSet = ({
	roll,
	weight,
	rules = [],
}: {
	roll: RollSchema.Type;
	weight?: number;
	rules?: RollSetSchema.Type["rules"];
}): RollSetSchema.Type => {
	return {
		weight: weight ?? 1,
		rules,
		roll: [
			roll,
		],
	};
};

const missingPermitWhen = {
	type: "exists" as const,
	query: {
		distance: "far" as const,
		selector: {
			type: "item" as const,
			itemId: "permit",
		},
	},
};

describe("resolveOutcomeTableFx", () => {
	it("selects one roll set and resolves every selected outcome in authored order", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();

				return yield* resolveOutcomeTableFx({
					ownerItemId: "origin",
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					outcome: {
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
											min: 2,
											max: 2,
										},
									}),
									createDrop({
										itemId: "item:stone",
										placement: "random",
									}),
								),
							}),
						],
					},
				});
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.75,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);

		expect({
			outcome: result.roll.flatMap((roll) => roll.outcome),
		}).toEqual({
			outcome: [
				{
					type: "item",
					itemId: "item:log",
					placement: "drop",
					quantity: 2,
				},
				{
					type: "item",
					itemId: "item:stone",
					placement: "random",
					quantity: 1,
				},
			],
		});
	});

	it("discards rejected drops without disturbing accepted siblings", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();

				return yield* resolveOutcomeTableFx({
					ownerItemId: "origin",
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					outcome: {
						set: [
							createRollSet({
								roll: guaranteedRoll(
									createDrop({
										itemId: "item:rejected",
										quantity: {
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
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.75,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);

		expect({
			outcome: result.roll.flatMap((roll) => roll.outcome),
		}).toEqual({
			outcome: [
				{
					type: "item",
					itemId: "item:accepted",
					placement: "random",
					quantity: 4,
				},
			],
		});
	});

	it.each([
		false,
		true,
	])("filters unavailable sets before selection (all blocked: %s)", (allBlocked) => {
		const rules: RollSetSchema.Type["rules"] = [
			{
				type: "enable",
				when: [
					missingPermitWhen,
				],
			},
		];
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				const table = yield* resolveOutcomeTableFx({
					ownerItemId: "origin",
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					outcome: {
						set: [
							createRollSet({
								weight: 1,
								rules: allBlocked ? rules : [],
								roll: guaranteedRoll(
									createDrop({
										itemId: "item:normal",
									}),
								),
							}),
							createRollSet({
								weight: 99,
								rules,
								roll: chanceRoll({
									chance: 0.5,
									outcome: createDrop({
										itemId: "item:blocked",
										quantity: {
											min: 1,
											max: 4,
										},
									}),
								}),
							}),
						],
					},
				});
				return {
					table,
					nextRandom: yield* Random.next,
				};
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.99,
						0.25,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);
		expect({
			table: {
				outcome: result.table.roll.flatMap((roll) => roll.outcome),
			},
			nextRandom: result.nextRandom,
		}).toEqual({
			table: {
				outcome: allBlocked
					? []
					: [
							{
								type: "item",
								itemId: "item:normal",
								placement: "drop",
								quantity: 1,
							},
						],
			},
			nextRandom: 0.99,
		});
	});

	it("does not evaluate unselected roll sets", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				const table = yield* resolveOutcomeTableFx({
					ownerItemId: "origin",
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					outcome: {
						set: [
							createRollSet({
								roll: chanceRoll({
									chance: 0.5,
									outcome: createDrop({
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
					table,
				};
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.75,
						0.25,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);

		expect({
			table: {
				outcome: result.table.roll.flatMap((roll) => roll.outcome),
			},
			nextRandom: result.nextRandom,
		}).toEqual({
			nextRandom: 0.25,
			table: {
				outcome: [
					{
						type: "item",
						itemId: "item:selected",
						placement: "drop",
						quantity: 1,
					},
				],
			},
		});
	});
});
