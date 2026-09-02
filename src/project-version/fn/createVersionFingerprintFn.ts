import { createHash } from "node:crypto";

import type { BoardScenarioFileSchema } from "~/board-scenario/schema/BoardScenarioFileSchema";
import type { VersionManifestSchema } from "~/project-version/schema/VersionManifestSchema";

const encoder = new TextEncoder();

export const hashVersionBytesFn = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");

export const hashVersionJsonFn = (value: unknown) =>
	hashVersionBytesFn(encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`));

const sortedRecordFn = (
	entries: ReadonlyArray<
		readonly [
			string,
			string,
		]
	>,
) =>
	Object.fromEntries(
		[
			...entries,
		].sort(([left], [right]) => left.localeCompare(right)),
	);

/** Hashes authored version content while excluding checkout-specific scenario provenance. */
export const createVersionFingerprintFn = (
	manifest: VersionManifestSchema.Type,
	scenarios: ReadonlyArray<BoardScenarioFileSchema.Type>,
) =>
	hashVersionBytesFn(
		encoder.encode(
			JSON.stringify({
				...manifest,
				scenarios: sortedRecordFn(
					scenarios.map(
						({ revision: _revision, ...scenario }) =>
							[
								scenario.name,
								hashVersionJsonFn(scenario),
							] as const,
					),
				),
			}),
		),
	);
