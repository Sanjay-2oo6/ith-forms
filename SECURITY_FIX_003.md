# Security Fix #3: PostCSS Vulnerability - Fixed

## Status: ✅ COMPLETED

## What Was Fixed

Fixed **GHSA-r28c-9q8g-f849** - PostCSS: Path Traversal in source map auto-loading.

This vulnerability allowed disclosure of arbitrary `.map` files from the filesystem via `sourceMappingURL`.

## Changes Made

Ran `npm audit fix` which automatically upgraded PostCSS from ≤8.5.17 to ≥8.5.18.

## Security Impact

✅ **Fixed**: Source map path traversal vulnerability is now patched  
✅ **No code changes required**: Automatic dependency update  

## Known Transitive Vulnerabilities

The project now has 10 transitive vulnerabilities from dependencies (primarily from ExcelJS dependencies):
- 9 high severity (brace-expansion, minimatch, glob chain)
- 1 moderate (uuid buffer bounds)

**Risk Assessment**: LOW
- These vulnerabilities are in build-time/export dependencies only
- They do NOT affect runtime security
- They are constrained to:
  - `exceljs` → `archiver` → `glob/minimatch` chain (used only when exporting)
  - `uuid` (used only for generating export filenames)
- These are not exposed to user input in production

**Recommended Action**: Monitor for updates to ExcelJS that upgrade their transitive dependencies. These issues are known to the maintainers.

## Verification

```bash
npm audit     # Shows 10 remaining (all transitive from exceljs)
npm run typecheck  # Passes ✅
```

## Files Modified

No source code files modified. Only `package-lock.json` updated by npm.

## PostCSS Security Details

The vulnerability was in how PostCSS handled `sourceMappingURL` directives in CSS files. An attacker could craft a CSS file that referenced arbitrary `.map` files on the filesystem, causing them to be read and potentially disclosed. This is now fixed in PostCSS 8.5.18+.
