import { crypto as sigstoreCrypto } from "@sigstore/core";
import assert from "node:assert/strict";
import { Effect } from "effect";
import { verifySerapackProofFx } from "~/serapack-artifact/fx/verifySerapackProofFx";
import fixture from "./official.fixture.json";

assert.ok(process.versions.electron, "This regression must run in Electron.");
const originalVerifyFn = sigstoreCrypto.verify;
const verifyFn = (input: verifySerapackProofFx.Props) => {
	const result = Effect.runSync(verifySerapackProofFx(input));
	assert.equal(sigstoreCrypto.verify, originalVerifyFn);
	return result;
};
const artifact = Buffer.from(fixture.payloadBase64, "base64");
const proof = new TextEncoder().encode(JSON.stringify(fixture.proof));
const props = {
	artifact,
	proof,
	trustedRoot: fixture.trustedRoot,
	channel: {
		issuer: "https://token.actions.githubusercontent.com",
		subjectAlternativeName:
			/^https:\/\/github[.]com\/marek-hanzal\/arkini\/[.]github\/workflows\/release[.]yml@.+$/,
	},
};
assert.deepEqual(verifyFn(props), {
	type: "official",
});
const changed = Buffer.from(artifact);
changed[0] ^= 1;
assert.deepEqual(
	verifyFn({
		...props,
		artifact: changed,
	}),
	{
		type: "community",
	},
);
assert.deepEqual(
	verifyFn({
		...props,
		channel: {
			...props.channel,
			issuer: "https://wrong.example",
		},
	}),
	{
		type: "community",
	},
);
assert.deepEqual(verifyFn(props), {
	type: "official",
});

const changedProof = structuredClone(fixture.proof);
const signature = Buffer.from(changedProof.messageSignature.signature, "base64");
signature[0] ^= 1;
changedProof.messageSignature.signature = signature.toString("base64");
assert.deepEqual(
	verifyFn({
		...props,
		proof: new TextEncoder().encode(JSON.stringify(changedProof)),
	}),
	{
		type: "community",
	},
);
