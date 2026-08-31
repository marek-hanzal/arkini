// @vitest-environment jsdom

import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsDiagnosticsCommandAtom } from "~/application-settings/atom/SettingsDiagnosticsCommandAtom";
import { SettingsUserDataCommandAtom } from "~/application-settings/atom/SettingsUserDataCommandAtom";

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
