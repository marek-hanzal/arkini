import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as estimateModule from "~/estimate/fn/estimateRequestsFn";
import * as graphModule from "~/flow/fn/createAcquisitionGraphFn";
import { readItemEstimateTextFx } from "~/authoring-mcp/tool/readItemEstimateTextFx";
import { readItemRelationTextFx } from "~/authoring-mcp/tool/readItemRelationTextFx";
import { itemEstimateMaximumQuantity } from "~/estimate/schema/ItemEstimateQuantitySchema";
import { createGraphProject } from "./support/createToolProject";
import {
	createSummaryProject,
	createSelfMergeSummaryProject,
	createRequirementSummaryProject,
	createConditionalSummaryProject,
} from "./readGraphTextFx.test/summaryFixture";

afterEach(() => vi.restoreAllMocks());

describe("compact MCP graph responses", () => {
	it("preserves authored Clock weights for both full-interface and automatic-only owners", () => {
		const base = createGraphProject();
		for (const ui of [
			"default",
			"simple",
		] as const) {
			const project = {
				...base,
				config: {
					...base.config,
					items: {
						...base.config.items,
						forge: {
							...base.config.items.forge,
							ui,
							lines: base.config.items.forge.lines.map((line) => ({
								...line,
								clock: true,
								clockWeight: 7,
							})),
						},
					},
				},
			};
			const summary = Effect.runSync(
				readItemRelationTextFx(project, {
					itemId: "ingot",
					level: 1,
					role: "output",
					detail: "summary",
				}),
			);
			expect(summary).toContain("Clock weight: 7");
		}
	});

	it.each([
		"input",
		"output",
	] as const)(
		"retains every %s operation, level, output and authored gate without repeated witnesses",
		(role) => {
			const project = createSummaryProject();
			const graphSpy = vi.spyOn(graphModule, "createAcquisitionGraphFn");
			const request = {
				itemId: role === "input" ? "water" : "ingot",
				level: 3,
				role,
			};
			const omitted = Effect.runSync(readItemRelationTextFx(project, request));
			const full = Effect.runSync(
				readItemRelationTextFx(project, {
					...request,
					detail: "full",
				}),
			);
			const summary = Effect.runSync(
				readItemRelationTextFx(project, {
					...request,
					detail: "summary",
				}),
			);
			expect(full).toBe(omitted);
			expect(full).toContain("requires all:");
			expect(summary).not.toContain("requires all:");
			const operations = (text: string) =>
				[
					...text.matchAll(/^- Level \d+: (?:line|merge|units|expiry) "[^"]*"/gm),
				].map(([row]) => row);
			expect(operations(summary)).toEqual(operations(full));
			expect(summary).toContain(`Operations: ${operations(full).length}`);
			for (const kind of [
				"line",
				"merge",
				"units",
			])
				expect(summary).toContain(`: ${kind} "`);
			expect(summary).toContain("- Level 2:");
			expect(summary).toContain("- Level 3:");
			for (const text of [
				"Ingot [ingot] x1–3",
				"Dust [dust] x2",
				"Plate [plate] x1",
				"chance 25%",
				"weight 3",
				"weight 1",
				"@board/close",
				"disable(",
				"enable(",
				"water [water] @any x3 consume",
				"tool [tool] @any x1 reserve",
				"units 1 from target",
				"rule 1",
				"line:forge:run",
			])
				expect(summary).toContain(text);
			expect(summary).toContain("2 actions per depletion");
			expect(summary.length).toBeLessThan(full.length * 0.75);
			expect(graphSpy).toHaveBeenCalledTimes(3);
			expect(graphSpy.mock.results[2]?.value).toEqual(graphSpy.mock.results[0]?.value);
		},
	);

	it("keeps every estimate requirement and selected result while omitting the DAG", () => {
		const project = createRequirementSummaryProject();
		const spy = vi.spyOn(estimateModule, "estimateRequestsFn");
		const omitted = Effect.runSync(readItemEstimateTextFx(project, "ingot", 1));
		const full = Effect.runSync(readItemEstimateTextFx(project, "ingot", 1, "full"));
		const summary = Effect.runSync(readItemEstimateTextFx(project, "ingot", 1, "summary"));
		expect(full).toBe(omitted);
		expect(full).toContain("Selected fact DAG:");
		expect(summary).not.toContain("Selected fact DAG:");
		for (const line of full
			.split("\n")
			.filter((line) => /^(Status:|Approximate |Selected route:)/.test(line)))
			expect(summary).toContain(line);
		for (const heading of [
			"Consumed",
			"One-time",
			"Ongoing",
		]) {
			const group = full.match(new RegExp(`${heading} requirements:\\n(?:  - .*\\n)+`))?.[0];
			expect(group).toBeDefined();
			expect(summary).toContain(group!.trimEnd());
		}
		expect(summary.length).toBeLessThan(full.length);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy.mock.results[2]?.value).toEqual(spy.mock.results[0]?.value);
	});

	it("counts reported diagnostics separately from unique routes and exposes cycle evidence", () => {
		const project = createGraphProject();
		const original = estimateModule.estimateRequestsFn({
			graph: graphModule.createAcquisitionGraphFn(project.config),
			requests: [
				{
					factId: "ingot",
					quantity: 1,
				},
			],
		})[0]!;
		vi.spyOn(estimateModule, "estimateRequestsFn").mockReturnValue([
			{
				...original,
				diagnostics: [
					{
						kind: "cycle",
						routeId: "rejected-a",
						factIds: [
							"ingot",
							"ingot",
						],
					},
					{
						kind: "unreachable",
						routeId: "rejected-a",
						factId: "unused",
						quantity: 1,
					},
					{
						kind: "unreachable",
						routeId: "rejected-b",
						factId: "unused",
						quantity: 1,
					},
				],
			},
		]);
		const summary = Effect.runSync(readItemEstimateTextFx(project, "ingot", 1, "summary"));
		expect(summary).toContain("diagnostics (reported): 3; distinct diagnosed routes: 2");
		expect(summary).toContain("cycle x1, unreachable x2");
		expect(summary).toContain("Cycles: encountered");
		expect(summary).toContain("total rejected alternatives and unreported cycles are unknown");
		expect(summary).not.toContain("rejected-a");
	});

	it("summarizes incomplete alternatives without printing every rejected route", () => {
		vi.spyOn(estimateModule, "estimateRequestsFn").mockReturnValue([
			{
				factId: "ingot",
				quantity: 1,
				obtainable: false,
				status: "partial",
				limitations: [],
				diagnostics: [
					{
						kind: "witness-search-exhausted",
						maximumStates: 128,
						routeId: "bounded-search",
					},
					{
						kind: "cycle",
						routeId: "hidden-cycle",
						factIds: [
							"ingot",
							"ingot",
						],
					},
					{
						kind: "unreachable",
						routeId: "hidden-dead-end",
						factId: "unused",
						quantity: 1,
					},
				],
			},
		]);
		const summary = Effect.runSync(
			readItemEstimateTextFx(createGraphProject(), "ingot", 1, "summary"),
		);
		expect(summary).toContain("Status: partial");
		expect(summary).toContain("128 states");
		expect(summary).toContain("diagnostics (reported): 3");
		expect(summary).toContain("cycle x1");
		expect(summary).not.toContain("hidden-cycle");
		expect(summary).not.toContain("hidden-dead-end");
	});

	it("preserves replacement and Clock expiry outputs alongside conditional output sets", () => {
		const project = createConditionalSummaryProject();
		const summary = Effect.runSync(
			readItemRelationTextFx(project, {
				itemId: "ingot",
				level: 3,
				role: "output",
				detail: "summary",
			}),
		);
		expect(summary).toContain("Replacement output: Ingot [ingot] x1");
		expect(summary).toContain(': expiry "Expiry"');
		expect(summary).toContain("Runtime: 5 s");
		expect(summary).toContain("Clock gates: enabled=false");
		expect(summary).toContain("Output set 1: weight 3 rules:");
		expect(summary).toContain("chance 25%");
	});

	it("keeps independent depletion rolls explicit for both same-type merge participants", () => {
		const summary = Effect.runSync(
			readItemRelationTextFx(createSelfMergeSummaryProject(), {
				itemId: "ingot",
				level: 1,
				role: "output",
				detail: "summary",
			}),
		);
		expect(summary).toContain("Depletion participants: source and target (distinct instances)");
		expect(summary).toContain(
			"Outputs per depleted instance; each participant rolls separately",
		);
		expect(summary).toContain("Ingot [ingot] x1–2");
	});

	it("keeps partial and unreachable estimates explicit without inventing totals", () => {
		const project = createGraphProject();
		const partial = Effect.runSync(
			readItemEstimateTextFx(project, "ingot", itemEstimateMaximumQuantity + 1, "summary"),
		);
		const unreachable = Effect.runSync(readItemEstimateTextFx(project, "unused", 1, "summary"));
		expect(partial).toContain("Status: partial");
		expect(partial).toContain("quantity-limit-exceeded x1");
		expect(partial).toContain(`static estimate limit of ${itemEstimateMaximumQuantity}`);
		expect(unreachable).toContain("Status: unreachable");
		expect(unreachable).toContain("has no complete route");
		for (const text of [
			partial,
			unreachable,
		])
			expect(text).not.toContain("Approximate optimistic parallel duration:");
	});
});
