#!/usr/bin/env bash
set -euo pipefail

readonly ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly CACHE_DIR="${ROOT_DIR}/.npm-cache"
readonly WORK_DIR="${CACHE_DIR}/.work"
readonly REGISTRY="https://registry.npmjs.org/"

for command in npm tar shasum; do
	if ! command -v "${command}" >/dev/null 2>&1; then
		echo "Missing required command: ${command}" >&2
		exit 1
	fi
done

if [[ ! -f "${ROOT_DIR}/package.json" || ! -f "${ROOT_DIR}/package-lock.json" ]]; then
	echo "package.json and package-lock.json must exist in ${ROOT_DIR}." >&2
	exit 1
fi

cleanup() {
	rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

mkdir -p "${CACHE_DIR}"
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"
cp "${ROOT_DIR}/package.json" "${ROOT_DIR}/package-lock.json" "${WORK_DIR}/"

npm_ci_linux_x64() {
	(
		cd "${WORK_DIR}"
		# Do not auto-install optional integration peers (for example Redis from Effect platform-node).
		# Offline LLM installs use the same peer policy.
		npm ci \
			--legacy-peer-deps \
			"$@" \
			--registry="${REGISTRY}" \
			--cache="${CACHE_DIR}" \
			--os=linux \
			--cpu=x64 \
			--libc=glibc \
			--ignore-scripts \
			--no-audit \
			--no-fund
	)
}

echo "Building Linux x64 npm cache in ${CACHE_DIR} ..."
npm_ci_linux_x64

echo "Verifying cache with a network-free install ..."
rm -rf "${WORK_DIR}/node_modules"
npm_ci_linux_x64 --offline

cleanup
npm cache verify --cache="${CACHE_DIR}" >/dev/null
rm -rf "${CACHE_DIR}/_logs"
rm -f "${CACHE_DIR}/_update-notifier-last-checked"

readonly LOCK_HASH="$(shasum -a 256 "${ROOT_DIR}/package-lock.json" | awk '{print substr($1, 1, 12)}')"
readonly ARCHIVE="${ROOT_DIR}/arkini-npm-cache-linux-x64-${LOCK_HASH}.tgz"

rm -f "${ARCHIVE}"
tar -C "${ROOT_DIR}" -czf "${ARCHIVE}" .npm-cache

readonly ARCHIVE_HASH="$(shasum -a 256 "${ARCHIVE}" | awk '{print $1}')"

echo
echo "Cache archive ready:"
echo "  ${ARCHIVE}"
echo "  SHA-256: ${ARCHIVE_HASH}"
