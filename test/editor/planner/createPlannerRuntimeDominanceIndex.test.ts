import { describe, expect, it } from "vitest";

import {
	createPlannerRuntimeDominanceIndex,
	dominatesPlannerRuntimePath,
} from "~/editor/planner/createPlannerRuntimeDominanceIndex";
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

describe("createPlannerRuntimeDominanceIndex", () => {
	it("rejects an equal or strictly worse path to the same canonical runtime", () => {
		const index = createPlannerRuntimeDominanceIndex();
		const first = index.register({
			label,
			runtime,
		});
		const equal = index.register({
			label,
			runtime: structuredClone(runtime),
		});
		const worse = index.register({
			label: {
				...label,
				elapsedMs: 101,
				traceLength: 3,
			},
			runtime,
		});

		expect(first).toMatchObject({
			accepted: true,
			newFingerprint: true,
		});
		expect(equal).toMatchObject({
			accepted: false,
		});
		expect(worse).toMatchObject({
			accepted: false,
		});
		expect(index.readFingerprintCount()).toBe(1);
	});

	it("invalidates a dominated frontier label when a better path arrives", () => {
		const index = createPlannerRuntimeDominanceIndex();
		const slower = index.register({
			label: {
				...label,
				elapsedMs: 200,
			},
			runtime,
		});
		const faster = index.register({
			label,
			runtime,
		});

		expect(slower.accepted).toBe(true);
		expect(faster.accepted).toBe(true);
		if (!slower.accepted || !faster.accepted) return;
		expect(index.isActive(slower.fingerprint, slower.token)).toBe(false);
		expect(index.isActive(faster.fingerprint, faster.token)).toBe(true);
	});

	it("keeps incomparable reporting paths on the same runtime Pareto frontier", () => {
		const index = createPlannerRuntimeDominanceIndex();
		const shorter = index.register({
			label: {
				...label,
				elapsedMs: 200,
				traceLength: 1,
			},
			runtime,
		});
		const faster = index.register({
			label: {
				...label,
				elapsedMs: 100,
				traceLength: 2,
			},
			runtime,
		});

		expect(shorter.accepted).toBe(true);
		expect(faster.accepted).toBe(true);
		if (!shorter.accepted || !faster.accepted) return;
		expect(index.isActive(shorter.fingerprint, shorter.token)).toBe(true);
		expect(index.isActive(faster.fingerprint, faster.token)).toBe(true);
	});

	it("treats deterministic provenance as stronger only when other costs are no worse", () => {
		expect(
			dominatesPlannerRuntimePath(label, {
				...label,
				outputCertainty: "possible",
			}),
		).toBe(true);
		expect(
			dominatesPlannerRuntimePath(
				{
					...label,
					elapsedMs: 200,
				},
				{
					...label,
					outputCertainty: "possible",
				},
			),
		).toBe(false);
	});

	it("keeps a more probable witness unless its other reporting costs are worse", () => {
		expect(
			dominatesPlannerRuntimePath(
				{
					...label,
					outputCertainty: "possible",
					selectedWitnessProbability: 0.5,
				},
				{
					...label,
					outputCertainty: "possible",
					selectedWitnessProbability: 0.25,
				},
			),
		).toBe(true);
		expect(
			dominatesPlannerRuntimePath(
				{
					...label,
					elapsedMs: 101,
					outputCertainty: "possible",
					selectedWitnessProbability: 0.5,
				},
				{
					...label,
					outputCertainty: "possible",
					selectedWitnessProbability: 0.25,
				},
			),
		).toBe(false);
	});
});
