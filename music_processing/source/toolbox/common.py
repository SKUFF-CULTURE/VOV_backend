import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def flush(dir_path: str):
    dir_path = Path(dir_path).resolve()
    if not dir_path.exists() or not dir_path.is_dir():
        logger.warning(f"[Toolbox] Directory does not exist: {dir_path}")
        return

    removed_files = 0
    for file in dir_path.rglob("*"):
        if file.is_file():
            try:
                file.unlink()
                removed_files += 1
                logger.debug(f"[Toolbox] Removed file: {file}")
            except Exception as e:
                logger.warning(f"[Toolbox] Could not delete file {file}: {e}")

    logger.info(f"[Toolbox] Removed {removed_files} files from: {dir_path}")

def make_name(path:str, suffix: str):
    path_obj = Path(path)
    name = path_obj.stem  # "example"
    ext = path_obj.suffix  # ".txt"
    name += suffix
    name += ext
    return name





