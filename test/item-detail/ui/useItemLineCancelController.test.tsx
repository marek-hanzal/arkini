// @vitest-environment jsdom
import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { useItemLineCancelController } from "~/item-detail/ui/useItemLineCancelController";

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

it("binds cancellation to the displayed request and disables it when that identity is replaced", async () => {
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
		jobQueue: [
			{
				id: "first",
				ownerItemId: "owner:a",
				lineId: "line:a",
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
	let output: useItemLineCancelController.Output | undefined;
	const Probe = ({ requestId, disabled }: { requestId: string; disabled: boolean }) => {
		output = useItemLineCancelController({
			ownerItemId: "owner:a",
			lineId: "line:a",
			requestId,
			disabled,
		});
		return null;
	};
	const root = createRoot(document.createElement("div"));
	const renderFn = (requestId: string, disabled = false) =>
		act(async () =>
			root.render(
				<RegistryContext.Provider value={registry}>
					<Probe
						requestId={requestId}
						disabled={disabled}
					/>
				</RegistryContext.Provider>,
			),
		);
	try {
		await renderFn("first");
		await act(async () => output!.cancelFn());
		expect(state.clearFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:a",
			requestId: "first",
		});
		await act(async () =>
			registry.set(transition, {
				runtime: {
					...runtime,
					jobQueue: [
						{
							id: "next",
							ownerItemId: "owner:a",
							lineId: "line:a",
						},
					],
				},
			}),
		);
		expect(output!.disabled).toBe(true);
		await act(async () => output!.cancelFn());
		expect(state.clearFx).toHaveBeenCalledTimes(1);
		await renderFn("next", true);
		await act(async () => output!.cancelFn());
		expect(state.clearFx).toHaveBeenCalledTimes(1);
		await renderFn("next");
		await act(async () => output!.cancelFn());
		expect(state.clearFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:a",
			requestId: "next",
		});
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
	}
});
