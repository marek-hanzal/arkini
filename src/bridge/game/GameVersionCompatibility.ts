import { Effect } from "effect";
import { ArkiniAppVersion, ArkiniMinimumInputVersion } from "../../../shared/ArkiniAppMetadata";

const compareNumbers = (left: number, right: number) => Math.sign(left - right);

const parseArkiniVersion = (version: string) => {
	const withoutBuild = version.split("+", 1)[0] ?? "";
	const prereleaseSeparator = withoutBuild.indexOf("-");
	const core =
		prereleaseSeparator < 0 ? withoutBuild : withoutBuild.slice(0, prereleaseSeparator);
	const prerelease =
		prereleaseSeparator < 0 ? undefined : withoutBuild.slice(prereleaseSeparator + 1);
	const [major = "0", minor = "0", patch = "0"] = core.split(".");
	return {
		core: [
			Number(major),
			Number(minor),
			Number(patch),
		] as const,
		prerelease: prerelease?.split("."),
	};
};

const compareArkiniVersions = (left: string, right: string) => {
	const parsedLeft = parseArkiniVersion(left);
	const parsedRight = parseArkiniVersion(right);
	for (let index = 0; index < parsedLeft.core.length; index += 1) {
		const result = compareNumbers(parsedLeft.core[index] ?? 0, parsedRight.core[index] ?? 0);
		if (result !== 0) return result;
	}
	if (parsedLeft.prerelease === undefined) return parsedRight.prerelease === undefined ? 0 : 1;
	if (parsedRight.prerelease === undefined) return -1;
	const length = Math.max(parsedLeft.prerelease.length, parsedRight.prerelease.length);
	for (let index = 0; index < length; index += 1) {
		const leftPart = parsedLeft.prerelease[index];
		const rightPart = parsedRight.prerelease[index];
		if (leftPart === undefined) return -1;
		if (rightPart === undefined) return 1;
		if (leftPart === rightPart) continue;
		const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : undefined;
		const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : undefined;
		if (leftNumber !== undefined && rightNumber !== undefined) {
			return compareNumbers(leftNumber, rightNumber);
		}
		if (leftNumber !== undefined) return -1;
		if (rightNumber !== undefined) return 1;
		return leftPart < rightPart ? -1 : 1;
	}
	return 0;
};

/** Rejects persisted input written outside this build's supported Arkini version window. */
export const assertSupportedGameVersionFx = Effect.fn("assertSupportedGameVersionFx")(
	(version: string) =>
		Effect.try({
			try: () => {
				if (
					compareArkiniVersions(version, ArkiniMinimumInputVersion) < 0 ||
					compareArkiniVersions(version, ArkiniAppVersion) > 0
				) {
					throw new Error(
						`Arkini ${ArkiniAppVersion} supports input versions ${ArkiniMinimumInputVersion} through ${ArkiniAppVersion}, but received ${version}.`,
					);
				}
			},
			catch: (cause) => cause,
		}),
);

export const readArkpackVersionFx = Effect.fn("readArkpackVersionFx")((version: string) =>
	Effect.sync(() => {
		const [major = "0", minor = "0"] = version.split(".");
		return {
			major: Number(major),
			minor: Number(minor),
		};
	}),
);
