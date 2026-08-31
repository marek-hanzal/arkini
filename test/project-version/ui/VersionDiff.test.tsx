import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ProjectVersionDiff } from "~/project-version/type/ProjectVersion";
import { VersionDiff } from "~/project-version/ui/VersionDiff";

describe("VersionDiff", () => {
	it("renders the canonical major and minor classifications on their exact changes", () => {
		const diff: ProjectVersionDiff = {
			from: {
				type: "version",
				versionId: "before",
			},
			to: {
				type: "current",
			},
			hasChanges: true,
			project: [
				{
					before: 9,
					after: 8,
					bump: "major",
					path: "config.meta.board.height",
				},
			],
			items: [
				{
					change: "changed",
					uid: "academy",
					values: [
						{
							before: "Academy 2",
							after: "Academy",
							bump: "minor",
							path: "title",
						},
					],
				},
			],
			resources: [],
			scenarios: [],
		};

		const markup = renderToStaticMarkup(<VersionDiff diff={diff} />);

		expect(markup.match(/data-ui-bump="major"/g)).toHaveLength(1);
		expect(markup.match(/data-ui-bump="minor"/g)).toHaveLength(1);
	});
});
