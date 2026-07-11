import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { dropFx } from "~/v1/output/fx/dropFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	meta: {
		id: "game:drop-test",
		title: "Drop test",
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
	},
});

const createOriginFx = () => {
	return spawnItemFx({
		id: "origin",
		itemId: "source",
		location: {
			scope: "board",
			position: {
				x: 5,
				y: 5,
			},
		},
		quantity: 1,
	});
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

const sourceExistsWhen = {
	type: "exists" as const,
	query: {
		scope: "any" as const,
		selector: {
			type: "item" as const,
			itemId: "source",
		},
	},
};

describe("dropFx", () => {
	it("resolves an allowed selected drop into one concrete placement result", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();

				return yield* dropFx({
					drop: {
						itemId: "item:log",
						placement: "replace",
						quantity: {
							type: "value",
							value: 3,
						},
						rules: [],
					},
					origin: origin.location.position,
				});
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			itemId: "item:log",
			placement: "replace",
			quantity: 3,
		});
	});

	it("discards a failed enable gate and an applicable disable veto", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				const enableRejected = yield* dropFx({
					drop: {
						itemId: "item:log",
						placement: "drop",
						quantity: {
							type: "value",
							value: 1,
						},
						rules: [
							{
								type: "enable",
								when: [
									missingPermitWhen,
								],
							},
						],
					},
					origin: origin.location.position,
				});
				const disableApplied = yield* dropFx({
					drop: {
						itemId: "item:stone",
						placement: "drop",
						quantity: {
							type: "value",
							value: 1,
						},
						rules: [
							{
								type: "disable",
								when: [
									sourceExistsWhen,
								],
							},
						],
					},
					origin: origin.location.position,
				});

				return {
					disableApplied,
					enableRejected,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			disableApplied: undefined,
			enableRejected: undefined,
		});
	});

	it("composes every enable gate with every disable veto", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				const accepted = yield* dropFx({
					drop: {
						itemId: "item:accepted",
						placement: "drop",
						quantity: {
							type: "value",
							value: 1,
						},
						rules: [
							{
								type: "enable",
								when: [
									sourceExistsWhen,
								],
							},
							{
								type: "disable",
								when: [
									missingPermitWhen,
								],
							},
						],
					},
					origin: origin.location.position,
				});
				const rejected = yield* dropFx({
					drop: {
						itemId: "item:rejected",
						placement: "drop",
						quantity: {
							type: "value",
							value: 1,
						},
						rules: [
							{
								type: "enable",
								when: [
									sourceExistsWhen,
								],
							},
							{
								type: "disable",
								when: [
									sourceExistsWhen,
								],
							},
						],
					},
					origin: origin.location.position,
				});

				return {
					accepted,
					rejected,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			accepted: {
				itemId: "item:accepted",
				placement: "drop",
				quantity: 1,
			},
			rejected: undefined,
		});
	});

	it("evaluates rules before quantity and does not consume random input for rejected drops", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				const rejected = yield* dropFx({
					drop: {
						itemId: "item:rejected",
						placement: "drop",
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
					},
					origin: origin.location.position,
				});
				const accepted = yield* dropFx({
					drop: {
						itemId: "item:accepted",
						placement: "random",
						quantity: {
							type: "range",
							min: 2,
							max: 4,
						},
						rules: [],
					},
					origin: origin.location.position,
				});

				return {
					accepted,
					rejected,
				};
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						2,
						4,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			accepted: {
				itemId: "item:accepted",
				placement: "random",
				quantity: 2,
			},
			rejected: undefined,
		});
	});
});
