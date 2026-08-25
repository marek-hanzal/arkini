import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEditorMcpEstimateTextFx } from "../../../../electron/main/editor-mcp/tool/readEditorMcpEstimateTextFx";
import { createEditorMcpGraphProject } from "./support/createEditorMcpToolProject";

const readEstimate = (
	sort: "demand" | "fastest" | "slowest",
	options: {
		readonly page?: number;
		readonly pageSize?: number;
		readonly query?: string;
	} = {},
) =>
	Effect.runSync(
		readEditorMcpEstimateTextFx(createEditorMcpGraphProject(), {
			page: options.page ?? 1,
			pageSize: options.pageSize ?? 25,
			query: options.query,
			sort,
		}),
	);

describe("readEditorMcpEstimateTextFx", () => {
	it("formats the selected global Estimate order as a bounded page", () => {
		const text = readEstimate("slowest", {
			pageSize: 2,
		});

		expect(text).toContain("Global estimate\nMethod: static authored dependency graph");
		expect(text).toContain("Sort: slowest");
		expect(text).toContain("Page: 1");
		expect(text).toContain("Page size: 2");
		expect(text).toContain("Returned items: 2");
		expect(text).toContain("Has next page: true");
	});

	it("applies the same fuzzy query as the Estimate UI", () => {
		const text = readEstimate("demand", {
			query: "unused",
		});

		expect(text).toContain("Query: unused");
		expect(text).toContain("Matched items: 1");
		expect(text).toContain("- Unused\n  ID: unused");
		expect(text).toContain("Status: unreachable\n  Estimate: No path");
	});
});
