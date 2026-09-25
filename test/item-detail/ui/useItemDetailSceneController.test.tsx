// @vitest-environment jsdom
import { act } from "react";
import { Effect } from "effect";
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

it("disables Make across all lines when the owner's queue fills and enables it when capacity returns", async () => {
	state.runtime = lineRunRuntime({});
	const owner = state.runtime.items[0];
	state.game = {
		readFn: Effect.runSyncExit,
		getResourceUrlFn: (id: string) => id,
		subscribeTransitionsFn: () => () => {},
	};
	let output: useItemDetailSceneController.Output | undefined;
	const Probe = () => {
		output = useItemDetailSceneController({
			target: {
				kind: "runtime",
				itemId: owner.id,
				origin: null,
			},
		});
		return null;
	};
	const root = createRoot(document.createElement("div"));
	try {
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.canMake).toBe(true);
		state.runtime = {
			...state.runtime,
			jobQueue: Array.from(
				{
					length: owner.item.maxQueueSize!,
				},
				(_, index) => ({
					id: `request:${index}`,
					ownerItemId: owner.id,
					lineUid: owner.item.lines[0].uid,
				}),
			),
		};
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.canMake).toBe(false);
		state.runtime = {
			...state.runtime,
			jobQueue: state.runtime.jobQueue.slice(1),
		};
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.canMake).toBe(true);
	} finally {
		await act(async () => root.unmount());
	}
});

it("projects the live Default line for Simple without treating the UI mode as an engine rule", async () => {
	const base = lineRunRuntime({
		permit: true,
		water: 3,
	});
	const owner = base.items[0];
	const line = {
		...owner.item.lines[0],
		default: true,
		rules: owner.item.lines[0].rules.map((rule) =>
			rule.type === "enable"
				? {
						...rule,
						hint: "Find a permit.",
					}
				: rule,
		),
	};
	const simpleOwner = {
		...owner,
		item: {
			...owner.item,
			ui: "simple" as const,
			lines: [
				line,
			],
		},
	};
	state.runtime = {
		...base,
		items: [
			simpleOwner,
			...base.items.slice(1),
		],
	};
	state.game = {
		readFn: Effect.runSyncExit,
		getResourceUrlFn: (id: string) => id,
		subscribeTransitionsFn: () => () => {},
	};
	let output: useItemDetailSceneController.Output | undefined;
	const Probe = () => {
		output = useItemDetailSceneController({
			target: {
				kind: "runtime",
				itemId: owner.id,
				origin: null,
			},
		});
		return null;
	};
	const root = createRoot(document.createElement("div"));
	try {
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.defaultLine?.uid).toBe(line.uid);
		expect(output?.detail?.defaultLineDisabled).toBe(false);
		expect(output?.detail?.defaultLinePlayReady).toBe(true);
		state.runtime = {
			...state.runtime,
			items: state.runtime.items.filter((item) => item.id !== "runtime:permit"),
		};
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.defaultLineDisabled).toBe(true);
		expect(output?.detail?.defaultLineBlockingHint).toBe("Find a permit.");
		state.runtime = {
			...state.runtime,
			defaultLineByOwnerItemId: {
				[owner.id]: null,
			},
		};
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.defaultLine).toBeUndefined();
	} finally {
		await act(async () => root.unmount());
	}
});

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
		readFn: Effect.runSyncExit,
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
					itemUid: owner.item.uid,
					location: owner.location,
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

it("updates displayed lines from live Show/Hide rules without treating disabled production as hidden", async () => {
	const hidden = lineRunRuntime({});
	const visible = lineRunRuntime({
		permit: true,
	});
	const vetoed = lineRunRuntime({
		permit: true,
		blocker: true,
	});
	const ownerId = hidden.items[0].id;
	const lineUid = hidden.items[0].item.lines[0].uid;
	state.runtime = hidden;
	state.game = {
		readFn: Effect.runSyncExit,
		getResourceUrlFn: (id: string) => id,
		subscribeTransitionsFn: () => () => {},
	};
	let output: useItemDetailSceneController.Output | undefined;
	const Probe = () => {
		output = useItemDetailSceneController({
			target: {
				kind: "runtime",
				itemId: ownerId,
				origin: null,
			},
		});
		return null;
	};
	const root = createRoot(document.createElement("div"));
	try {
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.lines).toEqual([]);
		state.runtime = visible;
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.lines.map((line) => line.uid)).toEqual([
			lineUid,
		]);
		state.runtime = vetoed;
		await act(async () => root.render(<Probe />));
		expect(output?.detail?.lines).toEqual([]);
		for (const [runtime, disabled] of [
			[
				hidden,
				true,
			],
			[
				visible,
				false,
			],
			[
				vetoed,
				true,
			],
			[
				visible,
				false,
			],
		] as const) {
			state.runtime = {
				...runtime,
				items: runtime.items.map((item) =>
					item.id !== ownerId
						? item
						: {
								...item,
								item: {
									...item.item,
									lines: item.item.lines.flatMap((line) => [
										{
											...line,
											uid: "disabled-first",
											show: true,
											enable: false,
											rules: [],
										},
										{
											...line,
											show: true,
											rules: line.rules.filter(
												(rule) =>
													rule.type !== "show" && rule.type !== "hide",
											),
										},
										{
											...line,
											uid: "enabled-first",
											show: true,
											enable: true,
											rules: [],
										},
										{
											...line,
											uid: "enabled-second",
											show: true,
											enable: true,
											rules: [],
										},
									]),
								},
							},
				),
			};
			await act(async () => root.render(<Probe />));
			expect(output?.detail?.lines.map((line) => line.uid)).toEqual(
				disabled
					? [
							"enabled-first",
							"enabled-second",
							"disabled-first",
							lineUid,
						]
					: [
							lineUid,
							"enabled-first",
							"enabled-second",
							"disabled-first",
						],
			);
			expect(output?.detail?.disabledLineUids).toEqual(
				disabled
					? [
							"disabled-first",
							lineUid,
						]
					: [
							"disabled-first",
						],
			);
			expect(
				state.runtime.items
					.find((item) => item.id === ownerId)
					?.item.lines.map((line) => line.uid),
			).toEqual([
				"disabled-first",
				lineUid,
				"enabled-first",
				"enabled-second",
			]);
		}
	} finally {
		await act(async () => root.unmount());
	}
});
