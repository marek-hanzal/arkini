import { describe, expect, it } from "vitest";

import {
	ArkiniReleaseIdentity,
	createArkiniReleaseIdentity,
} from "~/engine/pack/ArkiniReleaseIdentity";
import { createArkpackTrustVerifier } from "~/engine/pack/fx/verifyArkpackTrustFx";
import { createTestSigstore } from "./verifyArkpackTrustFx.test/createTestSigstore";

const bytes = new TextEncoder().encode("exact arkpack fixture bytes");
const releaseWorkflow =
	"https://github.com/marek-hanzal/arkini/.github/workflows/macos-prerelease.yml@refs/tags/v0.5.0";

describe("Arkpack release trust", () => {
	it("proves exact release bytes and collapses every failed proof to External", async () => {
		const sigstore = await createTestSigstore();
		const verify = createArkpackTrustVerifier({
			identity: ArkiniReleaseIdentity,
			trustedRoot: sigstore.trustedRoot,
		});
		const bundle = await sigstore.sign(bytes, releaseWorkflow);
		const forkBundle = await sigstore.sign(
			bytes,
			"https://github.com/fork/arkini/.github/workflows/macos-prerelease.yml@refs/tags/v0.5.0",
		);
		const changed = bytes.slice();
		changed[0] = (changed[0] ?? 0) ^ 1;

		expect(
			verify({
				bytes,
				signature: bundle,
			}),
		).toEqual({
			type: "trusted",
		});
		expect(
			verify({
				bytes: changed,
				signature: bundle,
			}),
		).toEqual({
			type: "external",
		});
		expect(
			verify({
				bytes,
				signature: forkBundle,
			}),
		).toEqual({
			type: "external",
		});
		expect(
			verify({
				bytes,
				signature: {},
			}),
		).toEqual({
			type: "external",
		});
		expect(
			verify({
				bytes,
			}),
		).toEqual({
			type: "external",
		});
	});

	it("lets a forked build trust only its own release workflow", async () => {
		const sigstore = await createTestSigstore();
		const forkBundle = await sigstore.sign(
			bytes,
			"https://github.com/fork/arkini/.github/workflows/macos-prerelease.yml@refs/tags/v0.5.0",
		);
		const verifyUpstream = createArkpackTrustVerifier({
			identity: ArkiniReleaseIdentity,
			trustedRoot: sigstore.trustedRoot,
		});
		const verifyFork = createArkpackTrustVerifier({
			identity: createArkiniReleaseIdentity({
				identity: "https://github.com/fork/arkini/.github/workflows/macos-prerelease.yml",
				issuer: "https://token.actions.githubusercontent.com",
			}),
			trustedRoot: sigstore.trustedRoot,
		});

		expect(
			verifyUpstream({
				bytes,
				signature: forkBundle,
			}),
		).toEqual({
			type: "external",
		});
		expect(
			verifyFork({
				bytes,
				signature: forkBundle,
			}),
		).toEqual({
			type: "trusted",
		});
	});
});
