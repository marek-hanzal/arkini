// @vitest-environment jsdom

import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createArtifact = (contentHash: string, revision: number) => ({
	projectId: "editor-test",
	contentHash,
	diagnostics: [],
	revision,
	size: 2,
});

const state = vi.hoisted(() => ({
	buildResult: undefined as unknown,
	catalogState: undefined as unknown,
	commandSetters: new Map<string, ReturnType<typeof vi.fn>>(),
	exportResults: new Map<string, unknown>(),
	installResults: new Map<string, unknown>(),
	project: undefined as unknown,
}));

vi.mock("effect/unstable/reactivity/Atom", async (importOriginal) => {
	const original = await importOriginal<typeof import("effect/unstable/reactivity/Atom")>();
	const familyKinds = [
		"build",
		"install",
		"save",
		"export",
	] as const;
	let familyIndex = 0;
	const atom = (kind: (typeof familyKinds)[number] | "open-export", key: string) => {
		const value = {
			kind,
			key,
			pipe: () => value,
		};
		return value;
	};
	return {
		...original,
		family: () => {
			const kind = familyKinds[familyIndex++];
			if (kind === undefined) throw new Error("Unexpected Editor Build atom family.");
			return (key: string) => atom(kind, key);
		},
		fn: () => atom("open-export", "completed-export"),
		setIdleTTL: () => undefined,
	};
});

vi.mock("~/editor-build/domain/EditorBuildRepository", async () => {
	const { Effect } = await import("effect");
	return {
		EditorBuildRepository: Effect.succeed({}),
	};
});

vi.mock("@effect/atom-react", () => ({
	useAtomSet: (atom: {
		readonly kind: "build" | "catalog" | "export" | "install" | "open-export" | "save";
		readonly key: string;
	}) => {
		const key = `${atom.kind}:${atom.key}`;
		const current = state.commandSetters.get(key);
		if (current !== undefined) return current;
		const setter = vi.fn();
		state.commandSetters.set(key, setter);
		return setter;
	},
	useAtomValue: (atom: {
		readonly kind: "build" | "catalog" | "export" | "install" | "open-export" | "save";
		readonly key: string;
	}) =>
		atom.kind === "build"
			? state.buildResult
			: atom.kind === "catalog"
				? state.catalogState
				: atom.kind === "install"
					? (state.installResults.get(atom.key) ?? AsyncResult.initial())
					: atom.kind === "export"
						? (state.exportResults.get(atom.key) ?? AsyncResult.initial())
						: AsyncResult.initial(),
}));

vi.mock("~/arkpack/ui/ArkpackCatalogAtom", () => ({
	ArkpackCatalogAtom: {
		kind: "catalog",
		key: "canonical",
	},
}));

vi.mock("~/authoring-session/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/application-runtime/RendererRuntime", () => ({
	RendererRuntime: {
		runSync: Effect.runSync,
	},
}));

vi.mock("~/authoring-shell/navigation/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => createElement("span"),
}));

vi.mock("~/ui/button/Button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	PrimaryButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	DangerButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	ButtonLink: ({
		children,
		to,
		params,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		readonly to: string;
		readonly params: Record<string, string>;
	}) =>
		createElement(
			"a",
			{
				...props,
				href: Object.entries(params).reduce(
					(path, [key, value]) => path.replace(`$${key}`, value),
					to,
				),
			},
			children,
		),
}));

import { Route as EditorBuildRouteDefinition } from "~/@routes/editor/$projectId/build";
import { useEditorBuildController } from "~/editor-build/ui/useEditorBuildController";
import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";

const EditorBuild = EditorBuildRouteDefinition.options.component;
if (EditorBuild === undefined) throw new Error("Editor Build route component is missing.");

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
let controller: useEditorBuildController.Output | undefined;
beforeEach(() => {
	controller = undefined;
	state.project = {
		projectId: "editor-test",
		title: "Editor test",
		config: {
			items: {},
		},
		resources: [],
		revision: 0,
		version: "1.0",
	};
	state.buildResult = AsyncResult.initial();
	state.catalogState = {
		type: "ready",
		arkpacks: [],
	};
	state.commandSetters.clear();
	state.exportResults.clear();
	state.installResults.clear();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderBuild = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = async () => {
		await act(async () => {
			root.render(createElement(EditorBuild));
		});
	};
	await render();
	return {
		container,
		render,
	};
};

const renderController = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const Probe = () => {
		controller = useEditorBuildController();
		return null;
	};
	const render = async () => {
		await act(async () => root.render(createElement(Probe)));
	};
	await render();
	return render;
};

describe("EditorBuild", () => {
	it("keeps structured validation diagnostics distinct from operational failures", async () => {
		const diagnostics = [
			{
				code: "resource:missing" as const,
				severity: "error" as const,
				message: "Referenced resource item-water has no matching PNG file.",
				path: [
					"items",
					"water",
					"asset",
					"default",
					0,
				],
				source: "items/simple/water.json",
				resourceId: "item-water",
			},
		];
		state.buildResult = AsyncResult.fail(
			new EditorProjectRepositoryError({
				operation: "build-project",
				message: "Editor project validation failed.",
				diagnostics,
			}),
		);

		await renderController();

		expect(controller?.buildFailure).toEqual({
			type: "validation",
			diagnostics,
		});
	});

	it("does not expose an unknown Build failure cause", async () => {
		state.buildResult = AsyncResult.fail(new Error("private filesystem detail"));
		await renderController();
		expect(controller?.buildFailure).toEqual({
			type: "operational",
			detail: "The Editor project could not be built because of an unknown error.",
		});
	});

	it("hides an artifact as soon as the canonical project revision changes", async () => {
		state.buildResult = AsyncResult.success(createArtifact("a".repeat(64), 0));
		const render = await renderController();
		expect(controller?.buildStatus).toBe("valid");
		expect(controller?.artifactSummary).toBeDefined();

		state.project = {
			...(state.project as Record<string, unknown>),
			revision: 1,
		};
		await render();
		expect(controller?.buildStatus).toBe("stale");
		expect(controller?.artifactSummary).toBeUndefined();
	});

	it("does not show an install result from a different artifact hash", async () => {
		const firstHash = "a".repeat(64);
		const secondHash = "b".repeat(64);
		state.buildResult = AsyncResult.success(createArtifact(firstHash, 0));
		state.installResults.set(
			firstHash,
			AsyncResult.success({
				packageId: firstHash,
			}),
		);
		const render = await renderController();
		expect(controller?.installedPackageId).toBe(firstHash);

		state.buildResult = AsyncResult.success(createArtifact(secondHash, 0));
		await render();
		expect(controller?.installedPackageId).toBeUndefined();
	});

	it("sends the exact current artifact to both output actions", async () => {
		const artifact = createArtifact("a".repeat(64), 0);
		state.buildResult = AsyncResult.success(artifact);
		const { container } = await renderBuild();

		await act(async () => {
			container.querySelector<HTMLElement>('[data-ui="EditorBuildSave"]')?.click();
			container.querySelector<HTMLElement>('[data-ui="EditorBuildInstall"]')?.click();
		});

		expect(state.commandSetters.get(`save:${artifact.contentHash}`)).toHaveBeenCalledWith(
			artifact,
		);
		expect(state.commandSetters.get(`install:${artifact.contentHash}`)).toHaveBeenCalledWith({
			artifact,
			targetVersion: "1.0",
		});
	});

	it("shows a settled install failure inside an open major-update confirmation", async () => {
		const artifact = createArtifact("a".repeat(64), 0);
		state.buildResult = AsyncResult.success(artifact);
		state.catalogState = {
			type: "ready",
			arkpacks: [
				{
					packageId: artifact.projectId,
					contentHash: "b".repeat(64),
					title: "Existing",
					version: "2.0",
					arkini: "0.5.0",
					provenance: {
						type: "community",
					},
					source: "user",
				},
			],
		};
		state.installResults.set(
			artifact.contentHash,
			AsyncResult.fail(new Error("Install storage is unavailable.")),
		);
		const { container } = await renderBuild();

		await act(async () => {
			container.querySelector<HTMLElement>('[data-ui="EditorBuildInstall"]')?.click();
		});

		expect(
			container.querySelector('[data-ui="EditorBuildMajorUpdateError"]')?.textContent,
		).toContain("Install storage is unavailable.");
	});

	it("builds the current local revision without signing input", async () => {
		await renderController();
		controller?.build();
		expect(state.commandSetters.get("build:editor-test")).toHaveBeenCalledWith({
			expectedRevision: 0,
		});
	});

	it("keeps a major bundled-package update cancellable before command admission", async () => {
		const artifact = createArtifact("b".repeat(64), 0);
		state.buildResult = AsyncResult.success(artifact);
		state.catalogState = {
			type: "ready",
			arkpacks: [
				{
					packageId: "editor-test",
					contentHash: "a".repeat(64),
					title: "Existing",
					version: "2.0",
					arkini: "1.0.0",
					provenance: {
						type: "community",
					},
					source: "bundled",
				},
			],
		};
		await renderController();
		const install = state.commandSetters.get(`install:${artifact.contentHash}`);

		await act(async () => controller?.installArtifact());
		expect(controller?.installAction).toBe("update");
		expect(controller?.installConfirmation).toBeDefined();
		expect(install).not.toHaveBeenCalled();

		await act(async () => controller?.cancelInstall());
		expect(controller?.installConfirmation).toBeUndefined();
		expect(install).not.toHaveBeenCalled();

		await act(async () => controller?.installArtifact());
		const confirmation = controller?.installConfirmation;
		await act(async () => controller?.confirmInstall());
		expect(install).toHaveBeenCalledWith({
			artifact,
			confirmation,
			targetVersion: "1.0",
		});
	});

	it("admits a same-major user-package update without confirmation", async () => {
		const artifact = createArtifact("b".repeat(64), 0);
		state.buildResult = AsyncResult.success(artifact);
		state.catalogState = {
			type: "ready",
			arkpacks: [
				{
					packageId: "editor-test",
					contentHash: "a".repeat(64),
					title: "Existing",
					version: "1.9",
					arkini: "1.0.0",
					provenance: {
						type: "community",
					},
					source: "user",
				},
			],
		};
		await renderController();

		await act(async () => controller?.installArtifact());

		expect(controller?.installConfirmation).toBeUndefined();
		expect(state.commandSetters.get(`install:${artifact.contentHash}`)).toHaveBeenCalledWith({
			artifact,
			targetVersion: "1.0",
		});
	});
});
