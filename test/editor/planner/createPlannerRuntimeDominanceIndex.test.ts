import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createPlannerRuntimeDominanceIndexFx } from "~/editor/planner/createPlannerRuntimeDominanceIndexFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const runtime = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 0,
	items: [],
	jobs: [],
	jobQueue: [],
} satisfies RuntimeSchema.Type;

const label = {
	elapsedMs: 100,
	outputCertainty: "deterministic" as const,
	selectedWitnessProbability: 1,
	traceLength: 2,
};

describe("createPlannerRuntimeDominanceIndexFx", () => {
	it("rejects an equal or strictly worse path to the same canonical runtime", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const index = yield* createPlannerRuntimeDominanceIndexFx();
				const first = yield* index.registerFx({
					label,
					runtime,
				});
				const equal = yield* index.registerFx({
					label,
					runtime: structuredClone(runtime),
				});
				const worse = yield* index.registerFx({
					label: {
						...label,
						elapsedMs: 101,
						traceLength: 3,
					},
					runtime,
				});
				return {
					equal,
					fingerprintCount: yield* index.readFingerprintCountFx,
					first,
					worse,
				};
			}),
		);

		expect(result.first).toMatchObject({
			accepted: true,
			newFingerprint: true,
		});
		expect(result.equal).toMatchObject({
			accepted: false,
		});
		expect(result.worse).toMatchObject({
			accepted: false,
		});
		expect(result.fingerprintCount).toBe(1);
	});

	it("invalidates a dominated frontier label when a better path arrives", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const index = yield* createPlannerRuntimeDominanceIndexFx();
				const slower = yield* index.registerFx({
					label: {
						...label,
						elapsedMs: 200,
					},
					runtime,
				});
				const faster = yield* index.registerFx({
					label,
					runtime,
				});
				if (!slower.accepted || !faster.accepted)
					return {
						faster,
						slower,
					} as const;
				return {
					faster,
					fasterActive: yield* index.isActiveFx(faster.fingerprint, faster.token),
					slower,
					slowerActive: yield* index.isActiveFx(slower.fingerprint, slower.token),
				} as const;
			}),
		);

		expect(result.slower.accepted).toBe(true);
		expect(result.faster.accepted).toBe(true);
		if (!("slowerActive" in result)) return;
		expect(result.slowerActive).toBe(false);
		expect(result.fasterActive).toBe(true);
	});

	it("keeps incomparable reporting paths on the same runtime Pareto frontier", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const index = yield* createPlannerRuntimeDominanceIndexFx();
				const shorter = yield* index.registerFx({
					label: {
						...label,
						elapsedMs: 200,
						traceLength: 1,
					},
					runtime,
				});
				const faster = yield* index.registerFx({
					label: {
						...label,
						elapsedMs: 100,
						traceLength: 2,
					},
					runtime,
				});
				if (!shorter.accepted || !faster.accepted)
					return {
						faster,
						shorter,
					} as const;
				return {
					faster,
					fasterActive: yield* index.isActiveFx(faster.fingerprint, faster.token),
					shorter,
					shorterActive: yield* index.isActiveFx(shorter.fingerprint, shorter.token),
				} as const;
			}),
		);

		expect(result.shorter.accepted).toBe(true);
		expect(result.faster.accepted).toBe(true);
		if (!("shorterActive" in result)) return;
		expect(result.shorterActive).toBe(true);
		expect(result.fasterActive).toBe(true);
	});

	it("treats deterministic provenance as stronger only when other costs are no worse", () => {
		const evaluate = (deterministicElapsedMs: number) =>
			Effect.runSync(
				Effect.gen(function* () {
					const index = yield* createPlannerRuntimeDominanceIndexFx();
					const possible = yield* index.registerFx({
						label: {
							...label,
							outputCertainty: "possible",
						},
						runtime,
					});
					const deterministic = yield* index.registerFx({
						label: {
							...label,
							elapsedMs: deterministicElapsedMs,
						},
						runtime,
					});
					if (!possible.accepted)
						return {
							deterministic,
							possible,
						} as const;
					return {
						deterministic,
						possible,
						possibleActive: yield* index.isActiveFx(
							possible.fingerprint,
							possible.token,
						),
					} as const;
				}),
			);

		const stronger = evaluate(100);
		expect(stronger.deterministic.accepted).toBe(true);
		if ("possibleActive" in stronger) expect(stronger.possibleActive).toBe(false);

		const costlier = evaluate(200);
		expect(costlier.deterministic.accepted).toBe(true);
		if ("possibleActive" in costlier) expect(costlier.possibleActive).toBe(true);
	});

	it("keeps a more probable witness unless its other reporting costs are worse", () => {
		const evaluate = (moreProbableElapsedMs: number) =>
			Effect.runSync(
				Effect.gen(function* () {
					const index = yield* createPlannerRuntimeDominanceIndexFx();
					const lessProbable = yield* index.registerFx({
						label: {
							...label,
							outputCertainty: "possible",
							selectedWitnessProbability: 0.25,
						},
						runtime,
					});
					const moreProbable = yield* index.registerFx({
						label: {
							...label,
							elapsedMs: moreProbableElapsedMs,
							outputCertainty: "possible",
							selectedWitnessProbability: 0.5,
						},
						runtime,
					});
					if (!lessProbable.accepted)
						return {
							lessProbable,
							moreProbable,
						} as const;
					return {
						lessProbable,
						lessProbableActive: yield* index.isActiveFx(
							lessProbable.fingerprint,
							lessProbable.token,
						),
						moreProbable,
					} as const;
				}),
			);

		const stronger = evaluate(100);
		expect(stronger.moreProbable.accepted).toBe(true);
		if ("lessProbableActive" in stronger) expect(stronger.lessProbableActive).toBe(false);

		const costlier = evaluate(101);
		expect(costlier.moreProbable.accepted).toBe(true);
		if ("lessProbableActive" in costlier) expect(costlier.lessProbableActive).toBe(true);
	});

	it("allows a beam-pruned label to be explored again without forgetting visit accounting", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const index = yield* createPlannerRuntimeDominanceIndexFx();
				const first = yield* index.registerFx({
					label: {
						...label,
						traceLength: 1,
					},
					runtime,
				});
				if (!first.accepted) throw new Error("Expected first registration to succeed.");
				yield* index.deactivateFx(first.fingerprint, first.token);
				const firstActive = yield* index.isActiveFx(first.fingerprint, first.token);
				const second = yield* index.registerFx({
					label: {
						...label,
						traceLength: 1,
					},
					runtime,
				});
				return {
					fingerprintCount: yield* index.readFingerprintCountFx,
					firstActive,
					second,
				};
			}),
		);

		expect(result.firstActive).toBe(false);
		expect(result.second).toMatchObject({
			accepted: true,
			newFingerprint: false,
		});
		expect(result.fingerprintCount).toBe(1);
	});
});
