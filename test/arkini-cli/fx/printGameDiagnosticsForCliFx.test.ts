import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { printGameDiagnosticsForCliFx } from "~/arkini-cli/fx/printGameDiagnosticsForCliFx";

describe("printGameDiagnosticsForCliFx", () => {
	it("prints severity, stable code, context, location, and detailed cause", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		await Effect.runPromise(
			printGameDiagnosticsForCliFx([
				{
					code: "input:units-invalid",
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
					message: "The item has no units to pay its own input cost.",
					ownerItemId: "producer:academy",
					lineId: "line:academy:knowledge",
					inputIndex: 0,
					reason: "self-missing-units" as const,
				},
			]),
		);

		expect(consoleError).toHaveBeenCalledWith(
			"ERROR input:units-invalid — Invalid input unit contract [producer:academy · line:academy:knowledge · input 1] (items.json:items.producer:academy.lines.0.inputs.0)\n  The item has no units to pay its own input cost.",
		);
	});
});
