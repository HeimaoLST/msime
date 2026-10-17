#!/usr/bin/env python3
"""The online provider asks only the translation service the user selected.

A valid Tencent credential file stays on disk after the user picks another service or 关闭, so every case here keeps one in place: a query that is not explicitly for Tencent must still send nothing to Tencent. `fetch` is the provider's only network egress, so recording it proves which services were contacted; no network is used.
"""
import importlib.machinery
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
loader = importlib.machinery.SourceFileLoader("online_provider", str(ROOT / "scripts" / "msime-linux-online-provider"))
spec = importlib.util.spec_from_loader(loader.name, loader)
provider = importlib.util.module_from_spec(spec)
loader.exec_module(provider)

TENCENT = "https://tmt.tencentcloudapi.com/"
NIUTRANS = "https://api.niutrans.com/v2/text/translate"
CUSTOM = "https://translation.example.invalid/translate"


def respond(url, timeout, body=None, token=None, extra_headers=None):
    if url == TENCENT:
        return {"Response": {"TargetTextList": ["synthetic tencent"]}}
    if url == NIUTRANS:
        return {"tgtText": "synthetic niutrans"}
    if url == "https://api.msime.app/v1/translate":
        return {"code": 200, "data": ["synthetic account"]}
    return {"data": "synthetic custom"}


class TranslationProviderSelection(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="msime-translation-selection-")
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "tencent-provider.json"
        path.write_text(json.dumps({"secret_id": "synthetic-local-id", "secret_key": "synthetic-local-key"}))
        path.chmod(0o600)
        self.assertTrue(provider.load_tencent_config(path), "fixture Tencent credential must be usable")
        self.server = SimpleNamespace(tencent_config_path=path, translation_cache={},
                                      translation_lock=threading.Lock())

    def test_provider_does_not_duplicate_rust_account_storage_or_authentication(self):
        source = Path(provider.__file__).read_text()
        self.assertNotIn("/v1/auth/", source)
        self.assertNotIn("anonymous-account.json", source)
        self.assertNotIn("anonymous-session.json", source)

    def contacted(self, query):
        query = {"generation": 1, "candidates": ["测试"], "target_language": "en", **query}
        with mock.patch.object(provider, "fetch", side_effect=respond) as fetch:
            result = provider.translations(query, self.server)
        return result, [call.args[0] for call in fetch.call_args_list]

    def test_unusable_or_disabled_selection_never_reaches_tencent(self):
        for name, query in (
            ("translation off", {"provider": "none"}),
            # host-api omits a NiuTrans or custom block whose configuration is incomplete, but still names the selection.
            ("NiuTrans without credentials", {"provider": "niutrans"}),
            ("NiuTrans disabled block", {"provider": "niutrans",
                                         "niutrans": {"enabled": False, "app_id": "", "apikey": ""}}),
            ("custom without endpoint", {"provider": "custom"}),
            ("custom disabled block", {"provider": "custom",
                                       "custom_translation": {"enabled": False, "endpoint": "", "api_key": ""}}),
            ("unknown service", {"provider": "deepl"}),
            ("malformed service", {"provider": ["tencent"]}),
            # The field is required: a query without it is malformed, whatever blocks it carries.
            ("missing service", {}),
            ("missing service with a usable block", {"niutrans": {"enabled": True, "app_id": "synthetic-app",
                                                                  "apikey": "synthetic-key"}}),
            ("missing service with the account flag", {"translation_account": True}),
        ):
            with self.subTest(case=name):
                result, urls = self.contacted(query)
                self.assertEqual(result, [])
                self.assertEqual(urls, [])

    def test_only_the_selected_service_is_asked(self):
        niutrans = {"enabled": True, "app_id": "synthetic-app", "apikey": "synthetic-key"}
        custom = {"enabled": True, "endpoint": CUSTOM, "api_key": ""}
        for name, query, expected, translation in (
            ("Tencent", {"provider": "tencent"}, TENCENT, "synthetic tencent"),
            # A stray block for another service must not redirect a Tencent selection.
            ("Tencent with stray NiuTrans block", {"provider": "tencent", "niutrans": niutrans}, TENCENT,
             "synthetic tencent"),
            ("NiuTrans", {"provider": "niutrans", "niutrans": niutrans}, NIUTRANS, "synthetic niutrans"),
            ("custom", {"provider": "custom", "custom_translation": custom}, CUSTOM, "synthetic custom"),
        ):
            with self.subTest(case=name):
                self.server.translation_cache.clear()
                result, urls = self.contacted(query)
                self.assertEqual(result, [{"text": "测试", "translation": translation}])
                self.assertEqual(urls, [expected])

    def test_sentence_requests_allow_one_long_item_without_changing_candidate_limits(self):
        sentence = "这是一个超过普通候选词限制但仍在整句请求上限内的合成测试句子。" * 9
        custom = {"enabled": True, "endpoint": CUSTOM, "api_key": ""}
        result, urls = self.contacted({"provider": "custom", "custom_translation": custom,
                                       "sentence": True, "candidates": [sentence]})
        self.assertEqual(result, [{"text": sentence, "translation": "synthetic custom"}])
        self.assertEqual(urls, [CUSTOM])

        result, urls = self.contacted({"provider": "custom", "custom_translation": custom,
                                       "candidates": [sentence]})
        self.assertEqual(result, [])
        self.assertEqual(urls, [])

    def test_explicit_account_selection_uses_the_account_endpoint(self):
        account = mock.Mock()
        account.directory = Path("/synthetic/account")
        account.ensure_anonymous.return_value = True
        account.access_token.return_value = "a" * 64
        account.prepare_translation.return_value = json.dumps(
            {"texts": ["测试"], "source_lang": "ZH", "target_lang": "EN"})
        account.parse_translation.return_value = {"translations": ["synthetic account"]}
        self.server.rust_account = account
        result, urls = self.contacted({"provider": "none", "translation_account": True})
        self.assertEqual(result, [{"text": "测试", "translation": "synthetic account"}])
        self.assertEqual(urls, ["https://api.msime.app/v1/translate"])
        account.ensure_anonymous.assert_called_once_with()
        account.access_token.assert_called_once_with()
        account.prepare_translation.assert_called_once_with(["测试"], "zh", "en")
        account.parse_translation.assert_called_once()

if __name__ == "__main__":
    unittest.main()
