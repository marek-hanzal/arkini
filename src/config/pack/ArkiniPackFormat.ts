import { decode, encode } from "@msgpack/msgpack";

const arkiniPackMagic = new Uint8Array([
	0x41,
	0x52,
	0x4b,
	0x50,
	0x41,
	0x43,
	0x4b,
	0x31,
]);

interface ArkiniPackResourceEntry {
	id: string;
	mime: string;
	byteLength: number;
}

interface ArkiniPackManifest {
	version: 1;
	configEncoding: "messagepack";
	configByteLength: number;
	resources: ArkiniPackResourceEntry[];
}

export interface ArkiniPackResourcePayload {
	id: string;
	mime: string;
	bytes: Uint8Array;
}

export interface ArkiniPackDecodedPayload {
	config: unknown;
	resources: ArkiniPackResourcePayload[];
}

export interface ArkiniPackEncodeInput {
	config: unknown;
	resources: readonly ArkiniPackResourcePayload[];
}

const headerByteLength = arkiniPackMagic.byteLength + 4;

export const encodeArkiniPack = ({ config, resources }: ArkiniPackEncodeInput): Uint8Array => {
	const configBytes = encode(stripUndefinedObjectFields(config));
	const manifestBytes = encode({
		version: 1,
		configEncoding: "messagepack",
		configByteLength: configBytes.byteLength,
		resources: resources.map((resource) => ({
			id: resource.id,
			mime: resource.mime,
			byteLength: resource.bytes.byteLength,
		})),
	} satisfies ArkiniPackManifest);
	const output = new Uint8Array(
		headerByteLength +
			manifestBytes.byteLength +
			configBytes.byteLength +
			resources.reduce((sum, resource) => sum + resource.bytes.byteLength, 0),
	);
	const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
	output.set(arkiniPackMagic, 0);
	view.setUint32(arkiniPackMagic.byteLength, manifestBytes.byteLength, true);

	let offset = headerByteLength;
	output.set(manifestBytes, offset);
	offset += manifestBytes.byteLength;
	output.set(configBytes, offset);
	offset += configBytes.byteLength;

	for (const resource of resources) {
		output.set(resource.bytes, offset);
		offset += resource.bytes.byteLength;
	}

	return output;
};

export const decodeArkiniPack = (bytes: Uint8Array): ArkiniPackDecodedPayload => {
	assertMinimumLength(bytes, headerByteLength, "header");
	assertMagic(bytes);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const manifestByteLength = view.getUint32(arkiniPackMagic.byteLength, true);
	const manifestStart = headerByteLength;
	const manifestEnd = manifestStart + manifestByteLength;
	assertMinimumLength(bytes, manifestEnd, "manifest");

	const manifest = parseArkiniPackManifest(bytes.slice(manifestStart, manifestEnd));
	const configStart = manifestEnd;
	const configEnd = configStart + manifest.configByteLength;
	assertMinimumLength(bytes, configEnd, "config");
	const config = decode(bytes.slice(configStart, configEnd));

	let offset = configEnd;
	const resources = manifest.resources.map((entry) => {
		const resourceEnd = offset + entry.byteLength;
		assertMinimumLength(bytes, resourceEnd, `resource ${entry.id}`);
		const resource = {
			id: entry.id,
			mime: entry.mime,
			bytes: bytes.slice(offset, resourceEnd),
		};
		offset = resourceEnd;
		return resource;
	});

	if (offset !== bytes.byteLength) {
		throw new Error(
			`Invalid Arkini pack: trailing ${bytes.byteLength - offset} bytes after resource payloads.`,
		);
	}

	return {
		config,
		resources,
	};
};

const stripUndefinedObjectFields = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(stripUndefinedObjectFields);
	}
	if (!value || typeof value !== "object") {
		return value;
	}
	return Object.fromEntries(
		Object.entries(value)
			.filter(([, entry]) => entry !== undefined)
			.map(([key, entry]) => [
				key,
				stripUndefinedObjectFields(entry),
			]),
	);
};

const parseArkiniPackManifest = (bytes: Uint8Array): ArkiniPackManifest => {
	const manifest = decode(bytes);
	if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
		throw new Error("Invalid Arkini pack: manifest must be an object.");
	}
	const value = manifest as Record<string, unknown>;
	if (value.version !== 1) {
		throw new Error("Invalid Arkini pack: unsupported manifest version.");
	}
	if (value.configEncoding !== "messagepack") {
		throw new Error("Invalid Arkini pack: unsupported config encoding.");
	}
	if (!Number.isSafeInteger(value.configByteLength) || Number(value.configByteLength) < 0) {
		throw new Error(
			"Invalid Arkini pack: configByteLength must be a safe non-negative integer.",
		);
	}
	if (!Array.isArray(value.resources)) {
		throw new Error("Invalid Arkini pack: resources must be an array.");
	}

	return {
		version: 1,
		configEncoding: "messagepack",
		configByteLength: Number(value.configByteLength),
		resources: value.resources.map(parseArkiniPackResourceEntry),
	};
};

const parseArkiniPackResourceEntry = (entry: unknown): ArkiniPackResourceEntry => {
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		throw new Error("Invalid Arkini pack: resource manifest entry must be an object.");
	}
	const value = entry as Record<string, unknown>;
	if (typeof value.id !== "string" || value.id.length === 0) {
		throw new Error("Invalid Arkini pack: resource id must be a non-empty string.");
	}
	if (typeof value.mime !== "string" || value.mime.length === 0) {
		throw new Error(
			`Invalid Arkini pack: resource ${value.id} mime must be a non-empty string.`,
		);
	}
	if (!Number.isSafeInteger(value.byteLength) || Number(value.byteLength) < 0) {
		throw new Error(
			`Invalid Arkini pack: resource ${value.id} byteLength must be a safe non-negative integer.`,
		);
	}
	return {
		id: value.id,
		mime: value.mime,
		byteLength: Number(value.byteLength),
	};
};

const assertMinimumLength = (bytes: Uint8Array, minimumLength: number, label: string) => {
	if (bytes.byteLength < minimumLength) {
		throw new Error(`Invalid Arkini pack: truncated ${label}.`);
	}
};

const assertMagic = (bytes: Uint8Array) => {
	for (const [index, byte] of arkiniPackMagic.entries()) {
		if (bytes[index] !== byte) {
			throw new Error("Invalid Arkini pack: magic header mismatch.");
		}
	}
};
