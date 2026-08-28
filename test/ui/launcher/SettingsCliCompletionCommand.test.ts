// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsCliCompletionCommandAtom } from "~/ui/settings/SettingsCliCompletionCommandAtom";

let registry: AtomRegistry.AtomRegistry | undefined;

afterEach(() => {
	registry?.dispose();
	registry = undefined;
	Reflect.deleteProperty(window, "arkini");
});

describe("Settings CLI completion command", () => {
	it("loads and installs generated completion through one admitted sequence", async () => {
		const install = vi.fn(() =>
			Promise.resolve({
				type: "installed" as const,
				completionPath: "/tmp/_arkini-cli",
				shell: "zsh" as const,
			}),
		);
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				cli: {
					completion: {
						status: () =>
							Promise.resolve({
								type: "not-installed" as const,
								completionPath: "/tmp/_arkini-cli",
								shell: "zsh" as const,
							}),
						install,
						replace: vi.fn(),
						uninstall: vi.fn(),
					},
				},
			},
		});
		registry = AtomRegistry.make({
			scheduleTask,
		});
		registry.mount(SettingsCliCompletionCommandAtom);
		registry.set(SettingsCliCompletionCommandAtom, "read");
		await vi.waitFor(() =>
			expect(registry?.get(SettingsCliCompletionCommandAtom)).toMatchObject({
				kind: "ready",
				status: {
					type: "not-installed",
				},
			}),
		);
		registry.set(SettingsCliCompletionCommandAtom, "install");
		await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
	});
});
