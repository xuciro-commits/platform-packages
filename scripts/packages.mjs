#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const packagesDir = join(root, "packages");
const catalogFile = join(root, "catalog.json");
const catalogTitle = "Platform packages";
const releaseURL = "https://github.com/xuciro-commits/platform-packages/releases/download/{id}/v{version}/";

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

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function pinsRelease() {
  return /^v\d/.test(readFileSync(join(root, "platform.lock"), "utf8").trim());
}

function released(entry) {
  return run("git", ["tag", "--list", `${entry.id}/v${entry.version}`], { cwd: root }).trim() !== "";
}

function writeCatalog(list, out) {
  const previous = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, "utf8")).packages : [];
  run(pkg, ["catalog", "-o", out, "-title", catalogTitle, "-url", releaseURL, ...list.map((p) => p.dir)]);
  const doc = JSON.parse(readFileSync(out, "utf8"));
  const merged = new Map();
  const add = (entry) => {
    const key = `${entry.id}@${entry.version}`;
    if (!merged.has(key)) merged.set(key, entry);
  };
  for (const entry of doc.packages) {
    const zh = entry.locales?.["zh-CN"];
    if (!zh?.title || (entry.description && !zh?.description)) {
      problems.push(`${entry.id}@${entry.version}: catalog entry is missing zh-CN title or description in locales`);
    }
    if (pinsRelease() || released(entry)) add(entry);
  }
  for (const item of previous) {
    if (released(item)) add(item);
  }
  doc.packages = [...merged.values()].sort((a, b) =>
    a.id !== b.id ? a.id.localeCompare(b.id) : compareVersions(b.version, a.version),
  );
  writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
}

function sameJSON(a, b) {
  return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
}

function changelogSection(p) {
  const text = readFileSync(join(p.dir, "CHANGELOG.md"), "utf8");
  const start = text.search(new RegExp(`^## ${p.version.replaceAll(".", "\\.")}(\\s|$)`, "m"));
  if (start < 0) return "";
  const rest = text.slice(start).split("\n").slice(1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
}

function latestTag(id) {
  const tags = run("git", ["tag", "--list", `${id}/v*`], { cwd: root }).split("\n").filter(Boolean);
  return tags.sort((a, b) => compareVersions(b.slice(id.length + 2), a.slice(id.length + 2)))[0];
}

const problems = [];
const commands = {
  layout(list) {
    for (const p of list) {
      for (const file of ["README.md", "LICENSE", "CHANGELOG.md", "locales/zh-CN.yaml"]) {
        if (!existsSync(join(p.dir, file))) problems.push(`${p.name}: ${file} is missing`);
      }
      const zhLocale = join(p.dir, "locales/zh-CN.yaml");
      if (existsSync(zhLocale) && readFileSync(zhLocale, "utf8").trim().length === 0) {
        problems.push(`${p.name}: locales/zh-CN.yaml is empty`);
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
        const got = sha256(join(packagesDir, p.artifact));
        if (want !== got) problems.push(`${tag}: ${p.artifact} does not match SHA256SUMS`);
      }
      console.log(`${p.id}: downloaded ${tag}`);
    }
  },
  catalog(list) {
    if (!flags.check) {
      writeCatalog(list, catalogFile);
      console.log(`catalog.json: ${list.length} packages`);
      return;
    }
    const fresh = join(mkdtempSync(join(tmpdir(), "catalog-")), "catalog.json");
    writeCatalog(list, fresh);
    if (!existsSync(catalogFile) || !sameJSON(readFileSync(fresh, "utf8"), readFileSync(catalogFile, "utf8"))) {
      problems.push("catalog.json is out of date; run node scripts/packages.mjs catalog and commit it");
    } else console.log(`catalog.json: up to date (${list.length} packages)`);
  },
  release(list) {
    const out = resolve(flags.out || "dist");
    const listed = JSON.parse(readFileSync(catalogFile, "utf8")).packages;
    for (const p of list) {
      const tag = `${p.id}/v${p.version}`;
      if (run("git", ["tag", "--list", tag], { cwd: root }).trim()) continue;
      const entry = listed.find((item) => item.id === p.id && item.version === p.version);
      if (!entry) {
        problems.push(`${tag}: catalog.json has no entry for this version`);
        continue;
      }
      const dir = join(out, p.name);
      mkdirSync(dir, { recursive: true });
      run(pkg, ["build", "-o", join(dir, p.artifact), p.dir]);
      const sum = sha256(join(dir, p.artifact));
      if (`sha256:${sum}` !== entry.sha256) {
        problems.push(`${tag}: the built artifact is sha256:${sum}, catalog.json lists ${entry.sha256}`);
        continue;
      }
      writeFileSync(join(dir, "SHA256SUMS"), `${sum}  ${p.artifact}\n`);
      writeFileSync(join(dir, "NOTES.md"), `${changelogSection(p)}\n\nsha256:${sum}\n`);
      console.log(`${tag}\t${p.name}`);
    }
  },
  reproducible(list) {
    const scratch = mkdtempSync(join(tmpdir(), "packages-"));
    for (const p of list) {
      const digests = ["a", "b"].map((n) => {
        const out = join(scratch, `${p.name}.${n}.json`);
        run(pkg, ["build", "-o", out, p.dir]);
        return sha256(out);
      });
      if (digests[0] !== digests[1]) problems.push(`${p.name}: two builds of the same source differ`);
      else console.log(`${p.name}: reproducible sha256:${digests[0]}`);
    }
  },
};

const [command, ...rest] = process.argv.slice(2);
const only = rest.filter((arg) => !arg.startsWith("--"));
const flags = Object.fromEntries(rest.filter((arg) => arg.startsWith("--")).map((arg) => {
  const [key, value] = arg.slice(2).split("=");
  return [key, value ?? true];
}));
const pkg = flags.pkg || process.env.PKG || "pkg";
if (!commands[command]) {
  console.error("usage: node scripts/packages.mjs layout|download|catalog [--check]|release [--out=dist]|reproducible [--pkg=path] [package ...]");
  process.exit(2);
}
commands[command](packages(only));
for (const problem of problems) console.error(problem);
process.exit(problems.length ? 1 : 0);
