#!/usr/bin/env python3
"""Ensure BackupPage does not retain transient busy state across view recreation."""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/home/BackupPage.java"


class AndroidBackupViewLifecycleContract(unittest.TestCase):
    def test_destroy_view_clears_busy_state(self):
        source = SOURCE.read_text(encoding="utf-8")
        start = source.index("@Override public void onDestroyView()")
        end = source.index("\n    private void refresh()", start)
        body = source[start:end]
        self.assertIn("busy = false;", body)


if __name__ == "__main__":
    unittest.main()
