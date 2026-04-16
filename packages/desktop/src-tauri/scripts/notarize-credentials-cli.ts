#!/usr/bin/env bun
// notarize-credentials-cli.ts — thin bun entrypoint. Reads process.env, calls
// the pure validator, prints the formatted report, exits with the right code.

import { formatCredentialsReport, validateCredentials } from "./notarize-credentials-lib"

const vars = {
  CODA_APPLE_ID: process.env.CODA_APPLE_ID,
  CODA_APPLE_TEAM_ID: process.env.CODA_APPLE_TEAM_ID,
  CODA_APPLE_APP_PASSWORD: process.env.CODA_APPLE_APP_PASSWORD,
}

const result = validateCredentials(vars)
console.log(formatCredentialsReport({ ...result, vars }))
process.exit(result.exitCode)
