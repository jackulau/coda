#!/usr/bin/env bun
// build-mac-resolve.ts — called by build-mac.sh to convert the CLI context
// (env override, raw `security find-identity` output, arch) into a single
// "identity|team_id|target" line the shell can split on.

import { pickSigningIdentity, resolveBuildTarget } from "./build-mac-lib"

const envOverride = process.env.CODA_APPLE_DEV_ID ?? ""
const keychainOutput = process.env.KEYCHAIN_OUTPUT ?? ""
const arch = process.env.CODA_MAC_ARCH

const picked = pickSigningIdentity({ envOverride, keychainOutput })
const target = resolveBuildTarget(arch)

const identity = picked.identity ?? ""
const teamId = picked.teamId ?? ""

process.stdout.write(`${identity}|${teamId}|${target}\n`)
process.exit(identity ? 0 : 1)
