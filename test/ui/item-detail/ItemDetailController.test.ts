// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createItemDetailControllerFx } from "~/ui/item-detail/createItemDetailControllerFx";
import type { ItemDetailTarget } from "~/ui/item-detail/ItemDetailControl";

const runtimeTarget = ({
	itemId = "runtime:first",
	linesSearchQuery,
	tab = "lines",
	origin = null,
}: {
	readonly itemId?: string;
	readonly linesSearchQuery?: string;
	readonly tab?: "info" | "lines" | "queue" | "sources";
	readonly origin?: HTMLElement | null;
} = {}) =>
	({
		kind: "runtime",
		itemId,
		linesSearchQuery,
		tab,
		origin,
	}) satisfies ItemDetailTarget;

describe("ItemDetailController", () => {
	it("allocates a fresh command outcome scope for A to B to A target visits", () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const firstScope = controller.readOutcomeScope();
		Effect.runSync(
			controller.openTargetFx(
				runtimeTarget({
					itemId: "runtime:second",
				}),
			),
		);
		const secondScope = controller.readOutcomeScope();
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const revisitedScope = controller.readOutcomeScope();

		expect(firstScope).toBeDefined();
		expect(secondScope).toBeDefined();
		expect(revisitedScope).toBeDefined();
		expect(secondScope).not.toBe(firstScope);
		expect(revisitedScope).not.toBe(firstScope);
		expect(revisitedScope).not.toBe(secondScope);
	});

	it("treats a changed Lines query as a distinct intent for the same target", () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(
			controller.openTargetFx(
				runtimeTarget({
					linesSearchQuery: "Water",
				}),
			),
		);
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		Effect.runSync(controller.completeEnterFx(entering.generation));

		Effect.runSync(
			controller.openTargetFx(
				runtimeTarget({
					linesSearchQuery: "Stone",
				}),
			),
		);

		expect(controller.getSnapshot().state).toMatchObject({
			generation: entering.generation,
			phase: "open",
			target: {
				linesSearchQuery: "Stone",
			},
		});
	});

	it("owns origin retention and generation-safe close settlement", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		const listener = vi.fn();
		const origin = document.createElement("button");
		controller.subscribe(listener);
		expect(
			Effect.runSync(
				controller.openTargetFx(
					runtimeTarget({
						origin,
					}),
				),
			),
		).toBe(true);
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		expect(controller.readOrigin(document.createElement("button"))).toBe(origin);
		Effect.runSync(controller.completeEnterFx(entering.generation + 1));
		expect(controller.getSnapshot().state.phase).toBe("entering");
		Effect.runSync(controller.completeEnterFx(entering.generation));

		const close = Effect.runPromise(controller.closeFx());
		await Promise.resolve();
		expect(controller.getSnapshot().state.phase).toBe("exiting");
		Effect.runSync(controller.completeExitFx(entering.generation + 1));
		expect(controller.getSnapshot().state.phase).toBe("exiting");
		Effect.runSync(controller.completeExitFx(entering.generation));
		await close;
		expect(controller.getSnapshot().state).toEqual({
			phase: "closed",
		});
		expect(listener).toHaveBeenCalledTimes(4);
	});

	it("resolves an outstanding close when reset tears down the presentation owner", async () => {
		const controller = Effect.runSync(createItemDetailControllerFx());
		Effect.runSync(controller.openTargetFx(runtimeTarget()));
		const entering = controller.getSnapshot().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		Effect.runSync(controller.completeEnterFx(entering.generation));
		const close = Effect.runPromise(controller.closeFx());
		await Promise.resolve();
		Effect.runSync(controller.resetFx);
		await close;
		expect(controller.getSnapshot().state).toEqual({
			phase: "closed",
		});
	});
});
