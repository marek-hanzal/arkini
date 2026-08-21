import { describe, expect, it } from "vitest";

import { Effect } from "effect";

import { printGameDiagnosticForCliFx } from "~/engine/validation/printer/printGameDiagnosticForCliFx";

describe("printGameDiagnosticForCli", () => {
	it("prints severity, stable code, context, location, and detailed cause", () => {
		expect(
			Effect.runSync(
				printGameDiagnosticForCliFx({
					code: "input:capacity-unsupported",
					severity: "error",
					path: [
						"items",
						"producer:academy",
						"lines",
						0,
						"inputs",
						0,
					],
					source: "items.json",
					message: "This input buffer is only supported by producer lines.",
					ownerItemId: "producer:academy",
					lineId: "line:academy:knowledge",
					inputIndex: 0,
					capacity: 2,
				}),
			),
		).toBe(
			"ERROR input:capacity-unsupported — Unsupported input capacity [producer:academy · line:academy:knowledge · input 1] (items.json:items.producer:academy.lines.0.inputs.0)\n  This input buffer is only supported by producer lines.",
		);
	});
});
