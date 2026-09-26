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
vi.mock("~/item-detail/ui/ItemLineInputs", () => ({
	ItemLineInputs: () => <span>Inputs panel</span>,
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
		state.runtime = {
			...state.runtime,
			items: [],
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
		expect(host.textContent).not.toContain("Lines panel");
		expect(host.querySelector('[data-ui="ItemInfo"]')).not.toBeNull();
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});

it("removes Simple input and action controls when the viewed owner is gone", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const source = lineRunRuntime({});
	const owner = source.items[0];
	const renderSceneFn = () => (
		<TranslationTestProvider>
			<ItemDetailScene
				disabled={false}
				target={{
					kind: "runtime",
					itemId: owner.id,
					origin: null,
				}}
			/>
		</TranslationTestProvider>
	);
	try {
		state.runtime = {
			...source,
			items: [
				{
					...owner,
					item: {
						...owner.item,
						ui: "simple",
						lines: [
							{
								...owner.item.lines[0],
								default: true,
							},
						],
					},
				},
			],
		};
		await act(async () => root.render(renderSceneFn()));
		expect(host.querySelector('[data-ui="ItemInfoRequirements"]')).not.toBeNull();
		expect(host.querySelector('[data-ui="ItemSimpleDefaultAction"]')).not.toBeNull();

		state.runtime = {
			...state.runtime,
			items: [],
		};
		await act(async () => root.render(renderSceneFn()));
		expect(host.querySelector('[data-ui="ItemInfo"]')).not.toBeNull();
		expect(host.querySelector('[data-ui="ItemInfoRequirements"]')).toBeNull();
		expect(host.querySelector('[data-ui="ItemSimpleDefaultAction"]')).toBeNull();
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});

it("shows Simple progress on artwork and replaces depleted counters with running job time", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const source = lineRunRuntime({});
	const owner = source.items[0];
	const simpleOwner = {
		...owner,
		remainingUnits: 1,
		schedule: {
			remainingDurationMs: 6_000,
		},
		item: {
			...owner.item,
			ui: "simple" as const,
			units: {
				amount: 1,
			},
			clock: {
				durationMs: 10_000,
				enable: true,
				rules: [],
			},
		},
	};
	const renderSceneFn = () => (
		<TranslationTestProvider>
			<ItemDetailScene
				disabled={false}
				target={{
					kind: "runtime",
					itemId: owner.id,
					origin: null,
				}}
			/>
		</TranslationTestProvider>
	);
	try {
		state.runtime = {
			...source,
			items: [
				simpleOwner,
			],
		};
		await act(async () => root.render(renderSceneFn()));
		let artwork = host.querySelector('[data-ui="ItemInfoArtwork"]');
		expect(artwork?.querySelector('[data-ui="ItemUnitsProgress"]')).toBeNull();
		expect(artwork?.querySelector('[data-ui="ItemLifetimeProgress"]')).not.toBeNull();
		expect(artwork?.querySelector('[data-ui="ItemJobProgress"]')).toBeNull();
		expect(host.textContent).not.toContain("1/1");

		state.runtime = {
			...state.runtime,
			items: [
				{
					...simpleOwner,
					remainingUnits: 0,
				},
			],
			jobs: [
				{
					id: "job:build",
					ownerItemId: owner.id,
					lineUid: owner.item.lines[0].uid,
					durationMs: 10_000,
					remainingMs: 5_000,
					terminalCause: "depleted",
				},
			],
		};
		await act(async () => root.render(renderSceneFn()));
		artwork = host.querySelector('[data-ui="ItemInfoArtwork"]');
		expect(artwork?.querySelector('[data-ui="ItemJobProgress"]')?.textContent).toContain(
			"5.0 s",
		);
		expect(artwork?.querySelector('[data-ui="ItemUnitsProgress"]')).toBeNull();
		await vi.waitFor(() =>
			expect(
				host.querySelector('[data-ui="ItemInfoArtwork"] [data-ui="ItemLifetimeProgress"]'),
			).toBeNull(),
		);
		expect(host.textContent).not.toContain("0/1");
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});
