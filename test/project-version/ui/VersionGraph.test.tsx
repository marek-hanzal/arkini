// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VersionGraph } from "~/project-version/ui/VersionGraph";

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

describe("VersionGraph", () => {
	it("selects the working copy from its graph node", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onSelectWorkingCopy = vi.fn();
		const Harness = () => {
			const [selectedReference, setSelectedReference] = useState("version-one");
			return (
				<VersionGraph
					layout={{
						laneCount: 1,
						rows: [],
						workingCopyLane: 0,
					}}
					onSelect={vi.fn()}
					onSelectWorkingCopy={() => {
						setSelectedReference("current");
						onSelectWorkingCopy();
					}}
					selectedReference={selectedReference}
					status={{
						canCommit: true,
						currentBaseVersionId: "version-one",
						currentFingerprint: "a".repeat(64),
						dirty: true,
						versionCount: 1,
					}}
				/>
			);
		};

		await act(async () => root.render(<Harness />));
		const workingCopy = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorVersionWorkingCopy"]',
		);
		expect(workingCopy).not.toBeNull();
		expect(workingCopy?.dataset.uiSelected).toBe("false");

		await act(async () => workingCopy?.click());

		expect(onSelectWorkingCopy).toHaveBeenCalledOnce();
		expect(workingCopy?.dataset.uiSelected).toBe("true");
	});
});
