import { Effect, Result } from "effect";
import { expect, it } from "vitest";

import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import { lineRunRuntime } from "~test/production-line/support/lineRunTestRuntime";

it("short-circuits false action conditions but propagates an earlier query failure", () => {
	const origin = {
		scope: "inventory",
		position: {
			x: 0,
			y: 0,
		},
	} as const;
	const missingPermit: WhenSchema.Type = {
		type: "exists",
		query: {
			scope: "any",
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
			scope: "board",
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
		const failed = readRule({
			type,
			when: [
				unavailableBoard,
				missingPermit,
			],
		});
		expect(Result.isFailure(failed)).toBe(true);
		if (Result.isFailure(failed)) {
			expect(failed.failure).toMatchObject({
				_tag: "BoardQueryOriginUnavailableError",
				origin,
			});
		}
	}
});
