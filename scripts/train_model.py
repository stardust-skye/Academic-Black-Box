"""Train + evaluate the decision tree and save artifacts.   python scripts/train_model.py"""
import _path  # noqa: F401
from backend.ml import train

if __name__ == "__main__":
    train.train(verbose=True)
