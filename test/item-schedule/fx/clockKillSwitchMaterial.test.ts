import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { modifyRuntimeWithTransitionFx } from "~/game-runtime/fx/modifyRuntimeWithTransitionFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { createTemporaryMaterialLifecycleTestConfig } from "./temporaryMaterialLifecycle.test/createTemporaryMaterialLifecycleTestConfig";

const boardFn = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});
const configFn = () => {
	const config = createTemporaryMaterialLifecycleTestConfig();
	const owner = config.items.owner!;
	const temporary = config.items.temporary!;
	return GameConfigSchema.parse({
		...config,
		items: {
			...config.items,
			owner: {
				...owner,
				lines: owner.lines.map((line) => ({
					...line,
					input: [
						...line.input,
						{
							type: "materials" as const,
							selector: {
								type: "item" as const,
								itemId: "blocker",
							},
							mode: "reserve" as const,
							quantity: {
								min: 1,
								max: 1,
							},
							capacity: 0,
						},
					],
				})),
			},
			temporary: {
				...temporary,
				clock: {
					...temporary.clock!,
					durationMs: 100,
					expiryMode: "kill-switch" as const,
				},
			},
		},
	});
};

describe("kill-switch material expiry", () => {
	it.each([
		false,
		true,
	])(
		"atomically aborts its parent job and prioritizes reservations over expiry output (full=%s)",
		(full) => {
			const result = Effect.runSync(
				Effect.gen(function* () {
					yield* spawnItemFx({
						id: "owner",
						itemId: "owner",
						location: boardFn(0),
						quantity: 1,
					});
					const material = yield* spawnItemFx({
						id: "material",
						itemId: "temporary",
						location: boardFn(1),
						quantity: 1,
					});
					const reserve = yield* spawnItemFx({
						id: "reserve",
						itemId: "blocker",
						location: boardFn(2),
						quantity: 1,
					});
					for (const [inputIndex, source] of [
						[
							0,
							material,
						],
						[
							1,
							reserve,
						],
					] as const) {
						yield* storeInputMaterialFx({
							ownerItemId: "owner",
							lineId: "line:owner",
							inputIndex,
							sourceItemId: source.id,
							sourceItemRevision: source.revision,
							quantity: 1,
						});
					}
					yield* startLineFx({
						ownerItemId: "owner",
						lineId: "line:owner",
					});
					yield* spawnItemFx({
						id: "filler:2",
						itemId: "product",
						location: boardFn(2),
						quantity: 1,
					});
					if (full)
						yield* spawnItemFx({
							id: "filler:1",
							itemId: "product",
							location: boardFn(1),
							quantity: 1,
						});
					const before = yield* readRuntimeFx();
					const committed = yield* modifyRuntimeWithTransitionFx((runtime) =>
						Effect.gen(function* () {
							const step = yield* advanceRuntimeStepFx(runtime);
							return [
								undefined,
								step.runtime,
								step.events,
							] as const;
						}),
					);
					return {
						before,
						committed,
						after: yield* readRuntimeFx(),
					};
				}).pipe(
					useGameFx({
						config: configFn(),
					}),
				),
			);
			expect(result.after.jobs).toEqual([]);
			expect(result.after.items.some((item) => item.id === "material")).toBe(false);
			expect(result.after.items.some((item) => item.item.id === "residue")).toBe(false);
			expect(result.after.items.filter((item) => item.item.id === "blocker")).toHaveLength(
				full ? 0 : 1,
			);
			const transition = result.committed.transition!;
			expect(transition.previousRuntime).toEqual(result.before);
			expect(transition.runtime).toEqual(result.after);
			expect(transition.events).toContainEqual(
				expect.objectContaining({
					type: "job:aborted",
					reason: "material-expired",
					ownerItemId: "owner",
				}),
			);
			expect(transition.events).toContainEqual(
				expect.objectContaining({
					type: "item:discarded",
					source: "expiry-output",
					canonicalItemId: "residue",
					quantity: 1,
				}),
			);
			expect(
				transition.events.filter(
					(event) => event.type === "item:discarded" && event.source === "reservation",
				),
			).toHaveLength(full ? 1 : 0);
		},
	);
});
