// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompletionCommandAtom } from "~/ui/settings/CompletionCommandAtom";

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
		registry.mount(CompletionCommandAtom);
		registry.set(CompletionCommandAtom, "read");
		await vi.waitFor(() =>
			expect(registry?.get(CompletionCommandAtom)).toMatchObject({
				kind: "ready",
				status: {
					type: "not-installed",
				},
			}),
		);
		registry.set(CompletionCommandAtom, "install");
		await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
	});
});
