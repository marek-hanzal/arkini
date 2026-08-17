import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { EditorItemEstimateRouteGraph } from "~/ui/item/editor/EditorItemEstimateRouteGraph";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("EditorItemEstimateRouteGraph", () => {
	it("explains authored roots and requirement provenance", () => {
		const markup = renderToStaticMarkup(
			createElement(EditorItemEstimateRouteGraph, {
				routeSteps: [
					{
						actionRuns: 3,
						durationMs: 3_000,
						factId: "target",
						outputRuns: 3,
						quantity: 5,
						requirements: [
							{
								factId: "water",
								quantity: 3,
								sources: [
									"material-input",
									"line-condition",
								],
								usage: "consume",
							},
						],
						rootQuantity: 2,
						routeId: "make-target",
						source: "route",
					},
				],
			}),
		);

		expect(markup).toContain("Includes 2 from authored start facts.");
		expect(markup).toContain("material input, line condition");
	});

	it("renders an official multi-step graph once per selected fact", async () => {
		const config = await readArkiniGameConfigSource();
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const estimate = Effect.runSync(
			estimateEditorItemFx({
				factId: "item:pollution",
				graph,
			}),
		);
		if (!estimate.obtainable) throw new Error("Official high-fan-in fixture is unreachable.");

		const markup = renderToStaticMarkup(
			createElement(EditorItemEstimateRouteGraph, {
				routeSteps: estimate.routeSteps,
			}),
		);

		expect(estimate.routeSteps.length).toBeGreaterThan(20);
		expect(new Set(estimate.routeSteps.map(({ factId }) => factId)).size).toBe(
			estimate.routeSteps.length,
		);
		expect(JSON.stringify(estimate).length).toBeLessThan(100_000);
		expect(markup.match(/data-ui="EditorItemEstimateRouteStep"/g)).toHaveLength(
			estimate.routeSteps.length,
		);
		expect(markup.length).toBeLessThan(100_000);
	});
});
