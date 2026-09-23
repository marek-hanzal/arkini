// @vitest-environment jsdom
import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { useItemLineWorkController } from "~/item-detail/ui/useItemLineWorkController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
	game: {} as unknown,
	clearFx: vi.fn(),
	cancelFx: vi.fn(),
}));
vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => state.game,
}));
vi.mock("~/production-job/fx/clearItemJobQueueFx", () => ({
	clearItemJobQueueFx: state.clearFx,
}));
vi.mock("~/production-job/fx/cancelItemJobFx", () => ({
	cancelItemJobFx: state.cancelFx,
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runSync: Effect.runSync,
	},
}));

it("keeps line clearing separate from exact active job cancellation across stale identities", async () => {
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
				id: "first",
				ownerItemId: "owner:a",
				lineUid: "line:a",
			},
		],
	};
	const pending = {
		id: "pending",
		ownerItemId: "owner:a",
		lineUid: "line:a",
	};
	const transition = Atom.make({
		runtime: {
			...runtime,
			jobQueue: [
				pending,
			],
		},
	});
	state.game = {
		committedTransitionAtom: transition,
		runFx: (effect: Effect.Effect<void>) => effect,
	};
	state.clearFx.mockReturnValue(Effect.void);
	state.cancelFx.mockReturnValue(Effect.void);
	let output: useItemLineWorkController.Output | undefined;
	const Probe = ({ jobId, disabled }: { jobId: string; disabled: boolean }) => {
		output = useItemLineWorkController({
			ownerItemId: "owner:a",
			lineUid: "line:a",
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
		await act(async () => output!.clearFn());
		expect(state.clearFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:a",
			lineUid: "line:a",
		});

		await act(async () => output!.cancelJobFn());
		expect(state.cancelFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:a",
			jobId: "first",
		});
		await act(async () =>
			registry.set(transition, {
				runtime: {
					...runtime,
					jobQueue: [
						pending,
					],
					jobs: [
						{
							id: "next",
							ownerItemId: "owner:a",
							lineUid: "line:a",
						},
					],
				},
			}),
		);
		expect(output!.cancelJobDisabled).toBe(true);
		await act(async () => output!.cancelJobFn());
		expect(state.cancelFx).toHaveBeenCalledTimes(1);
		await act(async () => output!.clearFn());
		expect(state.clearFx).toHaveBeenCalledTimes(2);
		await renderFn("next", true);
		await act(async () => output!.clearFn());
		expect(state.clearFx).toHaveBeenCalledTimes(2);
		await act(async () => output!.cancelJobFn());
		expect(state.cancelFx).toHaveBeenCalledTimes(1);
		await renderFn("next");
		await act(async () => output!.cancelJobFn());
		expect(state.cancelFx).toHaveBeenLastCalledWith({
			ownerItemId: "owner:a",
			jobId: "next",
		});
		await act(async () =>
			registry.set(transition, {
				runtime: {
					...runtime,
					jobs: [
						{
							id: "next",
							ownerItemId: "owner:a",
							lineUid: "other",
						},
					],
					jobQueue: [
						{
							...pending,
							lineUid: "other",
						},
					],
				},
			}),
		);
		expect(output!.cancelJobDisabled).toBe(true);
		expect(output!.clearDisabled).toBe(true);
		await act(async () => {
			output!.clearFn();
			output!.cancelJobFn();
		});
		expect(state.clearFx).toHaveBeenCalledTimes(2);
		expect(state.cancelFx).toHaveBeenCalledTimes(2);
		await renderFn("first");
		await act(async () =>
			registry.set(transition, {
				runtime: {
					...runtime,
					jobQueue: [
						pending,
					],
				},
			}),
		);
		state.clearFx.mockReturnValueOnce(Effect.never);
		await act(async () => output!.clearFn());
		expect(output!.clearDisabled).toBe(true);
		expect(output!.cancelJobDisabled).toBe(true);
		await act(async () => {
			output!.clearFn();
			output!.cancelJobFn();
		});
		expect(state.clearFx).toHaveBeenCalledTimes(3);
		expect(state.cancelFx).toHaveBeenCalledTimes(2);
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
	}
});
