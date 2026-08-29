import { describe, expect, it } from "vitest";

import { createArkpackDistributionChannelFn } from "~/engine/pack/fn/createArkpackDistributionChannelFn";

const workflow = "https://github.com/marek-hanzal/arkini/.github/workflows/release.yml";

describe("Arkpack distribution channel", () => {
	it("keeps release version outside the exact workflow identity", () => {
		const channel = createArkpackDistributionChannelFn({
			issuer: "https://token.actions.githubusercontent.com",
			workflow,
		});

		expect(channel.subjectAlternativeName.test(`${workflow}@refs/tags/v0.4.9`)).toBe(true);
		expect(channel.subjectAlternativeName.test(`${workflow}@refs/tags/v0.6.0-dev.1`)).toBe(
			true,
		);
		expect(
			channel.subjectAlternativeName.test(
				"https://github.com/pepa/arkini/.github/workflows/release.yml@refs/tags/v0.5.0",
			),
		).toBe(false);
		expect(channel.subjectAlternativeName.test(workflow)).toBe(false);
	});
});
