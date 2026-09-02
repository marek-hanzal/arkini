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
					onRestoreFn={vi.fn()}
					onSelectFn={vi.fn()}
					onSelectWorkingCopyFn={() => {
						setSelectedReference("current");
						onSelectWorkingCopy();
					}}
					restorePending={false}
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

	it("restores the exact version from its graph row action", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onRestoreFn = vi.fn();
		const onSelectFn = vi.fn();

		await act(async () =>
			root.render(
				<VersionGraph
					layout={{
						laneCount: 1,
						rows: [
							{
								activeLanes: [
									0,
								],
								lane: 0,
								version: {
									arkini: "0.5.0",
									arkpackVersion: "1.0",
									createdAtMs: 1,
									projectId: "project-one",
									sourceRevision: 1,
									subject: "First version",
									versionId: "version-one",
								},
							},
						],
						workingCopyLane: 0,
					}}
					onRestoreFn={onRestoreFn}
					onSelectFn={onSelectFn}
					onSelectWorkingCopyFn={vi.fn()}
					restorePending={false}
					selectedReference="version-one"
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
		const restore = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorVersionRestore"]',
		);

		await act(async () => restore?.click());

		expect(onRestoreFn).toHaveBeenCalledExactlyOnceWith("version-one");
		expect(onSelectFn).not.toHaveBeenCalled();
	});
});
