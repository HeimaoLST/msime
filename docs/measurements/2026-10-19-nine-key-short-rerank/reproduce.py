#!/usr/bin/env python3
"""在已应用原型补丁的基线隔离工作树中，复现完整入口的普通分配器配对验收。"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--resources", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    resources = args.resources.resolve()
    expected = json.loads(Path(__file__).with_name("result.json").read_text())
    source = root / "crates/engine/src/nine_key.rs"
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected["prototype_source_sha256"]:
        parser.error("先在记录的 baseline_commit 隔离工作树应用 prototype.patch；源码身份必须一致")
    model = resources / "sentence-model.safetensors"
    if hashlib.sha256(model.read_bytes()).hexdigest() != expected["model_sha256"]:
        parser.error("键盘模型不匹配记录的 SHA-256")

    output = root / "target/measurements/nine-key-short-rerank"
    output.mkdir(parents=True, exist_ok=True)
    allocator = root / "crates/engine/src/ime/personal_rerank.rs"
    original = allocator.read_bytes()
    assert original.count(b"#[global_allocator]") == 1
    env = dict(os.environ, CARGO_BUILD_JOBS="4", MSIME_NEURAL_MODEL_DIR=str(resources))
    env.pop("CARGO_TARGET_DIR", None)
    try:
        allocator.write_bytes(original.replace(b"#[global_allocator]", b"#[allow(dead_code)]"))
        with (output / "build.jsonl").open("w") as out, (output / "build.log").open("w") as err:
            subprocess.run(expected["configuration"]["build"], cwd=root, env=env,
                           stdout=out, stderr=err, check=True)
        artifacts = [json.loads(line) for line in (output / "build.jsonl").read_text().splitlines()
                     if line.startswith("{")]
        binaries = [row["executable"] for row in artifacts if row.get("executable")
                    and row.get("target", {}).get("name") == "msime_engine"]
        assert len(binaries) == 1, binaries
        binary = output / "system-tests"
        shutil.copy2(binaries[0], binary)
    finally:
        allocator.write_bytes(original)

    names = {"cargo", "cargo-clippy", "rustc", "clang", "clang++", "cc1", "cc1plus", "ld",
             "ninja", "cmake", "make", "javac", "swiftc", "swift-frontend", "xcodebuild", "gradle", "docker"}

    def builds():
        found = {}
        for command in subprocess.check_output(["ps", "-Ao", "comm="], text=True).splitlines():
            name = Path(command.strip()).name
            if name in names:
                found[name] = found.get(name, 0) + 1
        return found

    idle = 0
    started = time.monotonic()
    while idle < 5:
        idle = 0 if builds() else idle + 1
        if time.monotonic() - started > 1800:
            raise SystemExit("等待30分钟仍无连续五次无构建观测；尚未计时")
        time.sleep(1)

    before = hashlib.sha256(binary.read_bytes()).hexdigest()
    observations = []
    started = time.monotonic()
    with (output / "run.log").open("w") as log:
        process = subprocess.Popen([str(binary), "--exact", expected["configuration"]["test"],
                                    "--ignored", "--nocapture", "--test-threads=1"],
                                   cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
        while True:
            observations.append({"elapsed_seconds": round(time.monotonic() - started, 3), "builds": builds()})
            if process.poll() is not None:
                break
            time.sleep(1)
    monitor = {"binary_sha256": before, "binary_sha256_after": hashlib.sha256(binary.read_bytes()).hexdigest(),
               "returncode": process.returncode, "duration_seconds": round(time.monotonic() - started, 3),
               "monitor": observations, "invalid_due_to_builds": any(row["builds"] for row in observations)}
    (output / "monitor.json").write_text(json.dumps(monitor, indent=2) + "\n")
    print(json.dumps(monitor, ensure_ascii=False))
    print((output / "run.log").read_text())
    return process.returncode or int(monitor["invalid_due_to_builds"])


if __name__ == "__main__":
    sys.exit(main())
