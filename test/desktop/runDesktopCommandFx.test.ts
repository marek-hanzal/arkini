import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { runDesktopCommandFx } from "../../cli/desktop/runDesktopCommandFx";

describe("runDesktopCommandFx", () => {
	it("preserves successful process exit as Effect success", async () => {
		await expect(
			Effect.runPromise(
				runDesktopCommandFx({
					command: process.execPath,
					args: [
						"-e",
						"process.exit(0)",
					],
					operation: "run a successful fixture command",
				}).pipe(Effect.provide(NodeContext.layer)),
			),
		).resolves.toBeUndefined();
	});

	it("maps a non-zero process exit to the typed desktop failure channel", async () => {
		await expect(
			Effect.runPromise(
				Effect.flip(
					runDesktopCommandFx({
						command: process.execPath,
						args: [
							"-e",
							"process.exit(7)",
						],
						operation: "run a failing fixture command",
					}).pipe(Effect.provide(NodeContext.layer)),
				),
			),
		).resolves.toMatchObject({
			_tag: "DesktopPackagingError",
			operation: "run a failing fixture command",
			cause: expect.objectContaining({
				message: expect.stringContaining("exited with code 7"),
			}),
		});
	});
});
