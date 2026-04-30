# Security

- Do not commit `.env`, `.env.local`, OAuth tokens, API keys or folder/org IDs.
- This gateway passes credentials only to the child MCP module that needs them.
- `doctor` and `ultimate_status` print variable names and missing status, not secret values.
- Prefer read-only scopes unless you intentionally need write tools.
- Review upstream MCP packages before enabling destructive/write-capable modules in production.
