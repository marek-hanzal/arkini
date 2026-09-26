// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { ItemLines } from "~/item-detail/ui/ItemLines";
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
		getResourceUrlFn: (id: string) => id,
	}),
}));
vi.mock("~/game-presentation/ui/useRuntimeSelector", () => ({
	useRuntimeSelector: (_game: unknown, selectorFn: (runtime: RuntimeSchema.Type) => unknown) =>
		selectorFn(state.runtime),
}));
vi.mock("~/item-detail/ui/useItemLinesStatus", () => ({
	useItemLinesStatus: () => [],
}));
vi.mock("~/item-detail/ui/useItemLineMakeController", () => ({
	useItemLineMakeController: () => ({
		makeFn: () => {},
		pending: false,
	}),
}));
vi.mock("~/item-detail/ui/useItemLineDefaultController", () => ({
	useItemLineDefaultController: () => ({
		selected: false,
		disabled: false,
		toggleFn: () => {},
	}),
}));
vi.mock("~/item-detail/ui/ItemLineInputs", () => ({
	ItemLineInputs: () => null,
}));
vi.mock("~/item-detail/ui/ItemLineWorkControls", () => ({
	ItemLineWorkControls: () => null,
}));

it("keeps the idle Play cue hidden for a live queued request while status presentation lags", async () => {
	const base = lineRunRuntime({
		permit: true,
		water: 3,
	});
	const owner = base.items[0];
	const line = {
		...owner.item.lines[0],
		artwork: "artwork:line",
	};
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const renderFn = () =>
		act(async () =>
			root.render(
				<TranslationTestProvider>
					<ItemLines
						lines={[
							line,
						]}
						disabledLineUids={[]}
						lineBlockingHints={{}}
						materialVisualAvailableLineUids={[
							line.uid,
						]}
						playReadyLineUids={[
							line.uid,
						]}
						ownerItemId={owner.id}
						disabled={false}
						makeDisabled={false}
					/>
				</TranslationTestProvider>,
			),
		);
	try {
		state.runtime = {
			...base,
			jobQueue: [
				{
					id: "request:build",
					ownerItemId: owner.id,
					lineUid: line.uid,
				},
			],
		};
		await renderFn();
		expect(
			host.querySelector('[data-ui="ItemLinePlayCue"]')?.getAttribute("data-ui-visible"),
		).toBe("false");
		state.runtime = {
			...state.runtime,
			jobQueue: [],
		};
		await renderFn();
		expect(
			host.querySelector('[data-ui="ItemLinePlayCue"]')?.getAttribute("data-ui-visible"),
		).toBe("true");
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});
