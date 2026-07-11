import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { checkRuntimeFx } from "~/v1/runtime/check/checkRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

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
			returnLocation: sourceLocation(1),
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
			}),
		);

		expect(result.issues.map((issue) => issue.type)).toEqual(
			expect.arrayContaining([
				"input:owner-missing",
				"input:line-missing",
				"input:slot-invalid",
				"input:selector-mismatch",
				"input:capacity-exceeded",
			]),
		);
	});
});
