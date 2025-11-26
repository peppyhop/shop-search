# Release Guide

This document explains the automated versioning and publishing setup for the `shop-search` library.

## 🚀 Automated Release Process

This project uses **semantic-release** for automated versioning and publishing based on conventional commits, with npm Trusted Publishing and provenance enabled.

### How It Works

1. **Commit Messages**: Use conventional commit format to trigger releases
2. **Automated Versioning**: Semantic-release automatically determines version bumps
3. **Changelog Generation**: Automatically generates and updates CHANGELOG.md
4. **NPM Publishing**: Automatically publishes to npm registry
5. **GitHub Releases**: Creates GitHub releases with release notes

## 📝 Commit Message Format

Use the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Release Types

| Commit Type | Release Type | Example |
|-------------|--------------|---------|
| `feat:` | Minor (0.x.0) | `feat: add product filtering by price range` |
| `fix:` | Patch (0.0.x) | `fix: handle null product variants correctly` |
| `perf:` | Patch (0.0.x) | `perf: optimize product data transformation` |
| `refactor:` | Patch (0.0.x) | `refactor: improve error handling structure` |
| `BREAKING CHANGE:` | Major (x.0.0) | `feat!: remove deprecated getProducts method` |

### Non-Release Types

These commit types **do not** trigger releases:
- `docs:` - Documentation changes
- `style:` - Code style changes
- `test:` - Test additions/modifications
- `chore:` - Build process or auxiliary tool changes

## 🔧 Setup Requirements

### 1. Node.js Version

- Release workflow runs on Node.js `22.14.0` to satisfy semantic-release requirements (`^22.14.0` or `>= 24.10.0`).
- Local development can use the version in `.nvmrc`.

### 2. GitHub Token

- The `GITHUB_TOKEN` is automatically provided by GitHub Actions.
- Permissions are configured in the workflow for publishing and release notes.

### 3. npm Trusted Publishing

This repository uses npm Trusted Publishing with provenance. No `NPM_TOKEN` is required.

Steps to configure in npm:
- Go to npm package settings → Access → Trusted publishers
- Add the GitHub repository as a trusted publisher
- Set environment name to `npm-publish` (matches the workflow environment)
- Enable “Require provenance” for publishes

Workflow configuration highlights:
- Grants `id-token: write` to obtain an OIDC token for npm
- Sets `NPM_CONFIG_PROVENANCE=true` during publish
- Uses the `npm-publish` environment with protections as needed

## 🌟 Workflow Overview

### CI Workflow (`.github/workflows/ci.yml`)
- Runs on pull requests and feature branches
- Tests across Node.js versions 18, 20, 22
- Builds the project to ensure no build errors

### Release Workflow (`.github/workflows/release.yml`)
- Runs on pushes to `main` and `beta` branches
- Tests and builds the project
- Runs semantic-release for automated publishing
- Uses Node.js `22.14.0`
- Publishes to npm via Trusted Publishing (OIDC) with provenance

## 📦 Release Branches

- **`main`**: Production releases (latest tag)
- **`beta`**: Pre-release versions (beta tag)

## 🎯 Example Workflow

1. **Feature Development**:
   ```bash
   git checkout -b feature/new-search-filters
   # Make changes
   git commit -m "feat: add advanced product search filters"
   git push origin feature/new-search-filters
   ```

2. **Create Pull Request**: CI workflow runs tests

3. **Merge to Main**:
   ```bash
   git checkout main
   git merge feature/new-search-filters
   git push origin main
   ```

4. **Automatic Release**: Release workflow triggers and:
   - Bumps version to next minor (e.g., 2.2.0 → 2.3.0)
   - Updates CHANGELOG.md
   - Creates GitHub release
   - Publishes to npm

## 🔍 Monitoring Releases

- **GitHub Actions**: Check workflow runs in the Actions tab
- **NPM**: Verify publication at https://www.npmjs.com/package/shop-search
- **GitHub Releases**: View releases in the repository's Releases section

## 🛠️ Manual Release (Emergency)

If needed, you can trigger a manual release locally for diagnostics:

```bash
npx semantic-release --dry-run
```

Publishing to npm requires the GitHub Actions workflow with OIDC. Manual local publishes should not be used; rely on Trusted Publishing via CI.

## 📋 Troubleshooting

### Common Issues

1. **Release not triggered**: Check commit message format
2. **npm publish blocked**: Verify Trusted Publisher setup and environment name `npm-publish`
3. **Provenance required**: Ensure `NPM_CONFIG_PROVENANCE=true` and npm package requires provenance
4. **Tests fail**: Ensure all tests pass before merging to main

### Dependency Vulnerabilities and Overrides

- If CI or scanners flag vulnerable transitive dependencies (e.g., `glob@10.3.7–11.0.3` CLI vulnerability), use npm `overrides` to pin a safe version.
- Example:
  ```json
  {
    "overrides": {
      "glob": "11.1.0"
    }
  }
  ```
- After updating `package.json`, run `npm install` to update `package-lock.json`.
- Verify the build and tests still pass.
- Avoid manual changes to `CHANGELOG.md`; semantic-release manages it automatically.

### Debug Commands

```bash
# Test the build locally
npm run build

# Run tests with coverage
npm run test:ci

# Dry run semantic-release (doesn't publish)
npx semantic-release --dry-run
```

## 🔄 Version History

All releases are automatically documented in:
- [CHANGELOG.md](./CHANGELOG.md)
- [GitHub Releases](../../releases)
- [NPM Package History](https://www.npmjs.com/package/shop-search?activeTab=versions)

## ✅ Pre-release Docs Checklist

Before cutting a release, verify documentation reflects the latest changes:
 - README includes Utilities section for `sanitizeDomain` and `safeParseDate`
 - Product date handling notes are present (`createdAt`/`updatedAt` safe parsing, `publishedAt` nullability)
 - CHANGELOG latest section summarizes added utilities and date sanitization changes
 - CONTRIBUTING documents using utilities and URL normalization guidance
 - ARCHITECTURE describes utility usage and date handling policy
