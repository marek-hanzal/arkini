// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { Project } from "~/project-authoring/type/Project";

const state = vi.hoisted(() => ({
	requestEstimateFn: vi.fn(),
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () => state.requestEstimateFn,
}));

import { ItemEstimateWarmup } from "~/estimate/ui/ItemEstimateWarmup";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const config = {
	items: {},
} as unknown as GameConfigSchema.Type;
const project = (projectId: string, revision: number): Project => ({
	config,
	createdAtMs: 1,
	projectId,
	resources: [],
	revision,
	title: projectId,
	updatedAtMs: 1,
	version: "1.0",
});
const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	state.requestEstimateFn.mockReset();
	document.body.replaceChildren();
});

describe("ItemEstimateWarmup", () => {
	it("warms one editor-entry revision without recalculating after a same-project save", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => root.render(<ItemEstimateWarmup project={project("alpha", 1)} />));
		await act(async () => root.render(<ItemEstimateWarmup project={project("alpha", 2)} />));

		expect(state.requestEstimateFn).toHaveBeenCalledOnce();
		expect(state.requestEstimateFn).toHaveBeenCalledWith({
			config,
			projectId: "alpha",
			revision: 1,
		});

		await act(async () => root.render(<ItemEstimateWarmup project={project("bravo", 1)} />));
		expect(state.requestEstimateFn).toHaveBeenCalledTimes(2);
		expect(state.requestEstimateFn).toHaveBeenLastCalledWith({
			config,
			projectId: "bravo",
			revision: 1,
		});
	});
});
