// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsCliCommandAtom } from "~/ui/settings/SettingsCliCommandAtom";

let registry: AtomRegistry.AtomRegistry | undefined;

afterEach(() => {
	registry?.dispose();
	registry = undefined;
	Reflect.deleteProperty(window, "arkini");
});

describe("Settings CLI command", () => {
	it("loads and installs the packaged CLI through one admitted command sequence", async () => {
		const install = vi.fn(() =>
			Promise.resolve({
				type: "installed" as const,
				commandPath: "/tmp/arkini-cli",
			}),
		);
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				cli: {
					status: () =>
						Promise.resolve({
							type: "not-installed" as const,
							commandPath: "/tmp/arkini-cli",
						}),
					install,
					uninstall: vi.fn(),
				},
			},
		});
		registry = AtomRegistry.make({
			scheduleTask,
		});
		registry.mount(SettingsCliCommandAtom);
		registry.set(SettingsCliCommandAtom, "read");
		await vi.waitFor(() =>
			expect(registry?.get(SettingsCliCommandAtom)).toMatchObject({
				kind: "ready",
				status: {
					type: "not-installed",
				},
			}),
		);
		registry.set(SettingsCliCommandAtom, "install");
		await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
		await vi.waitFor(() =>
			expect(registry?.get(SettingsCliCommandAtom)).toMatchObject({
				kind: "ready",
				status: {
					type: "installed",
				},
			}),
		);
	});
});
