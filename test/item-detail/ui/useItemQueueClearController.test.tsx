// @vitest-environment jsdom
import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { useItemQueueClearController } from "~/item-detail/ui/useItemQueueClearController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
	game: {} as unknown,
	clearFx: vi.fn(),
}));
vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => state.game,
}));
vi.mock("~/production-job/fx/clearItemJobQueueFx", () => ({
	clearItemJobQueueFx: state.clearFx,
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runSync: Effect.runSync,
	},
}));

it("clears the visible owner's pending queue and blocks empty, stale and missing targets", async () => {
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
				},
			},
		],
		jobs: [
			{
				ownerItemId: "owner:a",
			},
		],
		jobQueue: [
			{
				ownerItemId: "owner:a",
			},
			{
				ownerItemId: "owner:b",
			},
		],
	};
	const transition = Atom.make({
		runtime,
	});
	state.game = {
		committedTransitionAtom: transition,
		runFx: (effect: Effect.Effect<void>) => effect,
	};
	state.clearFx.mockReturnValue(Effect.void);
	let output: useItemQueueClearController.Output | undefined;
	const Probe = (props: useItemQueueClearController.Props) => {
		output = useItemQueueClearController(props);
		return null;
	};
	const root = createRoot(document.createElement("div"));
	const renderFn = (ownerItemId: string | undefined = "owner:a", disabled = false) =>
		act(async () =>
			root.render(
				<RegistryContext.Provider value={registry}>
					<Probe
						ownerItemId={ownerItemId}
						disabled={disabled}
					/>
				</RegistryContext.Provider>,
			),
		);
	try {
		await renderFn();
		expect(output!.queued).toBe(1);
		expect(output!.disabled).toBe(false);
		await act(async () => output!.clearFn());
		expect(state.clearFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:a",
		});
		await renderFn("owner:a", true);
		await act(async () => output!.clearFn());
		await renderFn("missing");
		expect(output!.queued).toBe(0);
		await act(async () => output!.clearFn());
		await renderFn();
		await act(async () =>
			registry.set(transition, {
				runtime: {
					...runtime,
					jobQueue: [
						{
							ownerItemId: "owner:b",
						},
					],
				},
			}),
		);
		expect(output!.queued).toBe(0);
		expect(output!.disabled).toBe(true);
		await act(async () => output!.clearFn());
		expect(state.clearFx).toHaveBeenCalledTimes(1);
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
	}
});
