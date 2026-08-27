import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

from nltk.sentiment import SentimentIntensityAnalyzer


def make_analyzer():
    """Create VADER even when the installed data archive cannot be opened by NLTK."""
    try:
        return SentimentIntensityAnalyzer()
    except LookupError:
        data_dir = Path(os.environ.get("NLTK_DATA", "/usr/local/nltk_data"))
        archive = data_dir / "sentiment" / "vader_lexicon.zip"
        if not archive.is_file():
            raise
        target = Path(tempfile.gettempdir()) / "sentix_vader_lexicon.txt"
        with zipfile.ZipFile(archive) as zipped:
            target.write_bytes(zipped.read("vader_lexicon/vader_lexicon.txt"))
        return SentimentIntensityAnalyzer(lexicon_file=target.resolve().as_uri())


def main():
    if "--health" in sys.argv:
        make_analyzer()
        print(json.dumps({"status": "ready", "engine": "python-nltk-vader"}))
        return
    payload = json.load(sys.stdin)
    texts = payload.get("texts", [])
    analyzer = make_analyzer()
    results = [analyzer.polarity_scores(str(text)) for text in texts]
    print(json.dumps(results))


if __name__ == "__main__":
    main()
