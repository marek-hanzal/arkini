import { describe, expect, it } from "vitest";

import { readEstimateTextFn } from "~/authoring-mcp/tool/fn/readEstimateTextFn";
import { createGraphProject } from "./support/createToolProject";

const readEstimate = (
	view: "demand" | "fastest" | "incomplete" | "slowest",
	options: {
		readonly page?: number;
		readonly limit?: number;
		readonly query?: string;
	} = {},
) =>
	readEstimateTextFn(createGraphProject(), {
		page: options.page ?? 1,
		limit: options.limit ?? 25,
		query: options.query,
		view,
	});

describe("readEstimateTextFn", () => {
	it("formats the selected global Estimate order as a bounded page", () => {
		const text = readEstimate("slowest", {
			limit: 2,
		});

		expect(text).toContain("View: slowest");
		expect(text).toContain("Page: 1");
		expect(text).toContain("Limit: 2");
		expect(text).toContain("Returned items: 2");
		expect(text).toContain("Has next page: true");
	});

	it("applies the same incomplete filter and fuzzy query as the Estimate UI", () => {
		const incomplete = readEstimate("incomplete");
		const text = readEstimate("incomplete", {
			query: "unused",
		});

		expect(incomplete).toContain("View: incomplete");
		expect(incomplete).toContain("Status: unreachable");
		expect(incomplete).not.toContain("Status: complete");
		expect(text).toContain("View: incomplete");
		expect(text).toContain("Query: unused");
		expect(text).toContain("Matched items: 1");
		expect(text).toContain("- Unused\n  ID: unused");
		expect(text).toContain("Status: unreachable\n  Estimate: No path");
	});
});
