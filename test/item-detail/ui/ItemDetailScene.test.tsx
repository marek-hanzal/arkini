// @vitest-environment jsdom
import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { ItemDetailScene } from "~/item-detail/ui/ItemDetailScene";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
import { lineRunRuntime } from "~test/production-line/support/lineRunTestRuntime";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
	runtime: {} as RuntimeSchema.Type,
}));
vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => ({
		readFn: Effect.runSyncExit,
		getResourceUrlFn: (id: string) => id,
		subscribeTransitionsFn: () => () => {},
	}),
}));
vi.mock("~/game-presentation/ui/useRuntimeSelector", () => ({
	useRuntimeSelector: (_game: unknown, selectorFn: (runtime: RuntimeSchema.Type) => unknown) =>
		selectorFn(state.runtime),
}));
vi.mock("~/item-detail-frame/ui/useCloseItemDetail", () => ({
	useCloseItemDetail: () => () => {},
}));
vi.mock("~/item-detail/ui/ItemLines", () => ({
	ItemLines: () => <span>Lines panel</span>,
}));

it("updates production visibility from live UI mode while retaining item information", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const source = lineRunRuntime({});
	const owner = source.items[0];
	try {
		state.runtime = {
			...source,
			items: [
				{
					...owner,
					item: {
						...owner.item,
						ui: "simple",
					},
				},
			],
		};
		await act(async () =>
			root.render(
				<TranslationTestProvider>
					<ItemDetailScene
						disabled={false}
						target={{
							kind: "runtime",
							itemId: owner.id,
							origin: null,
						}}
					/>
				</TranslationTestProvider>,
			),
		);
		expect(host.querySelector('[data-ui="ItemInfo"]')).not.toBeNull();
		expect(host.textContent).not.toContain("Lines panel");
		// The same mounted target gains all sections with default, even after removing every line.
		state.runtime = {
			...source,
			items: [
				{
					...owner,
					item: {
						...owner.item,
						ui: "default",
						lines: [],
					},
				},
			],
		};
		await act(async () =>
			root.render(
				<TranslationTestProvider>
					<ItemDetailScene
						disabled={false}
						target={{
							kind: "runtime",
							itemId: owner.id,
							origin: null,
						}}
					/>
				</TranslationTestProvider>,
			),
		);
		expect(host.textContent).toContain("Lines panel");
		expect(host.querySelector('[data-ui="ItemInfo"]')).not.toBeNull();
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});
