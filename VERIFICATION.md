# Portable package verification — 2026-10-29

Release: 0.3.0. This report contains no account identifiers or mailbox data.

Completed on the development Mac:

- Dependency lock generated and `npm ci --ignore-scripts --no-audit --no-fund` succeeded. All resolved package URLs use HTTPS registry.npmjs.org.
- `node --test --test-reporter=spec test/*.test.mjs`: **17 passed, 0 failed**.
- Copied only allowlisted source files to a new directory with spaces in its name, without node_modules or generated settings.
- Ran the complete `bash install.command` in that directory with an isolated APPLE_MAIL_MCP_HOME: installation, 17 tests, generated configuration, and MCP handshake all passed.
- Fresh stdio client exposed 12 tools. Gmail status returned GMAIL_AUTH_NOT_CONFIGURED in the isolated home, proving no fallback to the development computer's existing Gmail authorization.
- `doctor --mail` read account counts from Apple Mail through the relocated server successfully; no account identities or mail contents are included in this release.
- Generated JSON and TOML configuration matched, including the relocated server path and selected data home.
- OAuth PKCE known vector, loopback callback state/method/Host validation, declined consent and timeout passed using synthetic fixtures. Initial Host-header fixture used fetch, which did not send the custom Host; corrected the fixture to use node:http and reran successfully.
- Source allowlist checked for development-machine paths, user identifiers and credential-value patterns. No runtime directories, downloaded files, credentials, client JSON, generated machine-specific config or node_modules are included in the ZIP.

Not tested:

- Installation on a physically separate Mac, Intel Mac or every supported Node version. Runtime testing used Node 26.7.0; package minimum is Node 22.
- New live Google OAuth login or consent using the new setup helper. The recipient must complete this on their own computer and run `doctor --gmail`.
- Codex/Claude Desktop loading on the recipient's machine or its macOS Automation prompt. Client-side activation remains a recipient step.

Existing development-machine Gmail results are not reused as proof that a new account is connected. The previous locally configured MCP project was preserved.
