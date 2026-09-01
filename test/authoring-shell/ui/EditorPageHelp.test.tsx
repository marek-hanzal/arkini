// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("EditorPageHelp", () => {
	it("opens page-owned guidance and closes it without navigating", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<EditorPageHelp
					content={<p>Guidance</p>}
					title="Page guidance"
				/>,
			);
		});

		expect(document.querySelector('[data-ui="EditorPageHelpDialog"]')).toBeNull();
		await act(async () =>
			container.querySelector<HTMLButtonElement>('[data-ui="EditorPageHelpOpen"]')?.click(),
		);
		expect(document.querySelector('[data-ui="EditorPageHelpDialog"]')).not.toBeNull();

		await act(async () =>
			document.querySelector<HTMLButtonElement>('[data-ui="EditorPageHelpClose"]')?.click(),
		);
		expect(document.querySelector('[data-ui="EditorPageHelpDialog"]')).toBeNull();
	});
});
