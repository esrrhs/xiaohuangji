#!/usr/bin/env python3
"""Scan data/ and gallery/tags.json, then write gallery/manifest.json.

This is a local/CI build step. The gallery itself is static and needs no backend.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path

ALLOWED_EXT = {".gif": "gif", ".png": "png", ".jpg": "jpg", ".jpeg": "jpg", ".webp": "webp"}
SHANGHAI = timezone(timedelta(hours=8))


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def detect_media(path: Path) -> tuple[int, int, str | None, int]:
    try:
        from PIL import Image
    except ImportError:
        return 0, 0, None, 1
    with Image.open(path) as im:
        width, height = im.size
        media = (im.format or "").upper() or None
        frames = getattr(im, "n_frames", 1) or 1
        return width, height, media, frames


def load_tags(path: Path) -> dict:
    if not path.is_file():
        raise FileNotFoundError(f"缺少标签文件: {path}")
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("tags.json 必须是对象")
    vocabulary = data.get("vocabulary") or {}
    items = data.get("items") or {}
    if not isinstance(vocabulary, dict) or not isinstance(items, dict):
        raise ValueError("tags.json 的 vocabulary / items 必须是对象")
    return data


def collect_files(data_dir: Path) -> list[Path]:
    files = []
    for path in sorted(data_dir.iterdir(), key=lambda p: p.name.lower()):
        if path.is_file() and path.suffix.lower() in ALLOWED_EXT:
            files.append(path)
    return files


def build(root: Path) -> dict:
    data_dir = root / "data"
    tags_path = root / "gallery" / "tags.json"
    if not data_dir.is_dir():
        raise FileNotFoundError(f"缺少素材目录: {data_dir}")

    tag_data = load_tags(tags_path)
    vocabulary = tag_data["vocabulary"]
    tagged_items = tag_data["items"]

    errors: list[str] = []
    warnings: list[str] = []

    unknown_files = [name for name in tagged_items if not (data_dir / name).is_file()]
    for name in unknown_files:
        errors.append(f"标签引用了不存在的文件: {name}")

    for name, rec in tagged_items.items():
        if not isinstance(rec, dict):
            errors.append(f"标签条目不是对象: {name}")
            continue
        tags = rec.get("tags") or []
        if not tags:
            warnings.append(f"{name} 没有 tags，请从 items 中删除或补全")
        for tag in tags:
            if tag not in vocabulary:
                errors.append(f"{name} 使用了未登记标签: {tag}")

    files = collect_files(data_dir)
    items = []
    format_counts: Counter[str] = Counter()

    for path in files:
        fmt = ALLOWED_EXT[path.suffix.lower()]
        format_counts[fmt] += 1
        width, height, media, frames = detect_media(path)
        rec = tagged_items.get(path.name) or {}
        tags = list(rec.get("tags") or [])
        title = (rec.get("title") or "").strip()
        entry = {
            "id": path.name,
            "file": path.name,
            "src": f"data/{path.name}",
            "format": fmt,
            "width": width,
            "height": height,
            "bytes": path.stat().st_size,
            "frames": frames,
            "tags": tags,
            "title": title,
            "tagged": bool(tags),
        }
        if media:
            entry["media"] = media
        items.append(entry)

    now = datetime.now(SHANGHAI).isoformat(timespec="seconds")
    tagged_count = sum(1 for it in items if it["tagged"])
    manifest = {
        "generatedAt": now,
        "dataDir": "data",
        "count": len(items),
        "taggedCount": tagged_count,
        "untaggedCount": len(items) - tagged_count,
        "formats": {k: format_counts[k] for k in sorted(format_counts)},
        "vocabulary": {
            name: {
                "group": (meta or {}).get("group") or "其他",
                "aliases": list((meta or {}).get("aliases") or []),
            }
            for name, meta in vocabulary.items()
        },
        "items": items,
        "notes": {
            "search": "语义搜索只覆盖已标注条目；未标注条目只能按格式、文件名哈希检索。",
            "paths": "图片路径保持 data/<原文件名> 不变。",
        },
    }

    if errors:
        raise SystemExit("构建失败:\n- " + "\n- ".join(errors))
    for msg in warnings:
        print("警告:", msg, file=sys.stderr)
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="生成静态图库清单 gallery/manifest.json")
    parser.add_argument("--root", type=Path, default=repo_root())
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="输出路径，默认 <root>/gallery/manifest.json",
    )
    parser.add_argument("--check", action="store_true", help="只检查，不写文件")
    args = parser.parse_args(argv)

    root = args.root.resolve()
    out = (args.out or (root / "gallery" / "manifest.json")).resolve()
    manifest = build(root)
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"

    if args.check:
        if not out.is_file():
            print(f"缺少清单文件: {out}", file=sys.stderr)
            return 1
        current = out.read_text(encoding="utf-8")
        current_data = json.loads(current)
        # generatedAt is volatile; compare the rest
        a, b = dict(current_data), dict(manifest)
        a.pop("generatedAt", None)
        b.pop("generatedAt", None)
        if a != b:
            print("manifest.json 与 data/、tags.json 不一致，请运行 python3 scripts/build_manifest.py", file=sys.stderr)
            return 1
        print(
            f"清单已同步：{manifest['count']} 张，已标注 {manifest['taggedCount']}，"
            f"格式 {manifest['formats']}"
        )
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(
        f"已写入 {out.relative_to(root)}：{manifest['count']} 张，"
        f"已标注 {manifest['taggedCount']}，未标注 {manifest['untaggedCount']}，"
        f"格式 {manifest['formats']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
