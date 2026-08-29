// @vitest-environment jsdom

import { RegistryContext, scheduleTask, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutPortraitAssetsAtom } from "~/ui/launcher/about/AboutPortraitAssetsAtom";
import { ArkiniDefaultPackageId } from "../../../../shared/ArkiniAppMetadata";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const harness = vi.hoisted(() => ({
	loadFailure: undefined as Error | undefined,
	loadedPackageIds: [] as string[],
}));

const payload = {
	config: GameConfigSchema.parse({
		resources: {
			hero: "hero",
			"avatar-01": "avatar:one",
			"avatar-02": "avatar:two",
		},
		meta: {
			id: "game:about-portraits",
			title: "About portraits",
			board: {
				width: 1,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
		},
		items: {},
	}),
	resources: [
		{
			id: "hero",
			mime: "image/png",
			bytes: Uint8Array.of(0),
		},
		{
			id: "avatar:one",
			mime: "image/png",
			bytes: Uint8Array.of(1),
		},
		{
			id: "avatar:two",
			mime: "image/webp",
			bytes: Uint8Array.of(2),
		},
	],
};

vi.mock("~/renderer/arkpack/loadArkpackFx", async () => {
	const { Effect } = await import("effect");
	return {
		loadArkpackFx: ({ packageId }: { readonly packageId: string }) =>
			Effect.suspend(() => {
				harness.loadedPackageIds.push(packageId);
				return harness.loadFailure === undefined
					? Effect.succeed({
							payload,
						})
					: Effect.fail(harness.loadFailure);
			}),
	};
});

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

const PortraitProbe = () => {
	const result = useAtomValue(AboutPortraitAssetsAtom);
	const urls = AsyncResult.isSuccess(result) ? result.value : [];
	return createElement("output", null, JSON.stringify(urls));
};

beforeEach(() => {
	harness.loadFailure = undefined;
	harness.loadedPackageIds.length = 0;
	vi.restoreAllMocks();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
});

describe("AboutPortraitAssetsAtom", () => {
	it("loads canonical portraits and revokes every owned URL when its registry closes", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:portrait-one")
			.mockReturnValueOnce("blob:portrait-two");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(PortraitProbe),
				),
			);
		});
		await vi.waitFor(() =>
			expect(container.textContent).toBe(
				JSON.stringify([
					"blob:portrait-one",
					"blob:portrait-two",
				]),
			),
		);

		expect(harness.loadedPackageIds).toEqual([
			ArkiniDefaultPackageId,
		]);
		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect(createObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
		expect(createObjectUrl.mock.calls[1]?.[0]).toBeInstanceOf(Blob);
		expect(revokeObjectUrl).not.toHaveBeenCalled();

		registry.dispose();
		await vi.waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledTimes(2));
		expect(revokeObjectUrl.mock.calls).toEqual([
			[
				"blob:portrait-one",
			],
			[
				"blob:portrait-two",
			],
		]);
	});

	it("maps an ordinary load failure to the empty presentation without creating URLs", async () => {
		harness.loadFailure = new Error("portrait package unavailable");
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const createObjectUrl = vi.spyOn(URL, "createObjectURL");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(PortraitProbe),
				),
			);
		});
		await vi.waitFor(() => {
			const result = registry.get(AboutPortraitAssetsAtom);
			expect(AsyncResult.isSuccess(result) && !result.waiting).toBe(true);
		});

		expect(container.textContent).toBe("[]");
		expect(harness.loadedPackageIds).toEqual([
			ArkiniDefaultPackageId,
		]);
		expect(createObjectUrl).not.toHaveBeenCalled();
		expect(revokeObjectUrl).not.toHaveBeenCalled();
	});

	it("cleans a partially created URL batch before publishing the empty fallback", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		vi.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:partial-portrait")
			.mockImplementationOnce(() => {
				throw new Error("object URL allocation failed");
			});
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(PortraitProbe),
				),
			);
		});
		await vi.waitFor(() => {
			const result = registry.get(AboutPortraitAssetsAtom);
			expect(AsyncResult.isSuccess(result) && !result.waiting).toBe(true);
		});

		expect(container.textContent).toBe("[]");
		expect(revokeObjectUrl).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:partial-portrait");
		registry.dispose();
		expect(revokeObjectUrl).toHaveBeenCalledOnce();
	});

	it("keeps one owner across a quick unmount/remount and eventually revokes after unmount", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:remount-one")
			.mockReturnValueOnce("blob:remount-two");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(PortraitProbe),
				),
			);
		});
		await vi.waitFor(() => expect(createObjectUrl).toHaveBeenCalledTimes(2));

		await act(async () => root.render(null));
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(PortraitProbe),
				),
			);
		});
		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect(revokeObjectUrl).not.toHaveBeenCalled();

		await act(async () => root.render(null));
		await vi.waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledTimes(2));
		expect(harness.loadedPackageIds).toEqual([
			ArkiniDefaultPackageId,
		]);
	});

	it("does not duplicate or prematurely revoke portrait ownership under StrictMode", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:strict-one")
			.mockReturnValueOnce("blob:strict-two");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					StrictMode,
					null,
					createElement(
						RegistryContext.Provider,
						{
							value: registry,
						},
						createElement(PortraitProbe),
					),
				),
			);
		});
		await vi.waitFor(() => expect(createObjectUrl).toHaveBeenCalledTimes(2));

		expect(harness.loadedPackageIds).toEqual([
			ArkiniDefaultPackageId,
		]);
		expect(revokeObjectUrl).not.toHaveBeenCalled();

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		registry.dispose();
		await vi.waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledTimes(2));
		expect(revokeObjectUrl.mock.calls).toEqual([
			[
				"blob:strict-one",
			],
			[
				"blob:strict-two",
			],
		]);
	});
});
