#!/usr/bin/env python3
"""Static checks for the gallery: manifest, tags, files, and pages assets."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_manifest  # noqa: E402


def fail(errors: list[str]) -> int:
    print("校验失败:")
    for msg in errors:
        print("-", msg)
    return 1


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    required = [
        ROOT / "index.html",
        ROOT / "gallery" / "styles.css",
        ROOT / "gallery" / "app.js",
        ROOT / "gallery" / "tags.json",
        ROOT / "gallery" / "manifest.json",
        ROOT / "scripts" / "build_manifest.py",
    ]
    for path in required:
        if not path.is_file():
            errors.append(f"缺少文件: {path.relative_to(ROOT)}")

    html = (ROOT / "index.html").read_text(encoding="utf-8") if (ROOT / "index.html").is_file() else ""
    required_refs = (
        ("gallery/styles.css", 'href="gallery/styles.css'),
        ("gallery/app.js", 'src="gallery/app.js'),
        ("gallery/manifest.json", "gallery/manifest.json"),
        ("lang=zh-CN", 'lang="zh-CN"'),
    )
    for label, needle in required_refs:
        if needle not in html:
            errors.append(f"index.html 未包含必要引用: {label}")

    # Do not use site-root-absolute paths that break under /xiaohuangji/
    if 'href="/gallery/' in html or 'src="/gallery/' in html or 'href="/data/' in html:
        errors.append("index.html 使用了站点根绝对路径，在 GitHub Pages 的 /xiaohuangji/ 下会失效")

    try:
        tag_data = build_manifest.load_tags(ROOT / "gallery" / "tags.json")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"读取 tags.json 失败: {exc}")
        tag_data = {"vocabulary": {}, "items": {}}

    data_files = {p.name for p in build_manifest.collect_files(ROOT / "data")}
    if len(data_files) == 0:
        errors.append("data/ 中没有可用图片")

    for name in tag_data.get("items", {}):
        if name not in data_files:
            errors.append(f"标签引用了 data/ 中不存在的文件: {name}")

    try:
        rc = build_manifest.main(["--root", str(ROOT), "--check"])
        if rc != 0:
            errors.append("manifest.json 未与 data/、tags.json 同步")
    except SystemExit as exc:
        errors.append(f"构建检查失败: {exc}")

    manifest_path = ROOT / "gallery" / "manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        items = manifest.get("items") or []
        ids = [it.get("id") for it in items]
        if len(ids) != len(set(ids)):
            errors.append("manifest 中存在重复 id")
        listed = set(ids)
        missing = sorted(data_files - listed)
        extra = sorted(listed - data_files)
        if missing:
            errors.append(f"清单漏了 {len(missing)} 个文件，例如 {missing[:3]}")
        if extra:
            errors.append(f"清单多了 {len(extra)} 个文件，例如 {extra[:3]}")
        if manifest.get("count") != len(items):
            errors.append("manifest.count 与 items 数量不一致")
        tagged = sum(1 for it in items if it.get("tagged"))
        if manifest.get("taggedCount") != tagged:
            errors.append("manifest.taggedCount 不正确")
        for it in items:
            src = it.get("src") or ""
            if not src.startswith("data/") or src != f"data/{it.get('file')}":
                errors.append(f"路径不合法: {it.get('id')} -> {src}")
                break
            if it.get("format") not in {"gif", "png", "jpg", "webp"}:
                errors.append(f"未知格式: {it.get('id')} {it.get('format')}")
                break

        # Extension vs detected media mismatches are informational only.
        mismatches = [
            it
            for it in items
            if it.get("media")
            and {
                "gif": "GIF",
                "png": "PNG",
                "jpg": "JPEG",
                "webp": "WEBP",
            }.get(it.get("format"))
            not in {it.get("media"), None}
        ]
        if mismatches:
            warnings.append(
                f"{len(mismatches)} 个文件的扩展名与实际编码不一致（已按扩展名分类，不阻断）"
            )

    js = (ROOT / "gallery" / "app.js").read_text(encoding="utf-8") if (ROOT / "gallery" / "app.js").is_file() else ""
    if "filterItems" not in js or "pickRandom" not in js:
        errors.append("gallery/app.js 缺少 filterItems / pickRandom")

    readme = (ROOT / "README.md").read_text(encoding="utf-8") if (ROOT / "README.md").is_file() else ""
    if "https://esrrhs.github.io/xiaohuangji/" not in readme:
        errors.append("README.md 应给出网页图库地址 https://esrrhs.github.io/xiaohuangji/")
    img_wall = readme.count('<img src="./data/')
    if img_wall > 5:
        errors.append(f"README.md 不应再内嵌表情预览墙（发现 {img_wall} 张 data/ 图片）")
    preview = (ROOT / "preview.sh").read_text(encoding="utf-8") if (ROOT / "preview.sh").is_file() else ""
    if ">> README.md" in preview or "<img src=" in preview:
        errors.append("preview.sh 不应再向 README.md 追加表情预览墙")

    for msg in warnings:
        print("警告:", msg)
    if errors:
        return fail(errors)
    print("校验通过。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
