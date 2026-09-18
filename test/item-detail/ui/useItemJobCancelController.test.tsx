// @vitest-environment jsdom
import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { useItemJobCancelController } from "~/item-detail/ui/useItemJobCancelController";

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
vi.mock("~/production-job/fx/cancelItemJobFx", () => ({
	cancelItemJobFx: state.clearFx,
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runSync: Effect.runSync,
	},
}));

it("binds cancellation to the displayed job and disables it when that identity is replaced", async () => {
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
					control: "interactive",
				},
			},
		],
		jobs: [
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
	let output: useItemJobCancelController.Output | undefined;
	const Probe = ({ jobId, disabled }: { jobId: string; disabled: boolean }) => {
		output = useItemJobCancelController({
			ownerItemId: "owner:a",
			lineId: "line:a",
			jobId,
			disabled,
		});
		return null;
	};
	const root = createRoot(document.createElement("div"));
	const renderFn = (jobId: string, disabled = false) =>
		act(async () =>
			root.render(
				<RegistryContext.Provider value={registry}>
					<Probe
						jobId={jobId}
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
			jobId: "first",
		});
		await act(async () =>
			registry.set(transition, {
				runtime: {
					...runtime,
					jobs: [
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
			jobId: "next",
		});
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
	}
});
