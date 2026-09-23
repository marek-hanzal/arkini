import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { printGameDiagnosticsForCliFx } from "~/serakki-cli/fx/printGameDiagnosticsForCliFx";

describe("printGameDiagnosticsForCliFx", () => {
	it("prints severity, stable code, context, location, and detailed cause", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		await Effect.runPromise(
			printGameDiagnosticsForCliFx({
				diagnostics: [
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
						ownerItemUid: "producer:academy",
						lineId: "line:academy:knowledge",
						inputIndex: 0,
						reason: "self-missing-units" as const,
					},
				],
				silent: false,
			}),
		);

		expect(consoleError).toHaveBeenCalledWith(
			"ERROR input:units-invalid — Invalid input unit contract [producer:academy · line:academy:knowledge · input 1] (items.json:items.producer:academy.lines.0.inputs.0)\n  The item has no units to pay its own input cost.",
		);
	});

	it("suppresses warnings in silent mode while preserving errors", async () => {
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		await Effect.runPromise(
			printGameDiagnosticsForCliFx({
				diagnostics: [
					{
						code: "resource:unused",
						severity: "warning",
						path: [
							"assets",
							"unused.png",
						],
						source: "artwork/unused.png",
						message: "This asset is not referenced.",
						resourceUid: "unused",
					},
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
						ownerItemUid: "producer:academy",
						lineId: "line:academy:knowledge",
						inputIndex: 0,
						reason: "self-missing-units" as const,
					},
				],
				silent: true,
			}),
		);

		expect(consoleWarn).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledOnce();
	});
});
