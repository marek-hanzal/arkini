// @vitest-environment jsdom
import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { useItemLinesStatus } from "~/item-detail/ui/useItemLinesStatus";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
	game: {} as unknown,
	readQueueFx: vi.fn(),
}));
vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => state.game,
}));
vi.mock("~/item-detail-read/fx/readItemDetailQueueFx", () => ({
	readItemDetailQueueFx: state.readQueueFx,
}));

it("settles bursts once without being starved by running clock ticks and drops old-owner pending updates", async () => {
	vi.useFakeTimers();
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	const transition = Atom.make({
		runtime: {
			phase: "idle",
			remainingMs: 1000,
		},
	});
	state.game = {
		committedTransitionAtom: transition,
		readFn: Effect.runSyncExit,
	};
	state.readQueueFx.mockImplementation(({ itemId, runtime }) =>
		Effect.succeed({
			kind: "available",
			active:
				runtime.phase === "running" && itemId === "owner:a"
					? [
							{
								lineUid: "line",
								status: "running",
							},
						]
					: [],
			request:
				runtime.phase === "waiting" && itemId === "owner:a"
					? [
							{
								requestId: "request",
								lineUid: "line",
								status: "waiting-inputs",
							},
						]
					: [],
		}),
	);
	const root = createRoot(document.createElement("div"));
	let displayed: readonly {
		state: string;
	}[] = [];
	const Probe = ({ owner }: { owner: string }) => {
		displayed = useItemLinesStatus(owner);
		return null;
	};
	const renderFn = (owner: string) =>
		act(async () =>
			root.render(
				<RegistryContext.Provider value={registry}>
					<Probe owner={owner} />
				</RegistryContext.Provider>,
			),
		);
	const updateFn = (phase: string, remainingMs = 1000) =>
		act(async () => {
			registry.set(transition, {
				runtime: {
					phase,
					remainingMs,
				},
			});
		});
	const advanceFn = (ms: number) =>
		act(async () => {
			await vi.advanceTimersByTimeAsync(ms);
		});
	try {
		await renderFn("owner:a");
		await updateFn("waiting");
		await advanceFn(50);
		await updateFn("running");
		await advanceFn(100);
		await updateFn("running", 900);
		await advanceFn(99);
		expect(displayed).toEqual([]);
		await advanceFn(1);
		expect(displayed[0]?.state).toBe("running");
		await updateFn("waiting");
		await renderFn("owner:b");
		expect(displayed).toEqual([]);
		await advanceFn(250);
		expect(displayed).toEqual([]);
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
		vi.useRealTimers();
	}
});
