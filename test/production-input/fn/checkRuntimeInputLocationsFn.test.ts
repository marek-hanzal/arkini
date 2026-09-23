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

	revision: "revision:owner",
} as const;

const inputItem = ({
	id = "runtime:water",
	inputIndex = 0,
	itemId = "water",
	lineUid = "line:workshop:build",
	ownerItemId = "runtime:workshop",
}: {
	id?: string;
	inputIndex?: number;
	itemId?: "stone" | "water";
	lineUid?: string;
	ownerItemId?: string;
}) => {
	return {
		id,
		item: inputRuntimeTestConfig.items[itemId],
		location: {
			scope: "input" as const,
			ownerItemId,
			lineUid,
			inputIndex,
		},

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
					speedUpGameplay: false,
				},
				currentSpace: 0,
				templateUidBySpace: {},
				items: [
					owner,
					inputItem({
						id: "runtime:missing-owner",
						ownerItemId: "runtime:missing",
					}),
					inputItem({
						id: "runtime:missing-line",
						lineUid: "line:missing",
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
						id: "runtime:overflow:c",
					}),
					inputItem({
						id: "runtime:overflow:d",
					}),
					inputItem({
						id: "runtime:overflow:a",
					}),
					inputItem({
						id: "runtime:overflow:b",
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
