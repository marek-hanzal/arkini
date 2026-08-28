import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEstimateTextFx } from "../../../../electron/main/editor-mcp/tool/readEstimateTextFx";
import { createGraphProject } from "./support/createToolProject";

const readEstimate = (
	sort: "demand" | "fastest" | "slowest",
	options: {
		readonly incomplete?: boolean;
		readonly page?: number;
		readonly pageSize?: number;
		readonly query?: string;
	} = {},
) =>
	Effect.runSync(
		readEstimateTextFx(createGraphProject(), {
			incomplete: options.incomplete ?? false,
			page: options.page ?? 1,
			pageSize: options.pageSize ?? 25,
			query: options.query,
			sort,
		}),
	);

describe("readEstimateTextFx", () => {
	it("formats the selected global Estimate order as a bounded page", () => {
		const text = readEstimate("slowest", {
			pageSize: 2,
		});

		expect(text).toContain("Global estimate\nMethod: static authored dependency graph");
		expect(text).toContain("Incomplete only: false");
		expect(text).toContain("Sort: slowest");
		expect(text).toContain("Page: 1");
		expect(text).toContain("Page size: 2");
		expect(text).toContain("Returned items: 2");
		expect(text).toContain("Has next page: true");
	});

	it("applies the same incomplete filter and fuzzy query as the Estimate UI", () => {
		const incomplete = readEstimate("demand", {
			incomplete: true,
		});
		const text = readEstimate("demand", {
			incomplete: true,
			query: "unused",
		});

		expect(incomplete).toContain("Incomplete only: true");
		expect(incomplete).toContain("Status: unreachable");
		expect(incomplete).not.toContain("Status: complete");
		expect(text).toContain("Incomplete only: true");
		expect(text).toContain("Query: unused");
		expect(text).toContain("Matched items: 1");
		expect(text).toContain("- Unused\n  ID: unused");
		expect(text).toContain("Status: unreachable\n  Estimate: No path");
	});
});
