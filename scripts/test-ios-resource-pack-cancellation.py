#!/usr/bin/env python3
"""编译真实 iOS 下载状态机，用条件同步复现启动前、登记前及运行中的取消时序。"""
from pathlib import Path
import platform
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    swiftc = shutil.which("swiftc")
    if platform.system() != "Darwin" or not swiftc:
        print("skipped: iOS 取消回归需要 macOS 和 swiftc")
        return
    output = ROOT / "target/ios-pack-cancel-tests"
    output.parent.mkdir(parents=True, exist_ok=True)
    sources = [
        "platforms/ios/App/Services/IOSResourcePackDownload.swift",
        "platforms/ios/App/Services/IOSResourcePackStore.swift",
        "platforms/ios/tests/resource-packs/IOSResourcePackCancellationTests.swift",
    ]
    subprocess.run([swiftc, "-swift-version", "5", "-parse-as-library", *sources,
                    "-o", str(output)], cwd=ROOT, check=True, timeout=60)
    for mode in ["early", "registration", "registered"]:
        subprocess.run([str(output), mode], cwd=ROOT, check=True, timeout=15)


if __name__ == "__main__":
    main()
