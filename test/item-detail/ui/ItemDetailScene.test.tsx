// @vitest-environment jsdom
import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { ItemDetailScene } from "~/item-detail/ui/ItemDetailScene";
import type { readItemLineStatusesFn } from "~/item-detail-read/fn/readItemLineStatusesFn";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
import { lineRunRuntime } from "~test/production-line/support/lineRunTestRuntime";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
	runtime: {} as RuntimeSchema.Type,
	statuses: [] as readItemLineStatusesFn.Status[],
	clearFn: vi.fn(),
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
vi.mock("~/item-detail/ui/useItemLinesStatus", () => ({
	useItemLinesStatus: () => state.statuses,
}));
vi.mock("~/item-detail/ui/useItemLineWorkController", () => ({
	useItemLineWorkController: ({
		ownerItemId,
		lineUid,
	}: {
		ownerItemId: string;
		lineUid: string;
	}) => ({
		clearDisabled: false,
		clearFn: () => state.clearFn(ownerItemId, lineUid),
	}),
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
		expect(host.querySelector('[data-ui="ItemSimpleDefaultControls"]')).not.toBeNull();
		expect(host.querySelector('[data-ui="ItemSimpleDefaultAction"]')).not.toBeNull();

		state.runtime = {
			...state.runtime,
			items: [],
		};
		await act(async () => root.render(renderSceneFn()));
		expect(host.querySelector('[data-ui="ItemInfo"]')).not.toBeNull();
		expect(host.querySelector('[data-ui="ItemSimpleDefaultControls"]')).toBeNull();
		expect(host.querySelector('[data-ui="ItemSimpleDefaultAction"]')).toBeNull();
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});

it("debounces Simple cancellation for pending work on its Default line, even during active work", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const source = lineRunRuntime({});
	const owner = source.items[0];
	const line = owner.item.lines[0];
	const renderSceneFn = () =>
		act(async () =>
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
								...line,
								default: true,
							},
						],
					},
				},
			],
		};
		state.statuses = [
			{
				lineUid: "another-line",
				state: "waiting-inputs",
				queued: 1,
			},
		];
		await renderSceneFn();
		expect(host.querySelector('[data-ui="ItemSimplePendingCancel"]')).toBeNull();

		state.statuses = [
			{
				lineUid: line.uid,
				state: "waiting-start",
				queued: 1,
			},
		];
		await renderSceneFn();
		expect(host.querySelector('[data-ui="ItemSimplePendingCancel"]')).toBeNull();

		await act(async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 150));
		});
		state.statuses = [
			{
				lineUid: line.uid,
				state: "waiting-start",
				queued: 0,
			},
		];
		await renderSceneFn();
		await act(async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 300));
		});
		expect(host.querySelector('[data-ui="ItemSimplePendingCancel"]')).toBeNull();

		state.statuses = [
			{
				lineUid: line.uid,
				state: "running",
				queued: 1,
			},
		];
		await renderSceneFn();
		await act(async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 420));
		});
		const cancel = host.querySelector<HTMLButtonElement>('[data-ui="ItemSimplePendingCancel"]');
		expect(cancel?.disabled).toBe(false);
		await act(async () => cancel?.click());
		expect(state.clearFn).toHaveBeenCalledExactlyOnceWith(owner.id, line.uid);
	} finally {
		state.statuses = [];
		state.clearFn.mockClear();
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
		expect(artwork?.querySelector('[data-ui="ItemInfoUnits"]')).toBeNull();
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
		await vi.waitFor(() =>
			expect(artwork?.querySelector('[data-ui="ItemJobProgress"]')).not.toBeNull(),
		);
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

it("returns from timed job progress to the Simple multi-unit count", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const source = lineRunRuntime({});
	const owner = source.items[0];
	const simpleOwner = {
		...owner,
		remainingUnits: 2,
		item: {
			...owner.item,
			ui: "simple" as const,
			units: {
				amount: 2,
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
		expect(host.querySelector('[data-ui="ItemUnitsProgress"]')?.textContent).toContain("2");
		expect(host.querySelector('[data-ui="ItemInfoUnits"]')).toBeNull();

		state.runtime = {
			...state.runtime,
			items: [
				{
					...simpleOwner,
					remainingUnits: 1,
				},
			],
			jobs: [
				{
					id: "job:build",
					ownerItemId: owner.id,
					lineUid: owner.item.lines[0].uid,
					durationMs: 10_000,
					remainingMs: 5_000,
				},
			],
		};
		await act(async () => root.render(renderSceneFn()));
		await vi.waitFor(() =>
			expect(host.querySelector('[data-ui="ItemJobProgress"]')).not.toBeNull(),
		);
		expect(host.querySelector('[data-ui="ItemUnitsProgress"]')).toBeNull();

		state.runtime = {
			...state.runtime,
			jobs: [],
		};
		await act(async () => root.render(renderSceneFn()));
		await vi.waitFor(() =>
			expect(host.querySelector('[data-ui="ItemUnitsProgress"]')).not.toBeNull(),
		);
		expect(host.querySelector('[data-ui="ItemUnitsProgress"]')?.textContent).toContain("1/2");
		expect(host.querySelector('[data-ui="ItemJobProgress"]')).toBeNull();
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});

it("shows remaining units on artwork only when the item holds multiple units", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const source = lineRunRuntime({});
	const owner = source.items[0];
	const multiUnitOwner = {
		...owner,
		remainingUnits: 2,
		item: {
			...owner.item,
			units: {
				amount: 2,
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
				multiUnitOwner,
			],
		};
		await act(async () => root.render(renderSceneFn()));
		expect(host.querySelector('[data-ui="ItemInfoUnits"]')?.textContent).toBe("2");

		state.runtime = {
			...state.runtime,
			items: [
				{
					...multiUnitOwner,
					remainingUnits: 1,
				},
			],
		};
		await act(async () => root.render(renderSceneFn()));
		expect(host.querySelector('[data-ui="ItemInfoUnits"]')?.textContent).toBe("1/2");
	} finally {
		await act(async () => root.unmount());
		host.remove();
	}
});
