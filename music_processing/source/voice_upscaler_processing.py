# BABE 2 here

import subprocess
import logging
from pathlib import Path
import sys
import time
import os

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')


class Babe2Restorer:

    def __init__(self,
                 config_path="music_processing/external/babe_2/BABE2-music-restoration/conf/conf_singing_voice.yaml",
                 checkpoint_path="music_processing/external/babe_2/checkpoints/singing_voice_pretrain_44kHz_6s-325kits.pt"
                 ):

        if not os.path.exists(config_path):
            raise FileNotFoundError(f"[BABE2] Config file not found: {config_path}")
        if not os.path.exists(checkpoint_path):
            raise FileNotFoundError(f"[BABE2] Checkpoint not found: {checkpoint_path}")

        self.config = config_path
        self.checkpoint = checkpoint_path

    def upscale(self, input_wav: str, save_dir: str, device="cuda:0"):
        input_path = Path(input_wav).resolve()
        save_dir = Path(save_dir).resolve()
        save_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"[AudioRestorer] Upscaling: {input_path} → {save_dir}")

        if device.startswith("cuda:"):
            device_id = device.split(":")[1]
            os.environ["CUDA_VISIBLE_DEVICES"] = device_id
            logger.info(f"[AudioRestorer] Using GPU: {device}")

        run_id = f"cleaned_{input_path.stem}"

        command = [
            sys.executable, "test.py",
            f"--config-name={self.config}",
            "tester=singer_evaluator_BABE2",
            f"tester.checkpoint={str(self.checkpoint)}",
            f"id={run_id}",
            f"tester.evaluation.single_recording={str(input_path)}"
        ]

        start_time = time.time()

        process = subprocess.Popen(command, cwd=str(Path(self.config).parent.parent), stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True)
        for line in process.stdout:
            logger.debug(line.strip())
        process.wait()

        elapsed = time.time() - start_time
        logger.info(f"[AudioRestorer] Finished in {elapsed:.2f} seconds")

        def restore():
            pass


if __name__ == "__main__":
    restorer = Babe2Restorer()
