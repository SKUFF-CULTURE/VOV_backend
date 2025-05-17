# Demucs is used to divide vocals and instruments

import demucs.separate
import platform
import shlex
import shutil
import logging
from pathlib import Path
import torchaudio
import torch


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")


class DemucsProcessor:
    def __init__(self):
        current_os = platform.system().lower()

        if current_os == "windows":
            try:
                import soundfile
                torchaudio.set_audio_backend("soundfile")
                logger.info("[Audio] Using 'soundfile' backend for torchaudio (Windows)")
            except ImportError:
                logger.error("[Audio] 'soundfile' not installed. Please run: pip install soundfile")
                raise
        else:
            try:
                torchaudio.set_audio_backend("sox_io")
                logger.info("[Audio] Using 'sox_io' backend for torchaudio")
            except RuntimeError:
                logger.warning("[Audio] 'sox_io' backend unavailable. Falling back to default.")

    def separate(self,
                 input_path,
                 output_dir,
                 model="htdemucs_ft",  # Изменено на htdemucs_ft как модель по умолчанию
                 device="auto",  # Автовыбор устройства
                 gpu_index: int = 0,
                 mode="standard"):  # Новый параметр: режим обработки
        """
        Улучшенная версия с оптимизированными параметрами

        :param mode: Режим обработки:
            - 'standard': баланс качества/скорости
            - 'vintage': для старых записей (1940-60s)
            - 'high_quality': максимальное качество
            - 'fast': быстрая обработка
        """
        input_path = Path(input_path).resolve()
        output_dir = Path(output_dir).resolve()
        output_dir.mkdir(parents=True, exist_ok=True)

        # Автовыбор устройства
        if device == "auto":
            device_str = f"cuda:{gpu_index}" if torch.cuda.is_available() else "cpu"
        else:
            device_str = f"cuda:{gpu_index}" if device == "cuda" else "cpu"

        # Параметры для разных режимов
        params_config = {
            'standard': {'shifts': 1, 'overlap': 0.25, 'jobs': 0},
            'vintage': {'shifts': 7, 'overlap': 0.65, 'jobs': 2, 'segment': 12},
            'high_quality': {'shifts': 10, 'overlap': 0.75, 'jobs': 1},
            'fast': {'shifts': 0, 'overlap': 0.1, 'jobs': 4}
        }

        params = params_config[mode]

        logger.info(f"[Demucs] Processing file: {input_path} | Device: {device_str} | Mode: {mode}")

        # Формируем аргументы с новыми параметрами
        args = shlex.split(
            f'--two-stems vocals '
            f'-n {model} '
            f'--float32 '
            f'--device {device_str} '
            f'--shifts {params["shifts"]} '
            f'--overlap {params["overlap"]} '
            f'--jobs {params["jobs"]} '
            f'"{input_path}"'
        )

        try:
            demucs.separate.main(args)
        except Exception as e:
            logger.exception("Error while separating audio with Demucs")
            raise RuntimeError(f"[Demucs] Separation failed: {e}")

        # Остальная часть метода остается без изменений
        stem_name = input_path.stem
        base_dir = Path(f"separated/{model}/{stem_name}").resolve()

        vocals_path = base_dir / "vocals.wav"
        no_vocals_path = base_dir / "no_vocals.wav"

        if not vocals_path.exists() or not no_vocals_path.exists():
            logger.error("Expected output files not found.")
            raise FileNotFoundError("Demucs output files missing.")

        final_vocals = output_dir / f"{stem_name}-vocals.wav"
        final_instr = output_dir / f"{stem_name}-instrumental.wav"

        shutil.copy(vocals_path, final_vocals)
        shutil.copy(no_vocals_path, final_instr)

        logger.info(f"[Demucs] Vocals saved to: {final_vocals}")
        logger.info(f"[Demucs] Instrumental saved to: {final_instr}")

        return {
            "vocals": final_vocals,
            "instrumental": final_instr
        }


if __name__ == "__main__":
    d_p = DemucsProcessor()
    print(d_p.separate(input_path="audio/raw/tiomnaia_noch.wav", output_dir="audio/demucs_vocals"))
