import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { checkRuntimeFx } from "~/engine/runtime/check/checkRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import {
	inputRuntimeTestConfig,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

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

describe("checkRuntimeInputLocationsFx", () => {
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
