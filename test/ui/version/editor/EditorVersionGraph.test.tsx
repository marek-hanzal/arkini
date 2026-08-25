// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorVersionGraph } from "~/ui/version/editor/EditorVersionGraph";

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

describe("EditorVersionGraph", () => {
	it("selects the working copy from its graph node", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onSelectWorkingCopy = vi.fn();

		await act(async () =>
			root.render(
				<EditorVersionGraph
					layout={{
						laneCount: 1,
						rows: [],
						workingCopyLane: 0,
					}}
					onSelect={vi.fn()}
					onSelectWorkingCopy={onSelectWorkingCopy}
					status={{
						canCommit: true,
						currentBaseVersionId: "version-one",
						currentFingerprint: "a".repeat(64),
						dirty: true,
						versionCount: 1,
					}}
				/>,
			),
		);
		const workingCopy = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorVersionWorkingCopy"]',
		);
		expect(workingCopy).not.toBeNull();

		await act(async () => workingCopy?.click());

		expect(onSelectWorkingCopy).toHaveBeenCalledOnce();
	});
});
