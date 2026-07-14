# Pull Request

Branch flow for this repository:

- Feature branches must be created from `develop`.
- Open PRs to `develop` first.
- Only `develop` is allowed to open PRs into `main`.

## Summary

Describe what this PR changes and why.

## Related Issue

Link issue(s) if available.

- Closes #

## Type Of Change

- [ ] feat: new feature
- [ ] fix: bug fix
- [ ] docs: documentation only
- [ ] refactor: no behavior change
- [ ] test: test updates
- [ ] chore: maintenance

## Scope Checklist

- [ ] Changes are focused and minimal.
- [ ] No secrets or sensitive values were added.
- [ ] Team-specific hardcoded values were avoided.
- [ ] `packageManager` and workflow pnpm versions are aligned.
- [ ] Workflow Node version is compatible with `engines.node`.
- [ ] Docs updated when behavior or deployment flow changed.

## Documentation Checklist

- [ ] `README.md` reflects current setup, env vars, routes, and deployment behavior.
- [ ] `README.vi.md` is synced for major setup/deploy/runtime changes.

## Testing

List commands you ran and results.

```bash
pnpm run test:coverage
pnpm run build
pnpm tsc -p tsconfig.spec.json --noEmit
```

## Breaking Changes

- [ ] No breaking changes.
- [ ] Breaking changes included and documented.

If breaking changes exist, describe migration steps.

## Deployment Notes

- [ ] No deployment impact.
- [ ] Deployment impact described below.

Describe env vars, route changes, or Vercel behavior changes.

## Screenshots / Logs (Optional)

Add screenshots, curl output, or logs if helpful.
