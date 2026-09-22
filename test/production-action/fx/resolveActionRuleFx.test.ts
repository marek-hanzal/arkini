import { Effect, Result } from "effect";
import { expect, it } from "vitest";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

it("keeps rules inactive when a Board condition has no physical origin in either condition order", () => {
	const origin = {
		scope: "board" as const,
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	} as const;
	const missingPermit: WhenSchema.Type = {
		type: "exists",
		query: {
			distance: "far" as const,
			selector: {
				type: "item",
				itemId: "permit",
			},
		},
	};
	const unavailableBoard: WhenSchema.Type = {
		...missingPermit,
		query: {
			...missingPermit.query,
			distance: "self",
		},
	};
	const readRule = (rule: RuleSchema.Type) =>
		Effect.runSync(
			Effect.result(
				resolveActionRuleFx({
					origin,
					rule,
				}),
			).pipe(
				Effect.provideService(GameConfigFx, lineRunTestConfig),
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(lineRunRuntime({})),
				}),
			),
		);
	for (const type of [
		"enable",
		"disable",
	] as const) {
		const inactive = readRule({
			type,
			when: [
				missingPermit,
				unavailableBoard,
			],
		});
		expect(Result.isSuccess(inactive)).toBe(true);
		if (Result.isSuccess(inactive))
			expect(inactive.success).toMatchObject({
				type,
				active: false,
			});
		const unavailable = readRule({
			type,
			when: [
				unavailableBoard,
				missingPermit,
			],
		});
		expect(Result.isSuccess(unavailable)).toBe(true);
		if (Result.isSuccess(unavailable)) {
			expect(unavailable.success).toMatchObject({
				type,
				active: false,
			});
		}
	}
});
