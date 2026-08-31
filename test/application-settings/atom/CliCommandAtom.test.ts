// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CliCommandAtom } from "~/application-settings/atom/CliCommandAtom";

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
					replace: vi.fn(),
					uninstall: vi.fn(),
				},
			},
		});
		registry = AtomRegistry.make({
			scheduleTask,
		});
		registry.mount(CliCommandAtom);
		registry.set(CliCommandAtom, "read");
		await vi.waitFor(() =>
			expect(registry?.get(CliCommandAtom)).toMatchObject({
				kind: "ready",
				status: {
					type: "not-installed",
				},
			}),
		);
		registry.set(CliCommandAtom, "install");
		await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
		await vi.waitFor(() =>
			expect(registry?.get(CliCommandAtom)).toMatchObject({
				kind: "ready",
				status: {
					type: "installed",
				},
			}),
		);
	});

	it("requires the explicit replace command for a conflicting path", async () => {
		const replace = vi.fn(() =>
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
							type: "conflict" as const,
							commandPath: "/tmp/arkini-cli",
							message: "Another file already exists.",
							replaceable: true,
						}),
					install: vi.fn(),
					replace,
					uninstall: vi.fn(),
				},
			},
		});
		registry = AtomRegistry.make({
			scheduleTask,
		});
		registry.mount(CliCommandAtom);
		registry.set(CliCommandAtom, "read");
		await vi.waitFor(() =>
			expect(registry?.get(CliCommandAtom)).toMatchObject({
				kind: "ready",
				status: {
					type: "conflict",
				},
			}),
		);
		registry.set(CliCommandAtom, "install");
		registry.set(CliCommandAtom, "replace");
		await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());
	});
});
