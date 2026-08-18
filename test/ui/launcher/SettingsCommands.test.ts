// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsDiagnosticsCommandAtom } from "~/ui/settings/SettingsDiagnosticsCommandAtom";
import { SettingsMcpCommandAtom } from "~/ui/settings/SettingsMcpCommandAtom";
import { SettingsUserDataCommandAtom } from "~/ui/settings/SettingsUserDataCommandAtom";

const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	Reflect.deleteProperty(window, "arkini");
});

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

describe("Settings feature commands", () => {
	it("admits one MCP check/write sequence and projects its success", async () => {
		let resolveCheck: (result: { readonly type: "available" }) => void = () => undefined;
		const checkPort = vi.fn(
			() =>
				new Promise<{
					readonly type: "available";
				}>((resolve) => {
					resolveCheck = resolve;
				}),
		);
		const writePort = vi.fn(() => Promise.resolve());
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editorMcp: {
					readPort: () => Promise.resolve(32_310),
					checkPort,
					writePort,
				},
			},
		});
		const registry = makeRegistry();
		registry.mount(SettingsMcpCommandAtom);
		registry.set(SettingsMcpCommandAtom, {
			action: "check",
			rawPort: "32311",
		});
		registry.set(SettingsMcpCommandAtom, {
			action: "check",
			rawPort: "32311",
		});

		await vi.waitFor(() => expect(checkPort).toHaveBeenCalledOnce());
		expect(registry.get(SettingsMcpCommandAtom)).toMatchObject({
			kind: "checking",
			port: "32311",
		});
		resolveCheck({
			type: "available",
		});
		await vi.waitFor(() => expect(writePort).toHaveBeenCalledWith(32_311));
		await vi.waitFor(() =>
			expect(registry.get(SettingsMcpCommandAtom)).toEqual({
				kind: "available",
				port: "32311",
			}),
		);
	});

	it("projects an MCP check failure without entering the write path", async () => {
		const checkPort = vi.fn(() => Promise.reject(new Error("port check failed")));
		const writePort = vi.fn(() => Promise.resolve());
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editorMcp: {
					readPort: () => Promise.resolve(32_310),
					checkPort,
					writePort,
				},
			},
		});
		const registry = makeRegistry();
		registry.mount(SettingsMcpCommandAtom);
		registry.set(SettingsMcpCommandAtom, {
			action: "check",
			rawPort: "32311",
		});

		await vi.waitFor(() =>
			expect(registry.get(SettingsMcpCommandAtom)).toEqual({
				kind: "error",
				port: "32311",
				message: "port check failed",
			}),
		);
		expect(writePort).not.toHaveBeenCalled();
	});

	it("rejects an invalid MCP port before checking or writing", () => {
		const checkPort = vi.fn();
		const writePort = vi.fn();
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editorMcp: {
					readPort: vi.fn(),
					checkPort,
					writePort,
				},
			},
		});
		const registry = makeRegistry();
		registry.mount(SettingsMcpCommandAtom);
		registry.set(SettingsMcpCommandAtom, {
			action: "check",
			rawPort: "1023",
		});

		expect(registry.get(SettingsMcpCommandAtom)).toEqual({
			kind: "error",
			port: "1023",
			message: "Use a port from 1024 to 65535.",
		});
		expect(checkPort).not.toHaveBeenCalled();
		expect(writePort).not.toHaveBeenCalled();
	});

	it("admits one diagnostics open and interrupts it on registry disposal", async () => {
		let resolveOpen: () => void = () => undefined;
		const openDirectory = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveOpen = resolve;
				}),
		);
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				diagnostics: {
					openDirectory,
				},
			},
		});
		const registry = makeRegistry();
		registry.mount(SettingsDiagnosticsCommandAtom);
		registry.set(SettingsDiagnosticsCommandAtom, undefined);
		registry.set(SettingsDiagnosticsCommandAtom, undefined);

		await vi.waitFor(() => expect(openDirectory).toHaveBeenCalledOnce());
		expect(registry.get(SettingsDiagnosticsCommandAtom)).toEqual({
			kind: "pending",
		});
		registry.dispose();
		resolveOpen();
		await Promise.resolve();
		expect(registry.getNodes().size).toBe(0);
	});

	it("projects a diagnostics open failure", async () => {
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				diagnostics: {
					openDirectory: () => Promise.reject(new Error("logs unavailable")),
				},
			},
		});
		const registry = makeRegistry();
		registry.mount(SettingsDiagnosticsCommandAtom);
		registry.set(SettingsDiagnosticsCommandAtom, undefined);

		await vi.waitFor(() =>
			expect(registry.get(SettingsDiagnosticsCommandAtom)).toEqual({
				kind: "error",
				error: new Error("logs unavailable"),
			}),
		);
	});

	it("projects a user-data open failure", async () => {
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				userData: {
					openDirectory: () => Promise.reject(new Error("data unavailable")),
				},
			},
		});
		const registry = makeRegistry();
		registry.mount(SettingsUserDataCommandAtom);
		registry.set(SettingsUserDataCommandAtom, undefined);

		await vi.waitFor(() =>
			expect(registry.get(SettingsUserDataCommandAtom)).toEqual({
				kind: "error",
				error: new Error("data unavailable"),
			}),
		);
	});
});
