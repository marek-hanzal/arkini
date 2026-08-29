import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { describe, expect, it, vi } from "vitest";

import { RendererAtomRegistry } from "~/application-runtime/RendererAtomRegistry";

describe("Renderer Atom lifecycle", () => {
	it("schedules a scoped atom and finalizes it exactly once with its owning registry", async () => {
		let finalizations = 0;
		const resourceAtom = Atom.make(
			Effect.acquireRelease(Effect.succeed("ready"), () =>
				Effect.sync(() => {
					finalizations += 1;
				}),
			),
		);
		const release = RendererAtomRegistry.mount(resourceAtom);

		await vi.waitFor(() => {
			const result = RendererAtomRegistry.get(resourceAtom);
			expect(AsyncResult.isSuccess(result)).toBe(true);
		});
		expect(finalizations).toBe(0);

		RendererAtomRegistry.dispose();
		RendererAtomRegistry.dispose();
		release();

		expect(finalizations).toBe(1);
	});
});
