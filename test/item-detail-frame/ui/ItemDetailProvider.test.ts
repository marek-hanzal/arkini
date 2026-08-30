// @vitest-environment jsdom

import { Deferred, Effect } from "effect";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/renderer/game/GameEngine";
import {
	close,
	completeEnter,
	completeExit,
	openItemDetail,
	renderProvider,
	runPendingAction,
} from "../support/ItemDetailProviderFixture";

describe("Item Detail frame provider", () => {
	it("rejects stale targets without changing the closed owner", async () => {
		const { readControl } = await renderProvider();

		expect(
			openItemDetail(readControl(), {
				itemId: "runtime:missing",
				tab: "info",
			}),
		).toBe(false);
		expect(readControl().state).toEqual({
			phase: "closed",
		});
	});

	it("cancels pending commands when the exact Game owner is replaced", async () => {
		const { readControl, render } = await renderProvider();
		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:first",
				tab: "lines",
			});
		});
		const entering = readControl().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		await act(async () => completeEnter(readControl(), entering.generation));
		const interrupted = vi.fn();
		await act(async () => {
			readControl().runPendingAction({
				action: "autofill",
				failureMessage: "Autofill failed.",
				key: "line:runtime:first",
				run: Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted))),
			});
			await Promise.resolve();
		});
		expect(readControl().readPendingAction("line:runtime:first")).toBe("autofill");

		await act(async () => {
			render({
				id: "game:item-detail-provider:replacement",
			} as unknown as GameEngine);
		});

		await vi.waitFor(() => expect(interrupted).toHaveBeenCalledOnce());
		expect(readControl().readPendingAction("line:runtime:first")).toBeNull();
	});

	it("keeps outcomes within their exact target visit while close lets admitted work settle", async () => {
		const { readControl } = await renderProvider();
		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:first",
				tab: "lines",
			});
		});
		const entering = readControl().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		await act(async () => completeEnter(readControl(), entering.generation));

		const firstFailure = Effect.runSync(Deferred.make<never, Error>());
		await act(async () => {
			runPendingAction(readControl(), {
				action: "default",
				failureMessage: "First action failed.",
				key: "line:runtime:first",
				run: Deferred.await(firstFailure),
			});
			openItemDetail(readControl(), {
				itemId: "runtime:first",
				tab: "info",
			});
			Effect.runSync(Deferred.fail(firstFailure, new Error("First deferred failure.")));
		});
		await vi.waitFor(() =>
			expect(readControl().readActionError("line:runtime:first")).toBe(
				"First deferred failure.",
			),
		);

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:second",
				tab: "lines",
			});
		});
		expect(readControl().readActionError("line:runtime:first")).toBeNull();

		const lateFailure = Effect.runSync(Deferred.make<never, Error>());
		await act(async () => {
			runPendingAction(readControl(), {
				action: "enqueue",
				failureMessage: "Second action failed.",
				key: "line:runtime:second",
				run: Deferred.await(lateFailure),
			});
			const closeOutcome = close(readControl());
			await Promise.resolve();
			const exiting = readControl().state;
			if (exiting.phase !== "exiting") throw new Error("Expected exiting state.");
			completeExit(readControl(), exiting.generation);
			await closeOutcome;
		});
		expect(readControl().readPendingAction("line:runtime:second")).toBe("enqueue");

		Effect.runSync(Deferred.fail(lateFailure, new Error("Late failure after close.")));
		await vi.waitFor(() =>
			expect(readControl().readPendingAction("line:runtime:second")).toBeNull(),
		);
		expect(readControl().readActionError("line:runtime:second")).toBeNull();
	});
});
