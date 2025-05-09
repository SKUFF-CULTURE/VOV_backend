# Reducing noise with noisereduce

import noisereduce as nr
import librosa
import soundfile as sf
from pathlib import Path
import logging


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')


class NoiseReducer:
    def __init__(self, sr=None, use_noise_profile=False):
        """
        :param sr: Sample rate override
        :param use_noise_profile: If True, use first N seconds as noise sample
        """
        self.sr = sr
        self.use_noise_profile = use_noise_profile

    def reduce_noise(self, input_path: str, output_path: str, noise_duration_sec: float = 0.5) -> str:
        input_path = Path(input_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"[NoiseReducer] Loading input file: {input_path}")
        y, sr = librosa.load(str(input_path), sr=self.sr)
        self.sr = sr

        y_noise = None
        if self.use_noise_profile:
            noise_samples = int(noise_duration_sec * sr)
            y_noise = y[:noise_samples]
            logger.info(f"[NoiseReducer] Using first {noise_duration_sec:.2f} sec as noise profile")

        logger.info("[NoiseReducer] Reducing noise...")
        y_denoised = nr.reduce_noise(y=y, sr=sr, y_noise=y_noise)

        logger.info(f"[NoiseReducer] Saving denoised audio to: {output_path}")
        sf.write(str(output_path), y_denoised, sr, subtype='FLOAT')

        return str(output_path)


if __name__ == "__main__":
    reducer = NoiseReducer(use_noise_profile=True)
    result_path = reducer.reduce_noise(
        input_path="audio/demucs_vocals/tiomnaia_noch_vocals.wav",
        output_path="audio/denoised/tiomnaia_noch_vocals_denoised.wav"
    )
    logger.info(f"[NoiseReducer] Done: {result_path}")
