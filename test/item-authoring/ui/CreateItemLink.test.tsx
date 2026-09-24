// @vitest-environment jsdom

import { HotkeysProvider } from "@tanstack/react-hotkeys";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { CreateItemLink } from "~/item-authoring/ui/CreateItemLink";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it.each([
	"c",
	"n",
])("opens the seeded item form with %s while leaving typing alone", async (shortcut) => {
	const rootRoute = createRootRoute();
	const source = createRoute({
		getParentRoute: () => rootRoute,
		path: "/artwork",
		component: () => (
			<CreateItemLink
				projectId="project-id"
				defaultTitle="Faith"
				resourceUid="artwork-uid"
				shortcut={shortcut}
			>
				Create item
			</CreateItemLink>
		),
	});
	const form = createRoute({
		getParentRoute: () => rootRoute,
		path: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
		component: () => <div>Item form</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			source,
			form,
		]),
		history: createMemoryHistory({
			initialEntries: [
				"/artwork",
			],
		}),
		defaultPendingMs: 60000,
	});
	await router.load();
	const host = document.createElement("div");
	const input = document.createElement("input");
	document.body.append(host, input);
	const root = createRoot(host);
	try {
		await act(async () =>
			root.render(
				<HotkeysProvider>
					<RouterProvider router={router} />
				</HotkeysProvider>,
			),
		);
		await act(async () =>
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: shortcut,
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		expect(router.state.location.pathname).toBe("/artwork");
		await act(async () =>
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: shortcut,
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		expect(router.state.location.pathname).toMatch(
			/^\/editor\/project-id\/editor\/items\/[^/]+\/form\/identity$/,
		);
		expect(router.state.location.search).toEqual({
			create: true,
			defaultTitle: "Faith",
			resourceUid: "artwork-uid",
		});
	} finally {
		await act(async () => root.unmount());
		host.remove();
		input.remove();
	}
});
