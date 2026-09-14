"""Exercise the actual MkDocs theme with default and optional CDN languages."""
import logging
from pathlib import Path
from tempfile import TemporaryDirectory
from html.parser import HTMLParser

from mkdocs.config import load_config
from mkdocs.commands.build import build

ROOT = Path(__file__).resolve().parents[2]
logging.getLogger("mkdocs").setLevel(logging.ERROR)


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cdn = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and "cdnjs.cloudflare.com" in attrs.get("src", ""):
            self.cdn.append(attrs)


for languages, hashes, expected_count in [([], None, 1), (["rust"], None, 1),
                                         (["rust"], {"rust": "sha384-" + "A" * 64}, 2)]:
    with TemporaryDirectory() as output:
        config = load_config(config_file=str(ROOT / "mkdocs.yml"), site_dir=output)
        config.theme["hljs_languages"] = languages
        if hashes is not None:
            config.theme["hljs_language_integrity"] = hashes
        build(config)
        parser = Scripts()
        parser.feed((Path(output) / "index.html").read_text())
        assert len(parser.cdn) == expected_count, parser.cdn
        for script in parser.cdn:
            assert script.get("integrity", "").startswith("sha384-"), script
            assert script.get("crossorigin") == "anonymous", script
        if hashes:
            assert parser.cdn[-1]["integrity"] == hashes["rust"]
print("Documentation integrity: 3 rendered configurations passed")
