import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import type { LineSchema } from "~/v1/line/schema/LineSchema";
import { lineFx } from "./lineFx";
import {
	createLine,
	createOriginFx,
	existsWhen,
	lineTestConfig,
	placeLineTestItemFx,
} from "./test/lineTestRuntime";

describe("lineFx", () => {
	it("uses configured defaults when no dynamic rules exist", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();

				return yield* lineFx({
					line: createLine({
						enable: false,
						show: false,
					}),
					origin,
				});
			}).pipe(
				useGameFx({
					config: lineTestConfig,
				}),
			),
		);

		expect(result).toEqual({
			enable: false,
			id: "line:test",
			runtimeMs: 1_000,
			show: false,
		});
	});

	it("reveals a hidden line and lets an active hide rule veto visibility", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				yield* placeLineTestItemFx({
					itemId: "permit",
					x: 0,
				});
				const line = createLine({
					show: false,
					rules: [
						{
							type: "show",
							when: [
								existsWhen("permit"),
							],
						},
						{
							type: "hide",
							when: [
								existsWhen("blocker"),
							],
						},
					],
				});
				const revealed = yield* lineFx({
					line,
					origin,
				});
				yield* placeLineTestItemFx({
					itemId: "blocker",
					x: 1,
				});
				const hidden = yield* lineFx({
					line,
					origin,
				});

				return {
					hidden,
					revealed,
				};
			}).pipe(
				useGameFx({
					config: lineTestConfig,
				}),
			),
		);

		expect(result.revealed.show).toBe(true);
		expect(result.hidden.show).toBe(false);
	});

	it("requires every enable gate and lets an active disable rule veto availability", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				yield* placeLineTestItemFx({
					itemId: "permit",
					x: 0,
				});
				const rules = [
					{
						type: "enable",
						when: [
							existsWhen("permit"),
						],
					},
					{
						type: "enable",
						when: [
							existsWhen("booster"),
						],
					},
					{
						type: "disable",
						when: [
							existsWhen("blocker"),
						],
					},
				] satisfies LineSchema.Type["rules"];
				const failedGate = yield* lineFx({
					line: createLine({
						enable: true,
						rules,
					}),
					origin,
				});
				yield* placeLineTestItemFx({
					itemId: "booster",
					x: 1,
				});
				const enabled = yield* lineFx({
					line: createLine({
						enable: false,
						rules,
					}),
					origin,
				});
				yield* placeLineTestItemFx({
					itemId: "blocker",
					x: 2,
				});
				const disabled = yield* lineFx({
					line: createLine({
						enable: false,
						rules,
					}),
					origin,
				});

				return {
					disabled,
					enabled,
					failedGate,
				};
			}).pipe(
				useGameFx({
					config: lineTestConfig,
				}),
			),
		);

		expect(result.failedGate.enable).toBe(false);
		expect(result.enabled.enable).toBe(true);
		expect(result.disabled.enable).toBe(false);
	});

	it("multiplies active runtime rules and rounds the concrete runtime up", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				yield* placeLineTestItemFx({
					itemId: "permit",
					x: 0,
				});
				yield* placeLineTestItemFx({
					itemId: "booster",
					x: 1,
				});

				return yield* lineFx({
					line: createLine({
						runtimeMs: 101,
						rules: [
							{
								type: "runtime:multiplier",
								when: [
									existsWhen("permit"),
								],
								multiplier: 1.5,
							},
							{
								type: "runtime:multiplier",
								when: [
									existsWhen("booster"),
								],
								multiplier: 1.1,
							},
							{
								type: "runtime:multiplier",
								when: [
									existsWhen("missing"),
								],
								multiplier: 10,
							},
						],
					}),
					origin,
				});
			}).pipe(
				useGameFx({
					config: lineTestConfig,
				}),
			),
		);

		expect(result.runtimeMs).toBe(167);
	});
});
