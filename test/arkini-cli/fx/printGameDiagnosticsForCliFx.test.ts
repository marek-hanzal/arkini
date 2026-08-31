import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { printGameDiagnosticsForCliFx } from "~/arkini-cli/fx/printGameDiagnosticsForCliFx";

describe("printGameDiagnosticsForCliFx", () => {
	it("prints severity, stable code, context, location, and detailed cause", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		await Effect.runPromise(
			printGameDiagnosticsForCliFx([
				{
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
				},
			]),
		);

		expect(consoleError).toHaveBeenCalledWith(
			"ERROR input:capacity-unsupported — Unsupported input capacity [producer:academy · line:academy:knowledge · input 1] (items.json:items.producer:academy.lines.0.inputs.0)\n  This input buffer is only supported by producer lines.",
		);
	});
});
