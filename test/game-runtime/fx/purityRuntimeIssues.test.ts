import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { lineSelectionTestConfig } from "~test/production-line/support/lineSelectionTestConfig";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

describe("runtime purity invariants", () => {
	it("reports buffered material in a closed input", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: [
				{
					id: "runtime:craft",
					item: lineSelectionTestConfig.items.craft,
					location: board(0),

					revision: "revision:craft",
				},
				{
					id: "runtime:material",
					item: lineSelectionTestConfig.items.material,
					location: {
						scope: "input" as const,
						ownerItemId: "runtime:craft",
						lineUid: "line:craft",
						inputIndex: 0,
					},

					revision: "revision:material",
				},
			],
			jobs: [
				{
					id: "job:craft",
					ownerItemId: "runtime:craft",
					lineUid: "line:craft",
					durationMs: 1_000,
					remainingMs: 1_000,
				},
			],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config: lineSelectionTestConfig,
				}),
			),
		);

		expect(result.issues).toEqual([
			{
				ownerItemId: "runtime:craft",
				lineUid: "line:craft",
				inputIndex: 0,
				itemIds: [
					"runtime:material",
				],
				type: RuntimeCheckIssueEnumSchema.enum.LineInputClosed,
			},
		]);
	});
});
