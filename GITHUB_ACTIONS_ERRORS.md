# GitHub Actions Errors Guide

When you push without GitHub secrets configured, expect these errors **in this order**:

## ✅ Expected to PASS (No secrets needed)

### CI Pipeline (`ci.yml`)

1. **Lint & Security Analysis** ✅
   - ESLint check
   - TypeScript compilation
   - npm audit
   - Trivy filesystem scan
   - SBOM generation
   - Status: **SHOULD PASS**

2. **Unit Tests** ✅
   - Jest runs with mocked services (postgres/qdrant)
   - Coverage check (≥ 70%)
   - Status: **SHOULD PASS** (or fail if coverage < 70%)

3. **Build Docker Image** ✅
   - Build succeeds locally
   - Push to GHCR fails (but build artifact is created)
   - Status: **EXPECTED FAILURE** (auth needed, non-blocking)

4. **E2E Smoke Tests** ✅
   - Non-critical (continues on failure)
   - Status: **CAN FAIL** (expected in CI environment)

---

## ❌ Expected to FAIL (Need secrets)

### CD Pipeline (`cd.yml`)

**All jobs will fail immediately** because CD only triggers on:
- Push to `main` (you're on `feat/model-implementation`)
- Tags `v*` (haven't created yet)

So CD won't even run until you merge to main.

---

## 🎯 What to Fix NOW (Before GitHub Secrets)

Focus on these **local errors** when pushing:

### 1. **Coverage < 70%?**
If test job fails with:
```
Coverage below 70% threshold!
```

**Fix:**
```bash
npm run test:unit -- --coverage
# Check which files need coverage
cat coverage/coverage-summary.json
# Add tests for uncovered branches
```

### 2. **Build fails?**
If Docker build fails:
```
ERROR: failed to solve with frontend dockerfile.v0
```

**Fix:**
```bash
# Rebuild locally to debug
docker build -t test .

# Check for missing files, bad syntax
npm run build  # TypeScript compilation check
```

### 3. **npm audit finds HIGH vulnerabilities?**
If `npm audit` fails:
```
Found X high severity vulnerabilities
```

**Fix:**
```bash
npm audit
npm audit fix --force  # Only if safe
# Or update package.json versions manually
```

### 4. **TypeScript errors?**
If tsc fails:
```
src/file.ts:10:5 - error TS1234: ...
```

**Fix:**
```bash
npm run build
# Review and fix errors shown
```

---

## 📌 Typical First Push Output

```
✅ Lint & Security Analysis
   ├─ ESLint: No issues
   ├─ TypeScript: No issues
   ├─ npm audit: Warnings OK
   ├─ Trivy FS scan: Found 0 critical
   └─ SBOM generated: sbom.json

✅ Unit Tests
   ├─ Tests passed: 12 passed
   ├─ Coverage: 75% ✓ (above 70%)
   └─ Codecov upload: SKIPPED (no token)

⚠️  Build Docker Image
   ├─ Build: SUCCESS (created locally)
   ├─ Push to GHCR: FAILED (authentication required)
   └─ Trivy image scan: SKIPPED (image not pushed)

⚠️  E2E Smoke Tests
   ├─ Service start: SUCCESS
   ├─ Health check: SUCCESS
   └─ Smoke tests: SKIPPED (non-critical)

---

Result: 2/4 jobs passed, 2 skipped (expected)
```

---

## 🚨 Errors to NOT Ignore

| Error | Action |
|-------|--------|
| `npm ERR! ERR! 403 Forbidden` (audit) | Update dependencies |
| `error TS2339: Property 'X' does not exist` | Fix TypeScript |
| `failed to solve` (Docker build) | Check Dockerfile syntax |
| `Coverage ... is below 70%` | Add tests |
| `ReferenceError: jest is not defined` (in tests) | Check test setup |

---

## 🔧 First-Time Setup: Step by Step

### 1. **Push to feature branch** (triggers CI only)
```bash
git add .
git commit -m "feat: add CI/CD pipelines and K8s deployment"
git push origin feat/model-implementation
```

### 2. **Watch GitHub Actions**
- Go to repo → Actions tab
- Click the workflow run
- Expand each job to see output

### 3. **Fix any local errors** (coverage, TypeScript, Docker)
```bash
npm run test:unit -- --coverage  # If coverage fails
npm run build                      # If TypeScript fails
docker build -t test .            # If Docker fails
```

### 4. **Re-push fixes**
```bash
git add .
git commit -m "fix: improve test coverage to 75%"
git push origin feat/model-implementation
```

### 5. **Once CI passes, merge to main**
```bash
git checkout main
git pull origin main
git merge feat/model-implementation
git push origin main
```

### 6. **CD pipeline runs automatically** (to Dev + Staging)
- Fails on Kubernetes secrets (expected)
- You'll set those up next

### 7. **Create version tag** (for production)
```bash
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

### 8. **Set up GitHub Secrets** (after first push analysis)
- See `DEVOPS_GUIDE.md` Secrets Management section
- Configure K8s kubeconfigs
- Configure Slack webhooks
- Re-run CD pipeline

---

## 📋 Checklist for First Push

- [ ] Run `npm run test:unit -- --coverage` locally → coverage ≥ 70%?
- [ ] Run `npm run build` → no TypeScript errors?
- [ ] Run `npm audit` → no HIGH severity vulnerabilities?
- [ ] Run `docker build -t test .` → builds successfully?
- [ ] Commit all changes
- [ ] Push to `feat/model-implementation` branch
- [ ] Check Actions tab for CI results
- [ ] Fix any failing jobs (if needed)
- [ ] Merge to `main` once CI passes
- [ ] Then focus on CD pipeline (Kubernetes secrets)

---

## 🎬 What Happens When You Push

### Branch: `feat/model-implementation`
```
✓ CI pipeline runs (lint, tests, build)
✗ CD pipeline skipped (not main branch)
```

### Branch: `main` (after merge)
```
✓ CI pipeline runs
✓ CD pipeline runs → deploys to Dev + Staging
✗ K8s secrets error (expected, fix next)
```

### Tag: `v*` (e.g., `v1.0.0`)
```
✓ CI pipeline runs
✓ CD pipeline runs → deploys to Prod
✗ K8s secrets error (expected, fix next)
```

---

## 🆘 If CI Fails

1. **Check the specific job output**
2. **Look for one of these patterns:**
   - `npm ERR!` → dependency issue
   - `error TS` → TypeScript issue
   - `failed to solve` → Docker issue
   - `Coverage` → test coverage issue
   - `Unexpected token` → syntax error

3. **Run the same command locally to debug:**
   ```bash
   npm audit                          # For SCA failures
   npm run test:unit -- --coverage    # For coverage failures
   npm run build                      # For TypeScript failures
   docker build -t test .             # For Docker failures
   ```

4. **Fix locally, commit, push again**

---

## ✨ Once GitHub Secrets are Set Up

After you configure secrets (phase 2), focus on:
1. **K8s cluster connectivity** (kubeconfig)
2. **Helm chart syntax** (if any deploy steps fail)
3. **Pod startup** (health check timeouts)
4. **Application logs** (service not starting in K8s)

See `DEVOPS_GUIDE.md` for detailed troubleshooting.
