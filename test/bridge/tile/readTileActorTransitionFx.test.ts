import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readTileActorTransitionFx } from "~/bridge/tile/readTileActorTransitionFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const projectionState = vi.hoisted(() => ({
	runtimes: [] as RuntimeSchema.Type[],
}));

vi.mock("~/bridge/tile/readTileActorsFx", async () => {
	const { Effect } = await import("effect");

	return {
		readTileActorsFx: ({ runtime }: { readonly runtime: RuntimeSchema.Type }) =>
			Effect.sync(() => {
				projectionState.runtimes.push(runtime);
				return [];
			}),
	};
});

const runtime = (name: string) =>
	({
		name,
	}) as unknown as RuntimeSchema.Type;

const transition = (
	previousRuntime: RuntimeSchema.Type,
	liveRuntime: RuntimeSchema.Type,
): CommittedTransitionSchema.Type =>
	({
		sequence: 1,
		previousRuntime,
		runtime: liveRuntime,
		events: [],
	}) as CommittedTransitionSchema.Type;

beforeEach(() => {
	projectionState.runtimes.length = 0;
});

describe("readTileActorTransitionFx", () => {
	it("projects only the live world when previous actors are already exact or unnecessary", async () => {
		const previousRuntime = runtime("previous");
		const liveRuntime = runtime("live");

		const result = await Effect.runPromise(
			readTileActorTransitionFx({
				game: {} as GameEngine,
				transition: transition(previousRuntime, liveRuntime),
				includePreviousItems: false,
			}),
		);

		expect(projectionState.runtimes).toEqual([
			liveRuntime,
		]);
		expect(result.previousItems).toBeNull();
	});

	it("projects the bounded previous world before the live world when recovery requires it", async () => {
		const previousRuntime = runtime("previous");
		const liveRuntime = runtime("live");

		const result = await Effect.runPromise(
			readTileActorTransitionFx({
				game: {} as GameEngine,
				transition: transition(previousRuntime, liveRuntime),
				includePreviousItems: true,
			}),
		);

		expect(projectionState.runtimes).toEqual([
			previousRuntime,
			liveRuntime,
		]);
		expect(result.previousItems).toEqual([]);
	});
});
