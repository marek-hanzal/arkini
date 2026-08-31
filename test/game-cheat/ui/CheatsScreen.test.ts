// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as CheatsRouteDefinition } from "~/@routes/game/$packageId/cheats";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	available: true,
	back: vi.fn(),
	blocked: true,
	listeners: new Set<() => void>(),
	navigate: vi.fn(() => Promise.resolve()),
	publishBlocked: (blocked: boolean) => {
		state.blocked = blocked;
		for (const listener of state.listeners) listener();
	},
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: object) => ({
		options,
	}),
	redirect: vi.fn(),
	useNavigate: () => state.navigate,
	useRouter: () => ({
		history: {
			back: state.back,
			canGoBack: () => true,
		},
	}),
}));
vi.mock("~/game-shell/ui/PlayableGameResources", async () => {
	const { Fragment } = await import("react");
	return {
		PlayableGameResources: Fragment,
	};
});
vi.mock("~/game-presentation/ui/useGameEngine", () => {
	const useGameEngine = () => ({
		arkpack: {
			packageId: "package:cheats",
		},
		saveKey: {
			packageId: "package:cheats",
		},
	});
	return {
		useGameEngine,
		usePackageGameEngine: useGameEngine,
	};
});
vi.mock("~/application-settings/ui/useCheatAvailability", async () => {
	const { useSyncExternalStore } = await import("react");
	return {
		useCheatAvailability: () => {
			const available = useSyncExternalStore(
				(listener) => {
					state.listeners.add(listener);
					return () => state.listeners.delete(listener);
				},
				() => state.available,
				() => state.available,
			);
			return {
				available,
			};
		},
	};
});
vi.mock("~/game-cheat/ui/useCheatsModel", async () => {
	const { useSyncExternalStore } = await import("react");
	return {
		useCheatsModel: () => {
			const blocked = useSyncExternalStore(
				(listener) => {
					state.listeners.add(listener);
					return () => state.listeners.delete(listener);
				},
				() => state.blocked,
				() => state.blocked,
			);
			return {
				blocked,
				enabled: true,
				instantGameplay: false,
				requestExit: (runFx: import("effect").Effect.Effect<void, unknown>) => {
					if (state.blocked) return;
					state.publishBlocked(true);
					void Effect.runPromise(runFx)
						.catch(() => undefined)
						.finally(() => state.publishBlocked(false));
				},
				status: {
					kind: "idle" as const,
				},
				setEnabled: vi.fn(),
				setInstantGameplay: vi.fn(),
			};
		},
	};
});
vi.mock("~/game-cheat/ui/Cheats", async () => {
	const { createElement } = await import("react");
	return {
		Cheats: ({
			model,
			onBack,
		}: {
			readonly model: {
				readonly blocked: boolean;
			};
			readonly onBack: () => void;
		}) => {
			return createElement(
				"button",
				{
					disabled: model.blocked,
					onClick: onBack,
					type: "button",
				},
				"Back to game",
			);
		},
	};
});

const CheatsScreen = CheatsRouteDefinition.options.component;
if (CheatsScreen === undefined) throw new Error("Cheats route component is missing.");

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.available = true;
	state.back.mockReset();
	state.blocked = true;
	state.listeners.clear();
	state.navigate.mockClear();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("CheatsScreen", () => {
	it("keeps Escape on the Cheats route until the active mutation settles", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(createElement(CheatsScreen));
		});

		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(state.back).not.toHaveBeenCalled();
		expect(state.navigate).not.toHaveBeenCalled();

		await act(async () => state.publishBlocked(false));
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(state.back).toHaveBeenCalledOnce();
		expect(state.navigate).not.toHaveBeenCalled();
	});

	it("requests exactly one replacement exit when unavailable navigation rejects", async () => {
		state.available = false;
		state.blocked = false;
		state.navigate.mockRejectedValueOnce(new Error("board navigation failed"));
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(createElement(CheatsScreen));
			await Promise.resolve();
		});
		await vi.waitFor(() => expect(state.navigate).toHaveBeenCalledOnce());
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			root.render(createElement(CheatsScreen));
		});

		expect(state.navigate).toHaveBeenCalledOnce();
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/board",
			params: {
				packageId: "package:cheats",
			},
			replace: true,
		});
		expect(state.back).not.toHaveBeenCalled();
	});
});
