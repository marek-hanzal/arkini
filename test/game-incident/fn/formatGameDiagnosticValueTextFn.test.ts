import { describe, expect, it } from "vitest";

import { formatGameDiagnosticValueTextFn } from "~/game-incident/fn/formatGameDiagnosticValueTextFn";

describe("formatGameDiagnosticValueTextFn", () => {
	it("removes physical Unix, file URL, and Windows paths from rendered diagnostics", () => {
		const text = formatGameDiagnosticValueTextFn({
			nested: {
				"/Users/private-name/Project/arkini/secret.txt": "failed",
			},
			unix: "/Users/private-name/Project/arkini/src/game.ts:12:4",
			url: "file:///Users/private-name/Project/arkini/src/game.ts:12:4",
			windows: "C:\\Users\\private-name\\Project\\arkini\\src\\game.ts:12:4",
		});

		expect(text).not.toContain("private-name");
		expect(text).not.toContain("/Users/");
		expect(text).not.toContain("C:\\Users\\");
		expect(text.match(/<redacted-path>/g)).toHaveLength(4);
	});
});
