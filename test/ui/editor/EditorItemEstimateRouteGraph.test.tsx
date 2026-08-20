import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/ui/item/editor/EditorItemDetailReference", () => ({
	EditorItemDetailReference: ({
		item,
		projectId,
		sectionId,
	}: {
		readonly item: {
			readonly id: string;
			readonly title: string;
		};
		readonly projectId: string;
		readonly sectionId: string;
	}) =>
		createElement(
			"a",
			{
				"data-item-id": item.id,
				"data-project-id": projectId,
				"data-section-id": sectionId,
			},
			item.title,
		),
}));

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { EditorItemEstimateRouteGraph } from "~/ui/item/editor/EditorItemEstimateRouteGraph";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("EditorItemEstimateRouteGraph", () => {
	it("renders clickable item rows with quantity, local time, and authored roots", () => {
		const config = createJobTestConfig();
		const markup = renderToStaticMarkup(
			createElement(EditorItemEstimateRouteGraph, {
				config,
				header: createElement("div", null, "Estimate summary"),
				projectId: "estimate-test",
				routeSteps: [
					{
						actionRuns: 3,
						durationMs: 3_000,
						factId: "tool",
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
						routeId: "make-tool",
						source: "route",
					},
					{
						actionRuns: 3,
						durationMs: 1_000,
						factId: "water",
						outputRuns: 3,
						quantity: 3,
						requirements: [],
						rootQuantity: 0,
						routeId: "make-water",
						source: "route",
					},
				],
			}),
		);

		expect(markup).toContain("tool");
		expect(markup).toContain("×5");
		expect(markup).toContain("3 s");
		expect(markup).toContain("2 from authored start");
		expect(markup).toContain("Required by: tool");
		expect(markup).toContain("Quantity:");
		expect(markup).toContain("Time:");
		expect(markup).toContain("Estimate summary");
		expect(markup).toMatch(/class="[^"]*ak-list-row[^"]*ak-list-row-interactive[^"]*"/);
		expect(markup).toContain('data-ui="EditorItemEstimateHeader"');
		expect(markup).toContain('data-item-id="tool"');
		expect(markup).toContain('data-project-id="estimate-test"');
		expect(markup).toContain('data-section-id="estimate"');
		expect(markup).not.toContain("material input");
		expect(markup).not.toContain("make-tool");
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
				config,
				header: createElement("div", null, "Estimate summary"),
				projectId: "official-estimate",
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

	it("renders a missing item without an interactive row affordance", () => {
		const markup = renderToStaticMarkup(
			createElement(EditorItemEstimateRouteGraph, {
				config: createJobTestConfig(),
				header: createElement("div", null, "Estimate summary"),
				projectId: "estimate-test",
				routeSteps: [
					{
						actionRuns: 1,
						durationMs: 1_000,
						factId: "missing-item",
						outputRuns: 1,
						quantity: 1,
						requirements: [],
						rootQuantity: 0,
						routeId: "make-missing",
						source: "route",
					},
				],
			}),
		);

		expect(markup).toContain("missing-item [missing]");
		expect(markup).not.toContain("ak-list-row-interactive");
		expect(markup).not.toMatch(/<a(?:\s|>)/);
	});
});
