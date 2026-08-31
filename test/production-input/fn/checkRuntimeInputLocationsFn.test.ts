import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import {
	inputRuntimeTestConfig,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

const owner = {
	id: "runtime:workshop",
	item: inputRuntimeTestConfig.items.workshop,
	location: workshopLocation,
	quantity: 1,
	revision: "revision:owner",
} as const;

const inputItem = ({
	id = "runtime:water",
	inputIndex = 0,
	itemId = "water",
	lineId = "line:workshop:build",
	ownerItemId = "runtime:workshop",
	quantity = 1,
}: {
	id?: string;
	inputIndex?: number;
	itemId?: "stone" | "water";
	lineId?: string;
	ownerItemId?: string;
	quantity?: number;
}) => {
	return {
		id,
		item: inputRuntimeTestConfig.items[itemId],
		location: {
			scope: "input" as const,
			ownerItemId,
			lineId,
			inputIndex,
		},
		quantity,
		revision: `revision:${id}`,
	};
};

const checkFx = (runtime: RuntimeSchema.Type) => {
	return checkRuntimeFx({
		runtime,
	}).pipe(
		useGameFx({
			config: inputRuntimeTestConfig,
		}),
	);
};

describe("checkRuntimeInputLocationsFn", () => {
	it("reports missing owners, lines, slots, selector mismatches, and exceeded capacity", () => {
		const result = Effect.runSync(
			checkFx({
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: 0,
				items: [
					owner,
					inputItem({
						id: "runtime:missing-owner",
						ownerItemId: "runtime:missing",
					}),
					inputItem({
						id: "runtime:missing-line",
						lineId: "line:missing",
					}),
					inputItem({
						id: "runtime:invalid-slot",
						inputIndex: 1,
					}),
					inputItem({
						id: "runtime:mismatch",
						itemId: "stone",
					}),
					inputItem({
						id: "runtime:overflow:a",
						quantity: 3,
					}),
					inputItem({
						id: "runtime:overflow:b",
						quantity: 3,
					}),
				],
				jobs: [],

				jobQueue: [],
				defaultLineByOwnerItemId: {},
			}),
		);

		expect(result.issues.map((issue) => issue.type)).toEqual(
			expect.arrayContaining([
				RuntimeCheckIssueEnumSchema.enum.InputOwnerMissing,
				RuntimeCheckIssueEnumSchema.enum.InputLineMissing,
				RuntimeCheckIssueEnumSchema.enum.InputSlotInvalid,
				RuntimeCheckIssueEnumSchema.enum.InputSelectorMismatch,
				RuntimeCheckIssueEnumSchema.enum.InputCapacityExceeded,
			]),
		);
	});
});
