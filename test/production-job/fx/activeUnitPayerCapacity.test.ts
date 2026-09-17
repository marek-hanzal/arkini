import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { useGameFx } from "~test/support/useGameFx";

import { config, spawn, payerRequest, makerRequest } from "./activeUnitPayerCapacity.test/fixture";

describe("active external unit payer capacity", () => {
	it("rejects output that borrows another active job's future owner removal", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawn("payer", 0);
				yield* spawn("maker", 1);
				yield* enqueueLineFx(payerRequest);
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				const before = yield* readRuntimeFx();
				const admission = yield* Effect.result(enqueueLineFx(makerRequest));
				return {
					admission,
					before,
					after: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: config(),
				}),
			),
		);

		expect(Result.isFailure(result.admission)).toBe(true);
		if (Result.isFailure(result.admission)) {
			expect(result.admission.failure).toMatchObject({
				_tag: "OutputCapacityError",
				itemId: "payer",
			});
		}
		expect(result.after).toBe(result.before);
	});

	it("keeps accepted work blocked while the payer is active, then starts after its completion", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawn("payer", 0);
				yield* spawn("maker", 1);
				// Idle depletion can supply immediate capacity when this request is accepted.
				yield* enqueueLineFx(makerRequest);
				yield* enqueueLineFx(payerRequest);
				// The payer's queued intent initially prevents its external depletion. It starts
				// behind the blocked maker; the next pass must recheck its deferred lifecycle.
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 200,
				});
				const blocked = yield* readRuntimeFx();
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 9800,
				});
				const started = yield* readRuntimeFx();
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 1000,
				});
				return {
					blocked,
					started,
					completed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: config(),
				}),
			),
		);

		expect(result.blocked.jobs).toMatchObject([
			{
				ownerItemId: "runtime:payer",
				remainingMs: 9800,
			},
		]);
		expect(result.blocked.jobQueue).toMatchObject([
			makerRequest,
		]);
		expect(
			result.blocked.items.find((item) => item.id === "runtime:payer")?.remainingUnits,
		).toBeUndefined();
		expect(result.started.jobs).toMatchObject([
			{
				ownerItemId: "runtime:maker",
				remainingMs: 1000,
			},
		]);
		expect(result.started.items.some((item) => item.id === "runtime:payer")).toBe(false);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.jobQueue).toEqual([]);
		expect(result.completed.items.filter((item) => item.item.id === "payer")).toHaveLength(1);
	});

	it("nets deferred depletion output against material consumed by the payer's own job", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawn("payer", 0);
				yield* spawn("maker", 1);
				const material = yield* spawn("material", 2);
				yield* storeInputMaterialFx({
					...payerRequest,
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
					quantity: 1,
				});
				yield* enqueueLineFx(payerRequest);
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				yield* enqueueLineFx(makerRequest);
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 1000,
				});
				const makerCompleted = yield* readRuntimeFx();
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 8900,
				});
				return {
					makerCompleted,
					completed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: config(true),
				}),
			),
		);

		expect(result.makerCompleted.jobs).toMatchObject([
			{
				ownerItemId: "runtime:payer",
				remainingMs: 8900,
			},
		]);
		expect(
			result.makerCompleted.items.find((item) => item.id === "runtime:payer")?.remainingUnits,
		).toBe(0);
		expect(
			result.makerCompleted.items.find((item) => item.item.id === "material")?.location.scope,
		).toBe("job");
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.items.some((item) => item.id === "runtime:payer")).toBe(false);
		expect(result.completed.items.filter((item) => item.item.id === "material")).toMatchObject([
			{
				quantity: 1,
				location: {
					scope: "board",
				},
			},
		]);
	});
});
