import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import type { BuiltInArkpack } from "~/bridge/arkpack/BuiltInArkpack";
import { DemoArkpack } from "~/bridge/arkpack/DemoArkpack";

/** Every package binary deliberately embedded into official application distributions. */
export const BuiltInArkpacks = [
	ArkiniArkpack,
	DemoArkpack,
] as const satisfies ReadonlyArray<BuiltInArkpack>;
