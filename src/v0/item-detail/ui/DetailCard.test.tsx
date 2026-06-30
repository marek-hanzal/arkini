import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailCard } from "~/v0/item-detail/ui/DetailCard";

describe("DetailCard", () => {
	it("uses the eyebrow as the only visible header title when both labels exist", () => {
		const html = renderToStaticMarkup(
			<DetailCard
				eyebrow="Lines"
				title="Product lines"
			>
				<div>Body</div>
			</DetailCard>,
		);

		expect(html).toContain("Lines");
		expect(html).not.toContain("Product lines");
	});

	it("keeps plain titles for cards without an eyebrow", () => {
		const html = renderToStaticMarkup(
			<DetailCard title="Shared inputs">
				<div>Body</div>
			</DetailCard>,
		);

		expect(html).toContain("Shared inputs");
	});
});
