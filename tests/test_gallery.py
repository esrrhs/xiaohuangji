#!/usr/bin/env python3
"""Unit and integration checks for the static gallery."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_manifest  # noqa: E402


class ManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads((ROOT / "gallery" / "manifest.json").read_text(encoding="utf-8"))
        cls.tags = json.loads((ROOT / "gallery" / "tags.json").read_text(encoding="utf-8"))

    def test_counts(self) -> None:
        self.assertEqual(self.manifest["count"], 769)
        self.assertEqual(self.manifest["taggedCount"], 101)
        self.assertEqual(self.manifest["untaggedCount"], 668)
        self.assertEqual(self.manifest["formats"], {"gif": 472, "jpg": 4, "png": 293})
        self.assertEqual(len(self.manifest["items"]), 769)

    def test_every_data_file_is_listed_and_paths_stable(self) -> None:
        data = {p.name for p in (ROOT / "data").iterdir() if p.is_file()}
        listed = {item["file"] for item in self.manifest["items"]}
        self.assertEqual(data, listed)
        for item in self.manifest["items"]:
            self.assertEqual(item["src"], f"data/{item['file']}")
            self.assertTrue((ROOT / item["src"]).is_file())
            self.assertRegex(item["file"], r"^[0-9a-f]{32}\.(gif|png|jpg)$")

    def test_tags_only_cover_explicit_items(self) -> None:
        tagged = [item for item in self.manifest["items"] if item["tagged"]]
        self.assertEqual(len(tagged), len(self.tags["items"]))
        for item in tagged:
            self.assertIn(item["file"], self.tags["items"])
            self.assertTrue(item["tags"])
            for tag in item["tags"]:
                self.assertIn(tag, self.tags["vocabulary"])
        for item in self.manifest["items"]:
            if not item["tagged"]:
                self.assertEqual(item["tags"], [])

    def test_build_is_deterministic_except_timestamp(self) -> None:
        first = build_manifest.build(ROOT)
        second = build_manifest.build(ROOT)
        first.pop("generatedAt")
        second.pop("generatedAt")
        self.assertEqual(first, second)

    def test_check_mode_passes(self) -> None:
        rc = build_manifest.main(["--root", str(ROOT), "--check"])
        self.assertEqual(rc, 0)

    def test_check_script_passes(self) -> None:
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "check_gallery.py")],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class HtmlTests(unittest.TestCase):
    def test_relative_assets_and_features(self) -> None:
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="gallery/styles.css', html)
        self.assertIn('src="gallery/app.js', html)
        self.assertNotIn('href="/gallery/', html)
        self.assertIn("随机一张", html)
        self.assertIn("搜索表情", html)
        self.assertIn('lang="zh-CN"', html)


if __name__ == "__main__":
    unittest.main(verbosity=2)
