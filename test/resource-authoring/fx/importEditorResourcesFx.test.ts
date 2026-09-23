// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import { Effect, Fiber } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { createProjectWriteAdmissionFx } from "~/project-authoring/fx/createProjectWriteAdmissionFx";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { importEditorResourcesFx } from "~/resource-authoring/fx/importEditorResourcesFx";
import {
	editorTestPayload,
	editorTestResources,
} from "~test/project-authoring/support/editorTestPayload";

const project = {
	projectId: "project",
	title: "Editor test",
	version: {
		major: 1,
		minor: 0,
	},
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 2,
	config: editorTestPayload.config,
	resources: editorTestResources,
};
const response = {
	type: "success",
	value: {
		project,
		resourceUids: [
			"item-water",
		],
	},
} as const;
const props = {
	projectId: "project",
	source: "files",
	type: "artwork",
	files: [],
} as const;

afterEach(() => vi.unstubAllGlobals());

describe("native resource import settlement", () => {
	it("rejects import before native dispatch during project replacement", async () => {
		const admission = Effect.runSync(createProjectWriteAdmissionFx);
		const release = Effect.runSync(
			admission.acquireReplacementFx("refresh-project", () => false),
		);
		const importResourcesFn = vi.fn(async () => response);
		vi.stubGlobal("serakki", {
			editor: {
				importResourcesFn,
			},
		});
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		try {
			await expect(
				Effect.runPromise(
					importEditorResourcesFx(props).pipe(
						Effect.provideService(ProjectWriteAdmission, admission),
						Effect.provideService(AtomRegistry.AtomRegistry, registry),
					),
				),
			).rejects.toMatchObject({
				operation: "upsert-resource",
			});
			expect(importResourcesFn).not.toHaveBeenCalled();
			expect(registry.get(EditorProjectAtom("project"))).toBeUndefined();
		} finally {
			Effect.runSync(release);
			registry.dispose();
		}
	});

	it("publishes a dispatched native commit even when its caller is interrupted", async () => {
		const admission = Effect.runSync(createProjectWriteAdmissionFx);
		let finishNative!: (value: typeof response) => void;
		const native = new Promise<typeof response>((resolve) => {
			finishNative = resolve;
		});
		let markStarted!: () => void;
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		vi.stubGlobal("serakki", {
			editor: {
				importResourcesFn: () => {
					markStarted();
					return native;
				},
			},
		});
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		const fiber = Effect.runFork(
			importEditorResourcesFx(props).pipe(
				Effect.provideService(ProjectWriteAdmission, admission),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		try {
			await started;
			const interruption = Effect.runPromise(Fiber.interrupt(fiber));
			finishNative(response);
			await interruption;
			expect(registry.get(EditorProjectAtom("project"))).toEqual(project);
		} finally {
			finishNative(response);
			await Effect.runPromise(Fiber.interrupt(fiber));
			registry.dispose();
		}
	});
});
