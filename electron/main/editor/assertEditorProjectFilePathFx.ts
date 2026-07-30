import { Effect } from "effect";
import { isAbsolute, posix } from "node:path";

import { ElectronMainError } from "../ElectronMainError";

const portablePathSegmentPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const windowsDeviceNamePattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

const isPortablePathSegment = (segment: string) =>
	portablePathSegmentPattern.test(segment) &&
	!segment.endsWith(".") &&
	!windowsDeviceNamePattern.test(segment);

/** Validates one portable project-relative JSON or PNG path before filesystem use. */
export const assertEditorProjectFilePathFx = Effect.fn("assertEditorProjectFilePathFx")(
	(candidate: string) =>
		Effect.gen(function* () {
			const normalized = posix.normalize(candidate);
			const valid =
				candidate.length > 0 &&
				candidate.length <= 512 &&
				candidate === normalized &&
				!candidate.includes("\\") &&
				!isAbsolute(candidate) &&
				candidate !== ".." &&
				!candidate.startsWith("../") &&
				candidate.split("/").every(isPortablePathSegment) &&
				(candidate.endsWith(".json") || candidate.endsWith(".png"));
			if (valid) return candidate;
			return yield* Effect.fail(
				new ElectronMainError({
					operation: "Invalid Arkini editor project file path",
					cause: candidate,
				}),
			);
		}),
);
