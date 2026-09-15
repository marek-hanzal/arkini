// @vitest-environment jsdom

import { RegistryContext, scheduleTask, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArkiniDefaultPackageId } from "~shared/ArkiniAppMetadata";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { AboutPortraitAssetsAtom } from "~/launcher/atom/AboutPortraitAssetsAtom";

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
			"avatar-01": "avatar:two",
			"avatar-03": "avatar:missing",
			"avatar-05": "avatar:one",
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
			url: "arkini://game/resource/hero",
		},
		{
			id: "avatar:one",
			mime: "image/png",
			url: "arkini://game/resource/avatar-one",
		},
		{
			id: "avatar:two",
			mime: "image/webp",
			url: "arkini://game/resource/avatar-two",
		},
	],
};

vi.mock("~/arkpack-catalog/fx/loadArkpackFx", async () => {
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

const mountProbe = async (registry: AtomRegistry.AtomRegistry) => {
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
	return container;
};

beforeEach(() => {
	harness.loadFailure = undefined;
	harness.loadedPackageIds.length = 0;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
});

describe("AboutPortraitAssetsAtom", () => {
	it("loads installed portrait URLs in stable role order", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const container = await mountProbe(registry);

		await vi.waitFor(() =>
			expect(container.textContent).toBe(
				JSON.stringify([
					"arkini://game/resource/avatar-two",
					"arkini://game/resource/avatar-one",
				]),
			),
		);
		expect(harness.loadedPackageIds).toEqual([
			ArkiniDefaultPackageId,
		]);
	});

	it("maps an ordinary load failure to the empty presentation", async () => {
		harness.loadFailure = new Error("portrait package unavailable");
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const container = await mountProbe(registry);

		await vi.waitFor(() => {
			const result = registry.get(AboutPortraitAssetsAtom);
			expect(AsyncResult.isSuccess(result) && !result.waiting).toBe(true);
		});
		expect(container.textContent).toBe("[]");
		expect(harness.loadedPackageIds).toEqual([
			ArkiniDefaultPackageId,
		]);
	});
});
