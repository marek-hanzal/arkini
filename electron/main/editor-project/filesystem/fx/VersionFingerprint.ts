import { createHash } from "node:crypto";

import type { EditorBoardScenarioFileSchema } from "~/board-scenario/schema/EditorBoardScenarioFileSchema";
import type { EditorVersionManifestSchema } from "~/project-version/EditorVersionManifestSchema";

const encoder = new TextEncoder();

export const hashVersionBytes = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");

export const hashVersionJson = (value: unknown) =>
	hashVersionBytes(encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`));

const sortedRecord = (
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

/** Hashes authored content while excluding checkout-specific scenario provenance. */
export const createVersionFingerprint = (
	manifest: EditorVersionManifestSchema.Type,
	scenarios: ReadonlyArray<EditorBoardScenarioFileSchema.Type>,
) =>
	hashVersionBytes(
		encoder.encode(
			JSON.stringify({
				...manifest,
				scenarios: sortedRecord(
					scenarios.map(
						({ revision: _revision, ...scenario }) =>
							[
								scenario.name,
								hashVersionJson(scenario),
							] as const,
					),
				),
			}),
		),
	);
