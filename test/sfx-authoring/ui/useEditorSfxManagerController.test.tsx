// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	assignSfxFn: vi.fn(),
	deleteResourceFn: vi.fn(),
	importSfxFn: vi.fn(),
	setCall: 0,
	valueCall: 0,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () =>
		[
			state.importSfxFn,
			state.deleteResourceFn,
			state.assignSfxFn,
		][state.setCall++ % 3],
	useAtomValue: () =>
		state.valueCall++ % 4 === 0
			? {
					master: 100,
					music: 10,
					sfx: 5,
				}
			: AsyncResult.initial(),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			sfx: {
				events: {
					"job:started": "old-start",
					"item:spawned": "shared-sfx",
				},
			},
		},
		projectId: "project-one",
		revision: 7,
		resources: [
			{
				id: "old-start",
				size: 47,
				type: "sfx",
				version: "1",
			},
			{
				id: "shared-sfx",
				size: 48,
				type: "sfx",
				version: "1",
			},
			{
				id: "unused-sfx",
				size: 49,
				type: "sfx",
				version: "1",
			},
		],
	}),
}));

vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrls: () => new Map(),
}));

import { useEditorSfxManagerController } from "~/sfx-authoring/ui/useEditorSfxManagerController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | undefined;
let controller: ReturnType<typeof useEditorSfxManagerController> | undefined;

const Probe = () => {
	controller = useEditorSfxManagerController();
	return null;
};

beforeEach(async () => {
	state.assignSfxFn.mockReset();
	state.deleteResourceFn.mockReset();
	state.importSfxFn.mockReset();
	state.setCall = 0;
	state.valueCall = 0;
	const container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root?.render(<Probe />));
});

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	controller = undefined;
	document.body.replaceChildren();
});

describe("useEditorSfxManagerController", () => {
	it("filters searched SFX by assignment usage", async () => {
		expect(controller?.sfx.map(({ id }) => id)).toEqual([
			"old-start",
			"shared-sfx",
			"unused-sfx",
		]);

		await act(async () => controller?.setViewFn("assigned"));
		expect(controller?.sfx.map(({ id }) => id)).toEqual([
			"old-start",
			"shared-sfx",
		]);

		await act(async () => controller?.setViewFn("unused"));
		expect(controller?.sfx.map(({ id }) => id)).toEqual([
			"unused-sfx",
		]);
	});

	it("replaces the resource assigned to one exact gameplay event", async () => {
		await act(async () => controller?.toggleAssignmentFn("job:started", "shared-sfx"));

		expect(state.assignSfxFn).toHaveBeenCalledWith({
			config: {
				sfx: {
					events: {
						"job:started": "shared-sfx",
						"item:spawned": "shared-sfx",
					},
				},
			},
			expectedRevision: 7,
			projectId: "project-one",
		});
	});

	it("removes an assignment when the selected SFX is chosen again", async () => {
		await act(async () => controller?.toggleAssignmentFn("item:spawned", "shared-sfx"));

		expect(state.assignSfxFn).toHaveBeenCalledWith({
			config: {
				sfx: {
					events: {
						"job:started": "old-start",
					},
				},
			},
			expectedRevision: 7,
			projectId: "project-one",
		});
	});
});
