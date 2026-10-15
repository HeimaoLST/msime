#!/usr/bin/env python3
"""打包六平台 nightly，超出 GitHub 单附件限制时自动分卷。"""

import argparse
import hashlib
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone


PLATFORMS = ("android", "ios", "macos", "linux", "harmony", "windows")
ASSET_LIMIT = 2 * 1024**3 - 1


def checksum(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def split_archive(path, limit):
    if path.stat().st_size <= limit:
        return []
    parts = []
    with path.open("rb") as source:
        while source.tell() < path.stat().st_size:
            part = path.with_name(f"{path.name}.part{len(parts):03d}")
            with part.open("wb") as destination:
                remaining = limit
                while remaining:
                    chunk = source.read(min(1024**2, remaining))
                    if not chunk:
                        break
                    destination.write(chunk)
                    remaining -= len(chunk)
            parts.append(part)
    path.unlink()
    return parts


def package(source, output, source_sha, limit=ASSET_LIMIT):
    if limit < 1:
        raise ValueError("附件大小上限必须为正数")
    if output.exists() and any(output.iterdir()):
        raise ValueError("输出目录必须为空，避免上传上一次的产物")
    for platform in PLATFORMS:
        if not any(path.is_file() for path in (source / platform).rglob("*")):
            raise ValueError(f"缺少平台产物：{platform}")
    output.mkdir(parents=True, exist_ok=True)
    files = sorted(path for path in source.rglob("*") if path.is_file())
    (output / "SHA256SUMS").write_text("".join(
        f"{checksum(path)}  ./{path.relative_to(source).as_posix()}\n" for path in files
    ))
    now = datetime.now(timezone.utc)
    stem = f"msime-nightly-{{}}{now:%Y-%m-%d}-{source_sha[:12]}.tar.gz"
    instructions = []
    for platform in (*PLATFORMS, None):
        archive = output / stem.format(f"{platform}-" if platform else "")
        subprocess.run(["tar", "-czf", str(archive.resolve()), "-C", str(source),
                        platform or "."], check=True,
                       env={**os.environ, "COPYFILE_DISABLE": "1"})
        if split_archive(archive, limit):
            instructions.append(f"cat {archive.name}.part* > {archive.name}\n")
    archives = sorted(output.glob("*.tar.gz*"))
    (output / "ARCHIVE_SHA256SUMS").write_text("".join(
        f"{checksum(path)}  {path.name}\n" for path in archives
    ))
    readme = (f"nightly source: {source_sha}\nbuilt at: {now.isoformat()}\n\n"
              "按平台下载对应压缩包；全部平台也可下载总包。\n"
              "sha256sum --ignore-missing -c ARCHIVE_SHA256SUMS 校验下载文件。\n"
              "解压后运行 sha256sum --ignore-missing -c SHA256SUMS 校验内容。\n")
    if instructions:
        readme += ("\n分卷包需下载同名的全部 .part 文件，在同一目录按序合并后解压：\n"
                   + "".join(instructions)
                   + "Windows 可在 WSL/Git Bash 中执行上述命令。\n")
    (output / "README.txt").write_text(readme)
    if any(path.stat().st_size > limit for path in output.iterdir()):
        raise ValueError("仍有附件超出大小限制，禁止发布")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("source_sha")
    args = parser.parse_args()
    package(args.source, args.output, args.source_sha)
