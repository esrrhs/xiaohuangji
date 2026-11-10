#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const api = require(path.join(root, "gallery", "app.js"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "gallery", "manifest.json"), "utf8"));

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

test("format filter covers the full library", () => {
  const gif = api.filterItems(manifest.items, { format: "gif" }, manifest.vocabulary);
  const png = api.filterItems(manifest.items, { format: "png" }, manifest.vocabulary);
  const jpg = api.filterItems(manifest.items, { format: "jpg" }, manifest.vocabulary);
  assert.strictEqual(gif.length, 472);
  assert.strictEqual(png.length, 293);
  assert.strictEqual(jpg.length, 4);
  assert.strictEqual(gif.length + png.length + jpg.length, manifest.count);
  assert.ok(gif.every((item) => item.format === "gif"));
});

test("untagged filter returns only items without semantic tags", () => {
  const untagged = api.filterItems(manifest.items, { untaggedOnly: true }, manifest.vocabulary);
  assert.strictEqual(untagged.length, manifest.untaggedCount);
  assert.ok(untagged.every((item) => !item.tagged && item.tags.length === 0));
});

test("semantic search finds tagged titles and aliases, not hash-only files", () => {
  const crying = api.filterItems(manifest.items, { query: "哭" }, manifest.vocabulary);
  assert.ok(crying.length >= 1);
  assert.ok(crying.every((item) => item.tagged));
  assert.ok(crying.some((item) => item.tags.includes("哭") || /哭/.test(item.title || "")));

  const alias = api.filterItems(manifest.items, { query: "混吃等死" }, manifest.vocabulary);
  assert.ok(alias.some((item) => item.file.startsWith("0fddf68b")));

  const ok = api.filterItems(manifest.items, { query: "没问题" }, manifest.vocabulary);
  assert.ok(ok.some((item) => item.tags.includes("OJBK")));

  const hash = "ae57242ff3bbab5a836a7c63193648dc.gif";
  const byHash = api.filterItems(manifest.items, { query: hash }, manifest.vocabulary);
  assert.strictEqual(byHash.length, 1);
  assert.strictEqual(byHash[0].file, hash);
});

test("Chinese semantic query does not pretend hash names are meaningful", () => {
  const items = api.filterItems(manifest.items, { query: "开心" }, manifest.vocabulary);
  assert.ok(items.length >= 1);
  items.forEach((item) => {
    const hay = api.itemHaystack(item, manifest.vocabulary);
    assert.ok(hay.includes("开心") || (item.tags || []).includes("开心"));
    assert.ok(item.tagged, "untagged hash-only files must not match 开心");
  });
});

test("拍照 search and aliases hit the photographed sticker", () => {
  const file = "bcaa4c5f7b6912124dba80afa4b4fe46.png";
  for (const q of ["拍照", "摄影", "照相"]) {
    const hits = api.filterItems(manifest.items, { query: q }, manifest.vocabulary);
    assert.ok(hits.some((item) => item.file === file), "missing " + q);
    assert.ok(hits.every((item) => item.tagged));
  }
  const byTag = api.filterItems(manifest.items, { tags: ["拍照"] }, manifest.vocabulary);
  assert.strictEqual(byTag.length, 1);
  assert.strictEqual(byTag[0].file, file);
  assert.strictEqual(byTag[0].title, "手机拍照");
});

test("tag OR filter intersects with format", () => {
  const angry = api.filterItems(manifest.items, { tags: ["生气"] }, manifest.vocabulary);
  assert.ok(angry.length >= 1);
  const angryGif = api.filterItems(manifest.items, { tags: ["生气"], format: "gif" }, manifest.vocabulary);
  assert.ok(angryGif.every((item) => item.format === "gif" && item.tags.includes("生气")));
  assert.ok(angryGif.length <= angry.length);
});

test("empty result is possible and safe", () => {
  const empty = api.filterItems(manifest.items, { query: "这个标签肯定不存在xyz123" }, manifest.vocabulary);
  assert.strictEqual(empty.length, 0);
  assert.strictEqual(api.pickRandom(empty), null);
});

test("random stays inside the current filtered set", () => {
  const set = api.filterItems(manifest.items, { format: "jpg" }, manifest.vocabulary);
  assert.strictEqual(set.length, 4);
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    const item = api.pickRandom(set);
    assert.ok(set.some((it) => it.id === item.id));
    seen.add(item.id);
  }
  assert.ok(seen.size >= 2, "random should not always return the same jpg");
});

test("used tags only come from the vocabulary actually present", () => {
  const groups = api.usedTags(manifest.items, manifest.vocabulary);
  const names = Object.values(groups).flat().map((x) => x.tag);
  names.forEach((tag) => {
    assert.ok(manifest.vocabulary[tag], tag);
  });
  assert.ok(names.includes("哭"));
});

console.log("\n" + passed + " node tests passed");
