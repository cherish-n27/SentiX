import json
import sys

from nltk.sentiment import SentimentIntensityAnalyzer


def main():
    payload = json.load(sys.stdin)
    texts = payload.get("texts", [])
    analyzer = SentimentIntensityAnalyzer()
    results = [analyzer.polarity_scores(str(text)) for text in texts]
    print(json.dumps(results))


if __name__ == "__main__":
    main()
