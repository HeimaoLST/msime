#!/usr/bin/env python3
"""Ensure abandoned DownloadPage sends do not leave a platform permanently locked."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/home/DownloadPage.java"


class AndroidDownloadViewLifecycleContract(unittest.TestCase):
    def test_destroyed_view_clears_transient_sends(self):
        source = SOURCE.read_text(encoding="utf-8")
        start = source.index("public final class DownloadPage")
        end = source.index("    @Override protected void buildContent", start)
        header = source[start:end]
        self.assertIn("@Override public void onDestroyView()", header)
        self.assertIn("sending.clear();", header)


if __name__ == "__main__":
    unittest.main()
