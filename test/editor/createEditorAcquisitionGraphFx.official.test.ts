import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("createEditorAcquisitionGraphFx", () => {
	it("estimates the complete official item index within the static-analysis budget", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const started = performance.now();
		const estimates = Object.keys(config.items)
			.sort((left, right) => left.localeCompare(right))
			.map((factId) =>
				Effect.runSync(
					estimateEditorItemFx({
						factId,
						graph,
					}),
				),
			);
		expect(estimates.filter(({ status }) => status === "complete")).toHaveLength(244);
		expect(estimates.filter(({ status }) => status === "partial")).toHaveLength(0);
		expect(estimates.filter(({ status }) => status === "unreachable")).toHaveLength(3);
		for (const factId of [
			"producer:cathedral",
			"producer:house-of-engineers",
			"producer:mage-lodge",
		])
			expect(estimates.find((estimate) => estimate.factId === factId)).toMatchObject({
				status: "complete",
			});
		expect(estimates.find(({ factId }) => factId === "producer:chicken-coop-t1")).toMatchObject(
			{
				obtainable: true,
				status: "complete",
			},
		);
		expect(estimates.find(({ factId }) => factId === "item:axe")).toMatchObject({
			status: "complete",
		});
		expect(performance.now() - started).toBeLessThan(10_000);
	}, 12_000);
});
