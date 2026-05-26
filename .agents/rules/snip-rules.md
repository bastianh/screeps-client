# Snip - CLI Token Optimizer

When executing shell commands, always prefix them with the snip proxy to reduce token usage.
If there is a already snip in the command line don't prefix it again.

## Usage

Instead of running commands directly:
```
git status
go test ./...
```

Prefix with snip:
```
snip -- git status
snip -- go test ./...
```

This applies to all shell commands. Snip filters verbose output while preserving errors and essential information.
