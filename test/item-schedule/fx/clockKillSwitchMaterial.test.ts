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
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

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
							query: {
								distance: "far",
								selector: {
									type: "item" as const,
									itemId: "blocker",
								},
							},
							mode: "reserve" as const,
							quantity: {
								min: 1,
								max: 1,
							},
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
	it("expires committed material, aborts its job, and returns reservations", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "owner",
					itemId: "owner",
					location: boardFn(0),
				});
				const material = yield* spawnItemFx({
					id: "material",
					itemId: "temporary",
					location: boardFn(1),
				});
				const reserve = yield* spawnItemFx({
					id: "reserve",
					itemId: "blocker",
					location: boardFn(2),
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
					});
				}
				yield* startLineFx({
					ownerItemId: "owner",
					lineId: "line:owner",
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
		expect(result.before.items.find((item) => item.id === "owner")?.location.scope).toBe(
			"board",
		);
		expect(result.after.jobs).toEqual([]);
		expect(result.after.items.some((item) => item.id === "material")).toBe(false);
		expect(result.after.items.find((item) => item.item.id === "blocker")).toMatchObject({
			location: {
				scope: "board",
				space: 0,
			},
		});
		expect(result.after.items.some((item) => item.item.id === "residue")).toBe(true);
		const transition = result.committed.transition!;
		expect(transition.previousRuntime).toEqual(result.before);
		expect(transition.runtime).toEqual(result.after);
		expect(transition.events).toContainEqual(
			expect.objectContaining({
				type: GameEventEnumSchema.enum.JobAborted,
				canonicalItemId: "owner",
				ownerItemId: "owner",
				reason: "material-expired",
			}),
		);
	});
});
