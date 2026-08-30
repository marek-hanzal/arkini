import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it } from "vitest";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

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

const createProject = (revision: number): EditorProject => ({
	projectId: "project",
	title: "Project",
	version: "1.0",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

describe("EditorProjectAtom", () => {
	it("accepts a newer committed repository snapshot", () => {
		const revisionA = 1;
		const revisionB = 2;
		const registry = createRegistry();
		const atom = EditorProjectAtom("project");
		registry.mount(atom);
		registry.set(atom, {
			project: createProject(revisionA),
		});

		registry.set(atom, {
			project: createProject(revisionB),
		});

		expect(registry.get(atom)?.revision).toBe(revisionB);
	});

	it("rejects an older repository snapshot", () => {
		const revisionA = 1;
		const revisionB = 2;
		const registry = createRegistry();
		const atom = EditorProjectAtom("project");
		registry.mount(atom);
		registry.set(atom, {
			project: createProject(revisionA),
		});
		registry.set(atom, {
			project: createProject(revisionB),
		});
		registry.set(atom, {
			project: createProject(revisionA),
		});

		expect(registry.get(atom)?.revision).toBe(revisionB);
	});

	it("accepts replacement data for the current repository revision", () => {
		const revisionA = 1;
		const revisionB = 2;
		const registry = createRegistry();
		const atom = EditorProjectAtom("project");
		registry.mount(atom);
		registry.set(atom, {
			project: createProject(revisionA),
		});
		registry.set(atom, {
			project: createProject(revisionB),
		});
		const acknowledged = {
			...createProject(revisionB),
			title: "Reloaded",
		};
		registry.set(atom, {
			project: acknowledged,
		});

		expect(registry.get(atom)).toBe(acknowledged);
	});

	it("queues an item commit until a delayed resource snapshot closes its revision gap", () => {
		const registry = createRegistry();
		const atom = EditorProjectAtom("project");
		registry.mount(atom);
		const changedResources = editorTestPayload.resources.map((resource, index) =>
			index === 0
				? {
						...resource,
						bytes: new Uint8Array([
							9,
						]),
					}
				: resource,
		);
		const { resources: _resources, ...commit } = createProject(900);

		registry.set(atom, {
			project: createProject(100),
		});
		registry.set(atom, {
			commit: {
				...commit,
				previousRevision: 250,
				config: {
					...commit.config,
					items: {
						...commit.config.items,
						water: {
							...commit.config.items.water,
							title: "Committed after asset",
						},
					},
				},
			},
		});
		expect(registry.get(atom)?.revision).toBe(100);

		registry.set(atom, {
			project: {
				...createProject(250),
				resources: changedResources,
			},
		});

		const projected = registry.get(atom);
		expect(projected?.revision).toBe(900);
		expect(projected?.config.items.water?.title).toBe("Committed after asset");
		expect(projected?.resources).toBe(changedResources);
	});

	it("holds an item commit until an unmounted projection receives its loader snapshot", () => {
		const registry = createRegistry();
		const atom = EditorProjectAtom("project");
		registry.mount(atom);
		const { resources: _resources, ...commit } = createProject(500);

		registry.set(atom, {
			commit: {
				...commit,
				previousRevision: 100,
			},
		});
		expect(registry.get(atom)).toBeUndefined();

		registry.set(atom, {
			project: createProject(100),
		});
		expect(registry.get(atom)?.revision).toBe(500);
	});

	it("keeps queued commits isolated to their Atom registry", () => {
		const first = createRegistry();
		const second = createRegistry();
		const atom = EditorProjectAtom("project");
		first.mount(atom);
		second.mount(atom);
		const { resources: _resources, ...commit } = createProject(500);

		first.set(atom, {
			commit: {
				...commit,
				previousRevision: 100,
			},
		});
		second.set(atom, {
			project: createProject(100),
		});

		expect(first.get(atom)).toBeUndefined();
		expect(second.get(atom)?.revision).toBe(100);
	});
});
