import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailCard } from "~/item-detail/ui/DetailCard";

describe("DetailCard", () => {
	it("uses the eyebrow as the only visible header title when both labels exist", () => {
		const html = renderToStaticMarkup(
			<DetailCard
				eyebrow="Lines"
				title="Hidden title"
			>
				<div>Body</div>
			</DetailCard>,
		);

		expect(html).toContain("Lines");
		expect(html).not.toContain("Hidden title");
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
