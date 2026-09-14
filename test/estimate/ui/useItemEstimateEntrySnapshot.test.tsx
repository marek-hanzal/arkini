// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { useItemEstimateEntrySnapshot } from "~/estimate/ui/useItemEstimateEntrySnapshot";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("captures a newer config only on explicit refresh and keeps that snapshot across later writes", async () => {
	const initial = {
		projectId: "sample",
		title: "Sample",
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		resources: [],
		revision: 1,
		config: editorTestConfig,
	} satisfies Project;
	let captured: ReturnType<typeof useItemEstimateEntrySnapshot> | undefined;
	const Probe = ({ project, version }: { project: Project; version: number }) => {
		captured = useItemEstimateEntrySnapshot(project, version);
		return null;
	};
	const root = createRoot(document.createElement("div"));
	try {
		await act(async () =>
			root.render(
				<Probe
					project={initial}
					version={0}
				/>,
			),
		);
		const fresh = {
			...initial,
			revision: 2,
			config: {
				...editorTestConfig,
			},
		};
		await act(async () =>
			root.render(
				<Probe
					project={fresh}
					version={0}
				/>,
			),
		);
		expect(captured?.config).toBe(initial.config);
		await act(async () =>
			root.render(
				<Probe
					project={fresh}
					version={1}
				/>,
			),
		);
		expect(captured?.config).toBe(fresh.config);
		expect(captured?.revision).toBe(2);
		await act(async () =>
			root.render(
				<Probe
					project={{
						...fresh,
						revision: 3,
						config: {
							...editorTestConfig,
						},
					}}
					version={1}
				/>,
			),
		);
		expect(captured?.config).toBe(fresh.config);
	} finally {
		await act(async () => root.unmount());
	}
});
