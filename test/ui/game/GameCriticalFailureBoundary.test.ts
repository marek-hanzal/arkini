// @vitest-environment jsdom

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { Component, type PropsWithChildren } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
	pathname: "/game/package-critical/board",
	resource: null as GameEngineResource | null,
}));

vi.mock("@tanstack/react-router", () => ({
	getRouteApi: () => ({
		useRouteContext: ({
			select,
		}: {
			readonly select: (context: {
				readonly gameEngineResource: GameEngineResource;
			}) => GameEngineResource;
		}) =>
			select({
				gameEngineResource: routeMocks.resource as GameEngineResource,
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

import { GameCriticalFailureBoundary } from "~/ui/game/GameCriticalFailureBoundary";

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
			session: {} as GameEngineResource["session"],
			game: {} as GameEngineResource["game"],
			assertUsable: () => undefined,
			getCriticalFailure: () => failure,
			markCriticalFailure: (_operation, cause) => {
				failure = cause as CriticalGameLifecycleError;
				for (const listener of listeners) listener();
				return failure;
			},
			subscribeCriticalFailure: (listener) => {
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
			routeMocks.resource?.markCriticalFailure(
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
			session: {} as GameEngineResource["session"],
			game: {} as GameEngineResource["game"],
			assertUsable: () => {
				throw failure;
			},
			getCriticalFailure: () => failure,
			markCriticalFailure: () => failure,
			subscribeCriticalFailure: () => () => undefined,
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
