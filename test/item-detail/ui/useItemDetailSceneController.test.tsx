// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { GameTransition } from "~/game-session/type/GameSession";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { lineRunRuntime } from "~test/production-line/support/lineRunTestRuntime";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
	game: {} as object,
	runtime: {} as RuntimeSchema.Type,
}));
vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => state.game,
}));
vi.mock("~/game-presentation/ui/useRuntimeSelector", () => ({
	useRuntimeSelector: (_game: unknown, selectorFn: (runtime: RuntimeSchema.Type) => unknown) =>
		selectorFn(state.runtime),
}));

it("retains the terminal commit across batched updates and detaches when the target changes", async () => {
	const base = lineRunRuntime({});
	const owner = {
		...base.items[0],
		remainingUnits: 1,
		item: {
			...base.items[0].item,
			units: {
				amount: 8,
			},
		},
	};
	state.runtime = {
		...base,
		items: [
			owner,
		],
	};
	const listeners = new Set<(transition: GameTransition) => void>();
	state.game = {
		getResourceUrlFn: (id: string) => id,
		subscribeTransitionsFn: (listenerFn: (transition: GameTransition) => void) => {
			listeners.add(listenerFn);
			return () => listeners.delete(listenerFn);
		},
	};
	let output: useItemDetailSceneController.Output | undefined;
	const Probe = ({ id }: { id: string }) => {
		output = useItemDetailSceneController({
			target: {
				kind: "runtime",
				itemId: id,
				tab: "info",
				origin: null,
			},
		});
		return null;
	};
	const root = createRoot(document.createElement("div"));
	try {
		await act(async () => root.render(<Probe id={owner.id} />));
		expect(output?.detail?.units?.remaining).toBe(1);
		const removal = CommittedTransitionSchema.parse({
			sequence: 1,
			previousRuntime: state.runtime,
			runtime: {
				...state.runtime,
				items: [],
			},
			events: [
				{
					type: "item:removed",
					snapshot: {
						...owner,
						remainingUnits: 0,
					},
				},
				{
					type: "item:depleted",
					itemId: owner.id,
					canonicalItemId: owner.item.id,
					location: owner.location,
					previousQuantity: 1,
					resultingQuantity: 0,
				},
			],
		});
		await act(async () => {
			state.runtime = removal.runtime;
			for (const listenerFn of listeners) {
				listenerFn(removal);
				listenerFn({
					sequence: 2,
					previousRuntime: removal.runtime,
					runtime: removal.runtime,
					events: [],
				});
			}
		});
		expect(output).toMatchObject({
			stale: true,
			removalReason: "depleted",
			detail: {
				units: {
					remaining: 0,
					total: 8,
				},
			},
		});
		await act(async () => root.render(<Probe id="different-instance" />));
		expect(output?.detail).toBeUndefined();
		expect(output?.removalReason).toBeUndefined();
		expect(listeners.size).toBe(1);
	} finally {
		await act(async () => root.unmount());
	}
	expect(listeners.size).toBe(0);
});
