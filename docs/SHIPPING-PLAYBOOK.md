# Shipping playbook

A reusable, opinionated checklist for taking a small tool — a CLI, a library, or
an **MCP server** — from "works on my machine" to a repository a reviewer (human
or AI) would rate top-tier. It is deliberately generic: it captures the _process_
and the _standards_, not a specific feature set, so it can seed a brand-new
project from an empty folder.

Use it as a menu, not a mandate. Skip what does not apply; never skip the
non-negotiables in §0.

---

## 0. Non-negotiables

These are the things that, if missing, drop a repo below "top-tier" regardless of
how good the code is.

- **A license.** Pick one (MIT for permissive) and put it in `LICENSE` with the
  correct copyright line. GitHub must detect it.
- **A README that sells and explains** in the first screen: what it is, who it is
  for, why it exists, and how to install it in one command.
- **Tests that actually run in CI**, with a coverage floor that CI enforces.
- **A green CI pipeline on every push and PR**, with the default branch protected.
- **An honest security posture**: no shell-string injection, no secrets in the
  repo, dependencies audited.
- **A clean, atomic, English git history** using [Conventional Commits](https://www.conventionalcommits.org/),
  with no "noise" commits and no co-author trailers you did not intend.

## 1. Repository skeleton

Every top-tier repo has roughly this surface. Create the missing pieces early —
they are cheap and signal seriousness.

```
.
├── README.md                 # the shopfront (see §8)
├── LICENSE                   # detected by GitHub
├── CHANGELOG.md              # Keep a Changelog format, SemVer
├── CONTRIBUTING.md           # dev setup, commit rules, how a PR gets merged
├── CODE_OF_CONDUCT.md        # Contributor Covenant
├── SECURITY.md               # how to report, invariants, supply-chain notes
├── CLAUDE.md / AGENTS.md     # repo guide for AI agents (mirrors human docs)
├── .editorconfig             # baseline whitespace rules
├── .nvmrc                    # pin the toolchain version
├── .gitignore
├── .prettierrc.json          # or your formatter config
├── docs/                     # usage guide, ADRs, this playbook
│   ├── usage.md
│   └── adr/                  # Architecture Decision Records, numbered
├── src/                      # source
├── test/                     # tests, mirroring src/
├── scripts/                  # build/release helpers
└── .github/
    ├── workflows/            # ci.yml, release.yml
    ├── ISSUE_TEMPLATE/       # bug report, feature request
    ├── PULL_REQUEST_TEMPLATE.md
    ├── dependabot.yml
    └── FUNDING.yml           # if you accept sponsorship
```

## 2. Code & type quality

- **One language discipline, strictly applied.** For TypeScript: ESM, `strict`
  mode on, no `any` escape hatches, `noEmit` typecheck as a separate CI step.
- **A formatter, enforced.** Configure it, run it on the whole tree, and add a
  `format:check` script that CI runs. Formatting debates end here.
- **Small, single-purpose modules.** A reviewer should understand each file in
  one read. Isolate the side-effecting boundary (filesystem, network, subprocess,
  OS APIs) into its own module so the rest stays pure and testable.

## 3. Testing strategy

- **Mock the platform boundary.** Put every OS/process/network call behind one
  thin module, then mock that module in tests. The suite becomes deterministic and
  **cross-platform** — it runs the same on a contributor's Linux box and in CI,
  even for an OS-specific tool.
- **Test the real logic, not the mocks.** Cover argument parsing, dispatch,
  error handling, and the success/failure result shapes. Drive error paths
  (a subprocess that throws, a malformed payload) explicitly.
- **Enforce a coverage floor in CI.** Set thresholds (statements/branches/
  functions/lines) in the test config and fail the build below them. Exclude only
  trivial shims (e.g. a one-line bin entrypoint) and document why.
- **Leave a door for integration tests.** The real native/networked path is
  exercised manually; invite _guarded_ integration tests that skip when the
  platform or dependency is absent.

## 4. Security invariants

- **Never build a shell command from dynamic input.** Spawn binaries with
  `execFile`/`spawn` and pass dynamic values as separate `args`. If you must run a
  scripting host, pass values as arguments the host reads at runtime — never
  interpolate them into the script body.
- **No secrets in git.** Use CI secrets and OIDC. Add a secret-scanning step
  (e.g. `gitleaks`) if the platform's native scanning is unavailable.
- **Audit dependencies.** Run `npm audit --audit-level=high` in CI. It reads the
  lockfile directly — no install needed. Keep the dependency tree small.
- **Pin GitHub Actions to a commit SHA**, not a moving tag, and let Dependabot
  bump them.

## 5. CI/CD

- **Two jobs minimum:** `build & test` (format check → typecheck → tests with
  coverage → build) and `dependency audit`.
- **Run the platform-specific job on the matching runner** (e.g. macOS for a
  macOS tool) so the real toolchain exists; keep the audit job on cheap Linux.
- **SHA-pin every action.** Add a `# vX` comment for readability.
- **Protect the default branch:** require the CI status checks to pass; disallow
  force-pushes and deletions. Decide whether to also require a review.
- **Enable Dependabot** for the package ecosystem and for GitHub Actions.

## 6. Git history & the PR workflow

- **Atomic Conventional Commits.** One logical change per commit; imperative
  English summary; `type(scope): summary`. Group related file changes; split
  unrelated ones.
- **Branch per concern.** Never push features straight to a protected `main`.
  Cut `feat/…`, `fix/…`, `docs/…`, `ci/…` branches and open a PR — even when you
  are the only maintainer. It is what branch protection expects and what reviewers
  read.
- **Every PR gets a description**: what, why, and a test plan with checkboxes.
- **Merge style is a decision, not a default.** Merge-commit preserves the
  reviewed history; enable auto-delete of merged branches.
- **No co-author trailers you did not intend.** If a policy forbids a specific
  trailer, make sure it never lands — check `git log` before pushing.
- **If history must be rebuilt**, do it on an orphan branch, verify the working
  tree is byte-identical to a backup (`git diff backup/pre-rewrite` is empty), and
  keep the backup branch until everything is confirmed green.

## 7. Distribution (npm / `npx`)

This is the recipe that makes a Node tool installable the way users expect.

- **`bin` + shebang.** Map the command name to the compiled entrypoint, and start
  that entrypoint with `#!/usr/bin/env node`. This is what makes `npx <name>` work.
- **`files` allowlist.** Ship only what runs: the built output, runtime assets,
  any script invoked by a lifecycle hook, the README and LICENSE. Verify with
  `npm pack --dry-run` that nothing from `src/`/`test/` leaks in and nothing needed
  is missing.
- **`prepare: build`.** Lets `npm install <git-url>` build on the fly, so the
  package is installable from a Git ref even before it is published.
- **`prepublishOnly: typecheck && test`.** A last gate so a broken build can never
  be published.
- **Do NOT use `"os"`/`"cpu"` fields to express "platform-only".** They make
  `npm install` fail hard with `EBADPLATFORM` off-platform — which breaks
  cross-platform CI, lockfile audits, and mixed monorepos. Instead, install
  everywhere and run a **`postinstall` notice** that warns on the wrong platform
  and **always exits 0**. Document the real requirement in the README.
- **Publish from CI on a version tag, with provenance.** A `release.yml` triggered
  by `v*` tags that builds, tests, and runs `npm publish --provenance --access
public` (needs `permissions: id-token: write` for Sigstore OIDC). Add a
  `concurrency` guard so two tags can't race.
- **Lead the README with `npx -y <name>`** — no clone, no build.

> Scoped (`@user/name`) vs unscoped is a branding call; scoped needs
> `--access public` (and `publishConfig.access: public`) to publish for free.

## 8. Discoverability & promotion

- **A demo is worth more than prose.** A short GIF or screenshot at the top of the
  README showing the tool _working_ is the single highest-leverage asset — and the
  one most comparable projects are missing.
- **Dynamic badges:** CI status, package version, downloads, license. They signal
  a maintained, real project at a glance.
- **List in the relevant ecosystem registry.** For an MCP server, add a
  `server.json` and submit to the official registry; optionally ship a desktop
  extension manifest for one-click install.
- **Submit to curated "awesome" lists** in the correct category, in the list's
  exact entry format, alphabetically. Read each list's `CONTRIBUTING` first.
- **A one-page site (optional).** A static landing page on free hosting (GitHub
  Pages): hero (problem → one-line solution) → demo → copy-paste install → feature
  bullets → footer with repo/sponsor links. Keep it static and minimal.
- **A support section:** a star ask, a sponsor link, and an invitation to report
  edge cases.

## 9. Governance on GitHub

- **Labels** for type, priority, status, and area.
- **Milestones** for phases and/or releases.
- **A project board** to make the roadmap visible.
- **Issue templates** (bug report, feature request) and a **PR template**.
- **A roadmap in the README** so contributors see where it is going.

## 10. Release process

1. Move `CHANGELOG.md`'s `Unreleased` into a dated, versioned section.
2. Bump the package version; if a code constant mirrors it, keep them in sync and
   assert it with a test.
3. Tag and push (`npm version <level>` + `git push --follow-tags`). The release
   workflow publishes and cuts the GitHub Release with generated notes.
4. Optionally attach artifact checksums (`SHA256SUMS.txt`) to the Release.

## 11. Pre-flight checklist

Before calling a repo "done", confirm:

- [ ] README opens with what/why/one-command install, and shows a demo.
- [ ] `LICENSE` present and detected; copyright correct.
- [ ] `CHANGELOG`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY` present.
- [ ] CI green: format, typecheck, tests (coverage gate), build, audit.
- [ ] Default branch protected; Actions SHA-pinned; Dependabot on.
- [ ] Tests mock the platform boundary and cover error paths.
- [ ] No shell-string injection; no secrets committed.
- [ ] Installable in one command (`npx` / registry), `npm pack --dry-run` clean.
- [ ] Git history atomic, Conventional, English, no stray co-author trailers.
- [ ] Issue/PR templates, labels, milestones, and a visible roadmap exist.
- [ ] Listed in the ecosystem registry and at least one curated list.
