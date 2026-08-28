import {
	fulcioHandler,
	initializeCA,
	initializeCTLog,
	initializeTLog,
	rekorHandler,
} from "@sigstore/mock";
import { mock } from "@sigstore/mock/dist/mock.js";
import { createHash, generateKeyPairSync } from "node:crypto";
import { sign } from "sigstore";

const fulcioUrl = "https://fulcio.arkini.test";
const rekorUrl = "https://rekor.arkini.test";
const encodeTokenPart = (value: unknown) =>
	Buffer.from(JSON.stringify(value)).toString("base64url");

export const createTestSigstore = async () => {
	const clock = new Date();
	const caKeys = generateKeyPairSync("ec", {
		namedCurve: "prime256v1",
	});
	const logKeys = generateKeyPairSync("ec", {
		namedCurve: "prime256v1",
	});
	const ctlog = await initializeCTLog(caKeys, clock);
	const ca = await initializeCA(caKeys, ctlog, clock);
	const tlog = await initializeTLog(rekorUrl, logKeys, clock);
	const validFrom = new Date(clock.getTime() - 1_000).toISOString();
	const trustedRoot = {
		mediaType: "application/vnd.dev.sigstore.trustedroot+json;version=0.1",
		tlogs: [
			{
				baseUrl: rekorUrl,
				hashAlgorithm: "SHA2_256",
				publicKey: {
					rawBytes: tlog.publicKey.toString("base64"),
					keyDetails: "PKIX_ECDSA_P256_SHA_256",
					validFor: {
						start: validFrom,
					},
				},
				logId: {
					keyId: createHash("sha256").update(tlog.publicKey).digest("base64"),
				},
			},
		],
		certificateAuthorities: [
			{
				subject: {
					organization: "sigstore.mock",
					commonName: "sigstore",
				},
				uri: fulcioUrl,
				certChain: {
					certificates: [
						{
							rawBytes: Buffer.from(
								ca.rootCertificate.buffer,
								ca.rootCertificate.byteOffset,
								ca.rootCertificate.byteLength,
							).toString("base64"),
						},
					],
				},
				validFor: {
					start: validFrom,
				},
			},
		],
		ctlogs: [
			{
				baseUrl: "https://ctlog.arkini.test",
				hashAlgorithm: "SHA2_256",
				publicKey: {
					rawBytes: ctlog.publicKey.toString("base64"),
					keyDetails: "PKIX_ECDSA_P256_SHA_256",
					validFor: {
						start: validFrom,
					},
				},
				logId: {
					keyId: Buffer.from(
						ctlog.logID.buffer,
						ctlog.logID.byteOffset,
						ctlog.logID.byteLength,
					).toString("base64"),
				},
			},
		],
		timestampAuthorities: [],
	};

	return {
		trustedRoot,
		sign: async (bytes: Uint8Array, subjectAlternativeName: string) => {
			mock(
				fulcioUrl,
				fulcioHandler(ca, {
					strict: true,
				}),
			);
			mock(
				rekorUrl,
				rekorHandler(tlog, {
					strict: true,
				}),
			);
			const identityToken = [
				encodeTokenPart({
					alg: "none",
					typ: "JWT",
				}),
				encodeTokenPart({
					iss: "https://token.actions.githubusercontent.com",
					sub: subjectAlternativeName,
				}),
				"",
			].join(".");
			return await sign(Buffer.from(bytes), {
				fulcioURL: fulcioUrl,
				identityToken,
				legacyCompatibility: true,
				rekorURL: rekorUrl,
				tlogUpload: true,
			});
		},
	};
};
