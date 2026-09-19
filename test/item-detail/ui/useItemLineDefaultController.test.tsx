// @vitest-environment jsdom
import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { useItemLineDefaultController } from "~/item-detail/ui/useItemLineDefaultController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
	game: {} as unknown,
	selectFx: vi.fn(),
}));
vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => state.game,
}));
vi.mock("~/production-line/fx/setLineSelectionFx", () => ({
	setLineSelectionFx: state.selectFx,
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runSync: Effect.runSync,
	},
}));

it("toggles the exact owner's effective default independently of a full queue and respects disabled targets", async () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	const runtime = {
		items: [
			{
				id: "owner:a",
				location: {
					scope: "board",
				},
				item: {
					ui: "default",
					maxQueueSize: 1,
					lines: [
						{
							id: "line:a",
							default: true,
						},
						{
							id: "line:b",
							default: false,
						},
					],
				},
			},
		],
		jobs: [],
		jobQueue: [
			{
				ownerItemId: "owner:a",
				lineId: "line:a",
				id: "full",
			},
		],
		defaultLineByOwnerItemId: {} as Record<string, string | null>,
	};
	const transition = Atom.make({
		runtime,
	});
	state.game = {
		committedTransitionAtom: transition,
		runFx: (effect: Effect.Effect<void>) => effect,
	};
	state.selectFx.mockReturnValue(Effect.void);
	let output: useItemLineDefaultController.Output | undefined;
	const Probe = (props: useItemLineDefaultController.Props) => {
		output = useItemLineDefaultController(props);
		return null;
	};
	const root = createRoot(document.createElement("div"));
	const renderFn = (lineId: string, disabled = false, ownerItemId = "owner:a") =>
		act(async () =>
			root.render(
				<RegistryContext.Provider value={registry}>
					<Probe
						ownerItemId={ownerItemId}
						lineId={lineId}
						authoredDefault={lineId === "line:a"}
						disabled={disabled}
					/>
				</RegistryContext.Provider>,
			),
		);
	try {
		await renderFn("line:a");
		expect(output!.selected).toBe(true);
		expect(output!.disabled).toBe(false);
		await act(async () => output!.toggleFn());
		expect(state.selectFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:a",
			lineId: null,
			selection: "default",
		});
		await act(async () =>
			registry.set(transition, {
				runtime: {
					...runtime,
					defaultLineByOwnerItemId: {
						"owner:a": null,
					},
				},
			}),
		);
		expect(output!.selected).toBe(false);
		await renderFn("line:b");
		await act(async () => output!.toggleFn());
		expect(state.selectFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:a",
			lineId: "line:b",
			selection: "default",
		});
		await act(async () =>
			registry.set(transition, {
				runtime: {
					...runtime,
					defaultLineByOwnerItemId: {
						"owner:a": "line:b",
					},
				},
			}),
		);
		expect(output!.selected).toBe(true);
		await renderFn("line:b", true);
		await act(async () => output!.toggleFn());
		await renderFn("line:b", false, "missing");
		await act(async () => output!.toggleFn());
		expect(state.selectFx).toHaveBeenCalledTimes(2);
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
	}
});
