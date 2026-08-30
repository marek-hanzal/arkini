// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const applicationState = vi.hoisted(() => ({
	instances: [] as Array<{
		readonly canvas: HTMLCanvasElement;
		readonly resolveInit: () => void;
	}>,
}));

vi.mock("pixi.js", () => {
	class Application {
		readonly canvas = document.createElement("canvas");
		readonly renderer = {
			resize: vi.fn(),
		};
		readonly screen = {
			height: 1,
			width: 1,
		};
		readonly stage = {};
		readonly ticker = {
			stop: vi.fn(),
		};
		private resolveInit: () => void = () => undefined;

		constructor() {
			applicationState.instances.push({
				canvas: this.canvas,
				resolveInit: () => this.resolveInit(),
			});
		}

		init() {
			return new Promise<void>((resolve) => {
				this.resolveInit = resolve;
			});
		}

		render() {}

		destroy() {
			this.canvas.remove();
		}
	}

	return {
		Application,
		Ticker: {
			system: {
				autoStart: false,
				stop: vi.fn(),
			},
		},
	};
});

vi.mock("~/tile-rendering/fx/createDemandFrameLoopFx", () => ({
	createDemandFrameLoopFx: () =>
		Effect.succeed({
			closeFx: Effect.void,
			invalidateFx: Effect.void,
		}),
}));

import { createApplicationOwnerFx } from "~/tile-rendering/fx/createApplicationOwnerFx";

describe("Pixi application owner", () => {
	it("never lets an older async initialization replace a newer host owner", async () => {
		const host = document.createElement("div");
		const first = Effect.runPromise(
			createApplicationOwnerFx({
				host,
				reportCriticalFailure: vi.fn(),
			}),
		);
		const second = Effect.runPromise(
			createApplicationOwnerFx({
				host,
				reportCriticalFailure: vi.fn(),
			}),
		);
		const firstApp = applicationState.instances.at(-2);
		const secondApp = applicationState.instances.at(-1);
		if (firstApp === undefined || secondApp === undefined) {
			throw new Error("Expected two Pixi applications.");
		}

		secondApp.resolveInit();
		const secondOwner = await second;
		expect(host.firstElementChild).toBe(secondApp.canvas);
		expect(secondApp.canvas.getAttribute("title")).toBeNull();
		expect(secondApp.canvas.getAttribute("role")).toBeNull();
		expect(secondApp.canvas.getAttribute("aria-hidden")).toBeNull();

		firstApp.resolveInit();
		await expect(first).rejects.toThrow("newer Pixi application");
		expect(host.firstElementChild).toBe(secondApp.canvas);

		await Effect.runPromise(secondOwner.closeFx);
	});
});
