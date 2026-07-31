import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";

const registries: AtomRegistry.AtomRegistry[] = [];
const createRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

const createProject = (revision: string): EditorProject => ({
	projectId: "project",
	title: "Project",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	fileIndex: {},
	itemSourcePaths: {},
	resources: [],
	resourceSourcePaths: {},
	diagnostics: [],
});

describe("EditorProjectAtom", () => {
	it("accepts a fresh loader snapshot after remounting a retained project atom", () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = createRegistry();
		const atom = EditorProjectAtom("project");
		registry.mount(atom);
		registry.set(atom, {
			action: "refresh",
			expectedRevision: revisionA,
			project: createProject(revisionA),
		});

		registry.set(atom, {
			action: "refresh",
			expectedRevision: revisionA,
			project: createProject(revisionB),
		});

		expect(registry.get(atom)?.revision).toBe(revisionB);
	});

	it("rejects a stale loader snapshot after a local CAS publication", () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = createRegistry();
		const atom = EditorProjectAtom("project");
		registry.mount(atom);
		registry.set(atom, {
			action: "refresh",
			expectedRevision: revisionA,
			project: createProject(revisionA),
		});
		registry.set(atom, {
			action: "publish",
			expectedRevision: revisionA,
			project: createProject(revisionB),
		});
		registry.set(atom, {
			action: "refresh",
			expectedRevision: revisionA,
			project: createProject(revisionA),
		});

		expect(registry.get(atom)?.revision).toBe(revisionB);
	});

	it("accepts a loader snapshot matching the already published revision", () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = createRegistry();
		const atom = EditorProjectAtom("project");
		registry.mount(atom);
		registry.set(atom, {
			action: "refresh",
			expectedRevision: revisionA,
			project: createProject(revisionA),
		});
		registry.set(atom, {
			action: "publish",
			expectedRevision: revisionA,
			project: createProject(revisionB),
		});
		const acknowledged = {
			...createProject(revisionB),
			title: "Reloaded",
		};
		registry.set(atom, {
			action: "refresh",
			expectedRevision: revisionA,
			project: acknowledged,
		});

		expect(registry.get(atom)).toBe(acknowledged);
	});
});
