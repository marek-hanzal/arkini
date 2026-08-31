// @vitest-environment jsdom

import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import type { InstalledGameEngineResource } from "~/installed-game/type/Game";
import { Component, type PropsWithChildren } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
	pathname: "/game/package-critical/board",
	resource: null as InstalledGameEngineResource | null,
}));

vi.mock("@tanstack/react-router", () => ({
	getRouteApi: () => ({
		useRouteContext: ({
			select,
		}: {
			readonly select: (context: {
				readonly gameEngineResource: InstalledGameEngineResource;
			}) => InstalledGameEngineResource;
		}) =>
			select({
				gameEngineResource: routeMocks.resource as InstalledGameEngineResource,
			}),
	}),
	useLocation: ({
		select,
	}: {
		readonly select: (location: { readonly pathname: string }) => boolean;
	}) =>
		select({
			pathname: routeMocks.pathname,
		}),
}));

import { GameCriticalFailureBoundary } from "~/game-presentation/ui/GameCriticalFailureBoundary";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

class TestErrorBoundary extends Component<
	PropsWithChildren,
	{
		readonly error: unknown;
	}
> {
	state = {
		error: null,
	};

	static getDerivedStateFromError(error: unknown) {
		return {
			error,
		};
	}

	render() {
		return this.state.error === null
			? this.props.children
			: createElement("div", {
					"data-ui": "CaughtFatalError",
				});
	}
}

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	routeMocks.pathname = "/game/package-critical/board";
	routeMocks.resource = null;
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("GameCriticalFailureBoundary", () => {
	it("throws the mounted resource's first asynchronous critical failure", async () => {
		let failure: CriticalGameLifecycleError | null = null;
		const listeners = new Set<() => void>();
		routeMocks.resource = {
			game: {} as InstalledGameEngineResource["game"],
			assertUsableFn: () => undefined,
			getCriticalFailureFn: () => failure,
			markCriticalFailureFn: (_operation, cause) => {
				failure = cause as CriticalGameLifecycleError;
				for (const listener of listeners) listener();
				return failure;
			},
			subscribeCriticalFailureFn: (listener) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			},
		};

		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					TestErrorBoundary,
					null,
					createElement(
						GameCriticalFailureBoundary,
						null,
						createElement("div", {
							"data-ui": "RunningGame",
						}),
					),
				),
			);
		});
		expect(container.querySelector('[data-ui="RunningGame"]')).not.toBeNull();

		await act(async () => {
			routeMocks.resource?.markCriticalFailureFn(
				"game-runtime",
				new Error("background runtime exploded"),
			);
		});

		expect(container.querySelector('[data-ui="RunningGame"]')).toBeNull();
		expect(container.querySelector('[data-ui="CaughtFatalError"]')).not.toBeNull();
	});

	it("does not interrupt the terminal controlled-close route", async () => {
		routeMocks.pathname = "/game/package-critical/action/exit";
		const failure = new CriticalGameLifecycleError({
			operation: "game-save",
			cause: new Error("best-effort final save failed"),
		});
		routeMocks.resource = {
			game: {} as InstalledGameEngineResource["game"],
			assertUsableFn: () => {
				throw failure;
			},
			getCriticalFailureFn: () => failure,
			markCriticalFailureFn: () => failure,
			subscribeCriticalFailureFn: () => () => undefined,
		};

		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					TestErrorBoundary,
					null,
					createElement(
						GameCriticalFailureBoundary,
						null,
						createElement("div", {
							"data-ui": "ControlledClose",
						}),
					),
				),
			);
		});

		expect(container.querySelector('[data-ui="ControlledClose"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="CaughtFatalError"]')).toBeNull();
	});
});
