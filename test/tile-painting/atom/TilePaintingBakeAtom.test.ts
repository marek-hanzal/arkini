import { scheduleTask } from "@effect/atom-react";
import { Deferred, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
	ProjectRepository as RepositoryContext,
	ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import type { bakeAllTilePaintingsFx } from "~/tile-painting/fx/bakeAllTilePaintingsFx";

const state = vi.hoisted(() => ({
	bakeFn: vi.fn(),
	request: undefined as bakeAllTilePaintingsFx.Props | undefined,
}));
vi.mock("~/tile-painting/fx/bakeAllTilePaintingsFx", () => ({
	bakeAllTilePaintingsFx: state.bakeFn,
}));
vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	const { ProjectRepository } = await import("~/project-authoring/service/ProjectRepository");
	return {
		RendererRuntime: {
			runSync: <A, E>(fx: Effect.Effect<A, E, RepositoryContext>) =>
				Effect.runSync(
					fx.pipe(
						Effect.provideService(ProjectRepository, {} as ProjectRepositoryService),
					),
				),
		},
	};
});
import { TilePaintingBakeAtom } from "~/tile-painting/atom/TilePaintingBakeAtom";

let registry: AtomRegistry.AtomRegistry;
let gate: Deferred.Deferred<void, Error>;
beforeEach(() => {
	registry = AtomRegistry.make({
		defaultIdleTTL: 10,
		scheduleTask,
	});
	gate = Effect.runSync(Deferred.make<void, Error>());
	state.request = undefined;
	state.bakeFn.mockReset().mockImplementation((request: bakeAllTilePaintingsFx.Props) => {
		state.request = request;
		return Deferred.await(gate).pipe(
			Effect.as({
				bakedCount: 4,
				skippedCount: 0,
				paintings: [],
			}),
		);
	});
});
afterEach(() => registry.dispose());

it("retains progress and rejects duplicate batch admission after route remount", async () => {
	const atom = TilePaintingBakeAtom("batch-project");
	const unmountFn = registry.mount(atom);
	registry.set(atom, {
		kind: "bake",
		total: 4,
	});
	await vi.waitFor(() => expect(state.request).toBeDefined());
	state.request?.onProgressFn?.(1, 4);
	unmountFn();
	await new Promise((resolveFn) => setTimeout(resolveFn, 20));
	state.request?.onProgressFn?.(2, 4);
	const remountFn = registry.mount(atom);
	expect(registry.get(atom)).toEqual({
		kind: "baking",
		progress: {
			completed: 2,
			total: 4,
		},
	});
	registry.set(atom, {
		kind: "bake",
		total: 4,
	});
	expect(state.bakeFn).toHaveBeenCalledOnce();
	state.request?.onProgressFn?.(4, 4);
	expect(registry.get(atom).kind).toBe("baking");
	Effect.runSync(Deferred.succeed(gate, undefined));
	await vi.waitFor(() =>
		expect(registry.get(atom)).toMatchObject({
			kind: "success",
			result: {
				bakedCount: 4,
			},
		}),
	);
	remountFn();
});

it("retains a failed batch across remount and allows an explicit retry", async () => {
	const atom = TilePaintingBakeAtom("failed-batch-project");
	const unmountFn = registry.mount(atom);
	registry.set(atom, {
		kind: "bake",
		total: 4,
	});
	await vi.waitFor(() => expect(state.request).toBeDefined());
	unmountFn();
	const error = new Error("Source changed while baking");
	Effect.runSync(Deferred.fail(gate, error));
	await vi.waitFor(() =>
		expect(registry.get(atom)).toEqual({
			kind: "failure",
			error,
		}),
	);
	const remountFn = registry.mount(atom);
	expect(registry.get(atom)).toEqual({
		kind: "failure",
		error,
	});
	gate = Effect.runSync(Deferred.make<void, Error>());
	registry.set(atom, {
		kind: "bake",
		total: 4,
	});
	await vi.waitFor(() => expect(state.bakeFn).toHaveBeenCalledTimes(2));
	expect(registry.get(atom).kind).toBe("baking");
	Effect.runSync(Deferred.succeed(gate, undefined));
	await vi.waitFor(() => expect(registry.get(atom).kind).toBe("success"));
	remountFn();
});
