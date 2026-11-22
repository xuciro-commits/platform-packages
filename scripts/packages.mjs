#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const packagesDir = join(root, "packages");

function manifest(dir) {
  const fields = {};
  for (const line of readFileSync(join(dir, "package.yaml"), "utf8").split("\n")) {
    const match = line.match(/^(id|version|artifact):\s*"?([^"\s]+)"?\s*$/);
    if (match) fields[match[1]] = match[2];
  }
  if (!fields.id || !fields.version) throw new Error(`${dir}/package.yaml: id and version are required`);
  return fields;
}

function packages(only) {
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(packagesDir, entry.name, "package.yaml")))
    .map((entry) => ({ dir: join(packagesDir, entry.name), name: entry.name, ...manifest(join(packagesDir, entry.name)) }))
    .filter((p) => !only.length || only.includes(p.name) || only.includes(p.id));
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...options });
}

function compareVersions(a, b) {
  const parse = (v) => v.split(/[.+-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === y[i]) continue;
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    return typeof x[i] === "number" && typeof y[i] === "number" ? x[i] - y[i] : String(x[i]).localeCompare(String(y[i]));
  }
  return 0;
}

function latestTag(id) {
  const tags = run("git", ["tag", "--list", `${id}/v*`], { cwd: root }).split("\n").filter(Boolean);
  return tags.sort((a, b) => compareVersions(b.slice(id.length + 2), a.slice(id.length + 2)))[0];
}

const problems = [];
const commands = {
  layout(list) {
    for (const p of list) {
      for (const file of ["README.md", "LICENSE", "CHANGELOG.md"]) {
        if (!existsSync(join(p.dir, file))) problems.push(`${p.name}: ${file} is missing`);
      }
      if (!p.artifact) problems.push(`${p.name}: package.yaml needs artifact, the file name of its release asset`);
      const changelog = existsSync(join(p.dir, "CHANGELOG.md")) ? readFileSync(join(p.dir, "CHANGELOG.md"), "utf8") : "";
      if (!new RegExp(`^## ${p.version.replaceAll(".", "\\.")}(\\s|$)`, "m").test(changelog)) {
        problems.push(`${p.name}: CHANGELOG.md has no "## ${p.version}" section`);
      }
      const tag = latestTag(p.id);
      if (tag && compareVersions(p.version, tag.slice(p.id.length + 2)) < 0) {
        problems.push(`${p.name}: version ${p.version} is below the released ${tag}`);
      }
    }
  },
  download(list) {
    for (const p of list) {
      const tag = latestTag(p.id);
      if (!tag) {
        console.log(`${p.id}: not released yet`);
        continue;
      }
      run("gh", ["release", "download", tag, "--pattern", p.artifact, "--dir", packagesDir, "--clobber"], { cwd: root });
      const sums = run("gh", ["release", "view", tag, "--json", "assets", "--jq", ".assets[].name"], { cwd: root });
      if (sums.split("\n").includes("SHA256SUMS")) {
        const listed = run("gh", ["release", "download", tag, "--pattern", "SHA256SUMS", "--output", "-"], { cwd: root });
        const want = listed.split("\n").find((line) => line.endsWith(`  ${p.artifact}`))?.split(" ")[0];
        const got = createHash("sha256").update(readFileSync(join(packagesDir, p.artifact))).digest("hex");
        if (want !== got) problems.push(`${tag}: ${p.artifact} does not match SHA256SUMS`);
      }
      console.log(`${p.id}: downloaded ${tag}`);
    }
  },
  reproducible(list) {
    const scratch = mkdtempSync(join(tmpdir(), "packages-"));
    for (const p of list) {
      const digests = ["a", "b"].map((n) => {
        const out = join(scratch, `${p.name}.${n}.json`);
        run(pkg, ["build", "-o", out, p.dir]);
        return createHash("sha256").update(readFileSync(out)).digest("hex");
      });
      if (digests[0] !== digests[1]) problems.push(`${p.name}: two builds of the same source differ`);
      else console.log(`${p.name}: reproducible sha256:${digests[0]}`);
    }
  },
};

const [command, ...rest] = process.argv.slice(2);
const only = rest.filter((arg) => !arg.startsWith("--pkg="));
const pkg = rest.find((arg) => arg.startsWith("--pkg="))?.slice(6) || process.env.PKG || "pkg";
if (!commands[command]) {
  console.error("usage: node scripts/packages.mjs layout|download|reproducible [--pkg=path] [package ...]");
  process.exit(2);
}
commands[command](packages(only));
for (const problem of problems) console.error(problem);
process.exit(problems.length ? 1 : 0);
