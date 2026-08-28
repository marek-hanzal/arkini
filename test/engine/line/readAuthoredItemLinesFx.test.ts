import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readAuthoredItemLinesFx } from "~/engine/line/read/readAuthoredItemLinesFx";
import { CraftSchema } from "~/engine/item/schema/CraftSchema";
import { DepositSchema } from "~/engine/item/schema/DepositSchema";
import {
	createLine,
	createProducerItem,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

describe("readAuthoredItemLinesFx", () => {
	it("uses one narrowing contract for single-line, multi-line, and optional deposits", () => {
		const singleLine = createLine({
			id: "line:single",
		});
		const multiLine = [
			createLine({
				id: "line:multi:first",
			}),
			createLine({
				id: "line:multi:second",
			}),
		];
		const craft = CraftSchema.parse({
			...createSimpleItem("craft"),
			line: singleLine,
			type: "craft",
		});
		const producer = createProducerItem({
			id: "producer",
			lines: multiLine,
		});
		const deposit = DepositSchema.parse({
			...createSimpleItem("deposit"),
			lines: [
				singleLine,
			],
			maxQueueSize: 1,
			type: "deposit",
		});
		const passiveDeposit = DepositSchema.parse({
			...createSimpleItem("passive-deposit"),
			maxQueueSize: 1,
			type: "deposit",
		});

		expect(Effect.runSync(readAuthoredItemLinesFx(craft))).toEqual([
			singleLine,
		]);
		expect(Effect.runSync(readAuthoredItemLinesFx(producer))).toEqual(multiLine);
		expect(Effect.runSync(readAuthoredItemLinesFx(deposit))).toEqual([
			singleLine,
		]);
		expect(Effect.runSync(readAuthoredItemLinesFx(passiveDeposit))).toEqual([]);
	});
});
