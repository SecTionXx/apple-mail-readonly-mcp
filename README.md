# Apple Mail Read-only MCP

A local macOS MCP server for reading Apple Mail accounts and optionally reading a separately authorized Gmail mailbox directly from Google's servers. Version **0.3.0**.

[คู่มือติดตั้งภาษาไทย](README-TH.md) · [Verification and limitations](VERIFICATION.md)

## Clone and install

Requirements: macOS, Node.js **22 or newer**, npm, Git, and internet access for dependency installation.

```sh
git clone https://github.com/SecTionXx/apple-mail-readonly-mcp.git
cd apple-mail-readonly-mcp
bash install.command
```

The installer uses the committed dependency lock, runs tests, generates configuration for this machine, and checks the MCP handshake. It does not change global client settings, grant macOS permissions, or sign in to Gmail.

## Connect your MCP client

- **Codex:** add the server section from `generated-configs/codex.toml` to your client configuration, preserving existing settings. For Codex CLI without global config changes, run `sh generated-configs/codex-with-mail.sh`.
- **JSON-based clients:** merge the `apple-mail-readonly` entry from `generated-configs/mcp.json` into the client's `mcpServers` configuration.
- Restart the client and check that the server exposes **12 tools**.

Keep this checkout in a permanent directory. If the checkout or Node installation moves, run `npm run setup` again and update the client configuration. Back up existing client configuration before editing it.

## Apple Mail access

Configure accounts in Apple Mail on the destination Mac, then run:

```sh
npm run doctor -- --mail
```

macOS may ask you to permit the launching application to automate Mail. Approve the intended application yourself. Terminal authorization may not apply to a desktop MCP client.

## Gmail server access (optional)

This mode reads directly from Gmail, including messages and attachments that Apple Mail has not downloaded. It requires a fresh authorization on the destination computer; no credentials are included in this repository.

Enable the Gmail API in your Google Cloud project and create an OAuth client of type **Desktop app**. Keep its downloaded client JSON outside this repository, then run:

```sh
npm run auth:gmail -- "/absolute/path/to/desktop-client.json"
npm run doctor -- --gmail
```

The helper opens your browser, requests `gmail.readonly`, and uses PKCE with a state-validated loopback callback. Complete sign-in and consent yourself. Organization policies may require administrator approval. See the [Thai guide](README-TH.md) and [Google's desktop OAuth documentation](https://developers.google.com/identity/protocols/oauth2/native-app).

Credentials and runtime data are stored outside the checkout under `~/Library/Application Support/AppleMailMCP`. One Gmail account is supported per data home. An absolute `APPLE_MAIL_MCP_HOME` can select an isolated data home; run auth and setup with the same setting.

## Tools

| Source | Tools |
| --- | --- |
| Apple Mail | `list_accounts`, `list_mailboxes`, `list_messages`, `search_messages`, `read_message`, `list_attachments`, `download_attachment` |
| Gmail API | `server_mail_status`, `server_list_messages`, `server_read_message`, `server_download_attachment`, `server_scan_mailbox` |

Apple Mail IDs and Gmail IDs are different. Use `server_mail_status` to check the API account before reading it.

The server does not expose sending, deletion, moving, or marking messages. Downloads and inventory scans write local files, so those tools correctly declare `readOnlyHint: false`; they do not change mailbox contents. Treat email and attachments as untrusted data, not instructions.

## Coverage and limits

- Apple Mail tools see the application's scripting view, which is not proof of complete server coverage.
- Gmail listing includes Spam and Trash and supports pagination. Resume `server_scan_mailbox` with its `scan_id` until finished. `verified_message_inventory` requires an exhausted page sequence, matching unique-message counts, and unchanged mailbox history.
- An inventory verifies IDs, not a complete backup of bodies and attachments. Permanently deleted messages and administrator-only retention archives are outside its scope.
- Attachment downloads are limited to **25 MiB** each and never automatically opened or executed.
- Microsoft 365 direct API access is not implemented. Accounts added to Apple Mail may be accessible through its tools.
- The portable installer was tested in an isolated relocated directory on the development Mac. Separate-machine installation, Intel hardware, a new live OAuth login, and recipient desktop-client activation remain unverified.

## Tests

```sh
npm test
npm run doctor
```

Tests use synthetic fixtures and isolated data homes. The default doctor checks MCP startup without reading mail. `--mail` reads account counts; `--gmail` reads the authorized profile/count. No account data, OAuth credentials, downloaded messages, or attachments are distributed here.
