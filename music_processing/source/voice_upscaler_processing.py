import subprocess
import logging
from pathlib import Path
import sys
import time
import os

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')


class Babe2Restorer:

    def __init__(self, config_path: str, checkpoint_path: str):

        try:
            logger.info(Path.cwd())
            # Paths must be absolute due to complex cross project call structure
            self.config = Path(config_path).resolve()
            self.checkpoint = Path(checkpoint_path).resolve()

            if not self.config.exists():
                raise FileNotFoundError(f"[BABE2] Config file not found: {self.config}")
            if not self.checkpoint.exists():
                raise FileNotFoundError(f"[BABE2] Checkpoint not found: {self.checkpoint}")

        except Exception as e:
            logger.error(e)

    def upscale(self, input_wav: str, save_dir: str, device="cuda:0"):
        try:
            # Проверка и разрешение путей
            input_path = Path(input_wav).resolve()
            save_dir = Path(save_dir).resolve()
            save_dir.mkdir(parents=True, exist_ok=True)  # Создаем директорию, если она не существует

            logger.info(f"[AudioRestorer] Upscaling: {input_path} → {save_dir}")

            if device.startswith("cuda:"):
                device_id = device.split(":")[1]
                os.environ["CUDA_VISIBLE_DEVICES"] = device_id
                logger.info(f"[AudioRestorer] Using GPU: {device}")

            run_id = f"cleaned_{input_path.stem}"

            # Запуск внешнего процесса для восстановления
            command = [
                sys.executable, "external/babe_2/BABE2-music-restoration/test.py",
                f"--config-name={self.config}",
                "tester=singer_evaluator_BABE2",
                f"tester.checkpoint={str(self.checkpoint)}",
                f"id={run_id}",
                f"tester.evaluation.single_recording={str(input_path)}"
            ]

            start_time = time.time()

            process = subprocess.Popen(command, cwd=str(Path.cwd().parent), stdout=subprocess.PIPE,
                                       stderr=subprocess.STDOUT, text=True)
            for line in process.stdout:
                logger.info(f"BABE2: {line.strip()}")
            process.wait()

            elapsed = time.time() - start_time
            logger.info(f"[AudioRestorer] Finished in {elapsed:.2f} seconds")

        except Exception as e:
            logger.error(f"[AudioRestorer] Error during upscaling: {e}")

    def restore(self, input_wav: str, output_path: str, device="cuda:0"):
        try:
            self.upscale(input_wav, output_path, device)
        except Exception as e:
            logger.error(e)


if __name__ == "__main__":
    restorer = Babe2Restorer(
        checkpoint_path=r'C:\Users\FAT_SISKO\Paddle_docker\Vov_backend\music_processing\babe2_data\checkpoints\singing_voice_pretrain_44kHz_6s-325kits.pt',
        config_path=r'C:\Users\FAT_SISKO\Paddle_docker\Vov_backend\music_processing\external\babe_2\BABE2-music-restoration\conf\conf_singing_voice.yaml'
    )
    restorer.restore(
        input_wav="audio/denoised/tiomnaia_noch_vocals_denoised.wav",
        output_path="audio/restored/tmp/cleaned_vocal_output.wav"
    )
    logger.info(f"[Done]")
