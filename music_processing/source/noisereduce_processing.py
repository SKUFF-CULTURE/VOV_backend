import ffmpeg
import noisereduce as nr
import librosa
import soundfile as sf
from pathlib import Path
import logging
import numpy as np

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')


class AudioRestorer:
    def __init__(self, sr=44100, mode="gentle", vinyl_intensity="medium"):
        """
        :param sr: Sample rate
        :param mode: Processing mode:
            - 'gentle': gentle denoising
            - 'ultra_gentle': minimal processing
            - 'vinyl': specialized vinyl processing
        :param vinyl_intensity: Vinyl processing intensity ('light', 'medium', 'aggressive')
        """
        self.sr = sr
        self.mode = mode
        self.vinyl_intensity = vinyl_intensity
        self.ffmpeg_params = {
            'light': {'nr': 15, 'nf': -20, 'hpf': 60, 'lpf': 12000},
            'medium': {'nr': 25, 'nf': -25, 'hpf': 50, 'lpf': 10000},
            'aggressive': {'nr': 40, 'nf': -35, 'hpf': 40, 'lpf': 8000}
        }

    def _process_vinyl(self, input_path, output_path):
        """Universal vinyl processing using only compatible filters"""
        params = self.ffmpeg_params[self.vinyl_intensity]

        try:
            (
                ffmpeg
                .input(input_path)
                # 1. Broadband noise reduction (compatible with all versions)
                .filter('afftdn', nr=params['nr'], nf=params['nf'])
                # 2. Click removal using highpass+lowpass
                .filter('highpass', f=params['hpf'])
                .filter('lowpass', f=params['lpf'])
                # 3. Dynamic normalization
                .filter('dynaudnorm', framelen=500)
                # 4. Mild exciter for HF restoration
                .filter('equalizer', frequency=10000, width_type='q', width=1, gain=1.5)
                .output(output_path, ar=self.sr)
                .overwrite_output()
                .run(quiet=True)
            )
        except ffmpeg.Error as e:
            logger.error(f"FFmpeg processing failed. Try updating FFmpeg to version 5.0+")
            logger.error(f"Error details: {e.stderr.decode()}")
            # Fallback to Python-only processing
            self._fallback_vinyl_processing(input_path, output_path)

    def _fallback_vinyl_processing(self, input_path, output_path):
        """Python-only fallback when FFmpeg fails"""
        logger.warning("Using Python-only fallback processing")
        y, sr = librosa.load(input_path, sr=self.sr)

        # 1. Noise reduction
        noise_profile = y[:int(0.2 * sr)]
        y_clean = nr.reduce_noise(
            y=y, sr=sr, y_noise=noise_profile,
            stationary=False,
            n_fft=4096,
            prop_decrease=0.7
        )

        # 2. Highpass filter
        y_clean = librosa.effects.preemphasis(y_clean, coef=0.92)

        sf.write(output_path, y_clean, sr)

    def _gentle_denoise(self, y, sr):
        """Gentle noise reduction"""
        noise_profile = y[:int(0.2 * sr)]
        return nr.reduce_noise(
            y=y, sr=sr, y_noise=noise_profile,
            stationary=False,
            n_fft=4096,
            prop_decrease=0.5
        )

    def restore(self, input_path, output_path):
        input_path = Path(input_path)
        output_path = Path(output_path)

        logger.info(f"Starting {self.mode} restoration...")

        try:
            if self.mode == "vinyl":
                self._process_vinyl(str(input_path), str(output_path))
            else:
                y, sr = librosa.load(str(input_path), sr=self.sr)

                if self.mode == "ultra_gentle":
                    y_clean = librosa.effects.preemphasis(y, coef=0.85)
                else:
                    y_clean = self._gentle_denoise(y, sr)

                sf.write(str(output_path), y_clean, sr)

            logger.info(f"Successfully saved to: {output_path}")
            return True
        except Exception as e:
            logger.error(f"Processing failed: {str(e)}")
            return False


if __name__ == "__main__":
    # Gentle mode (default)
    reducer = AudioRestorer(mode="ultra_gentle")
    reducer.restore(
        input_path="audio/raw/tiomnaia_noch.wav",
        output_path="vocals_gentle.wav"
    )

    # Aggressive mode for heavy noise
    reducer_aggressive = AudioRestorer(mode="old_tape")
    reducer_aggressive.restore(
        input_path="audio/raw/tiomnaia_noch.wav",
        output_path="denoised_tape.wav"
    )

    # Средняя интенсивность
    restorer = AudioRestorer(mode="vinyl", vinyl_intensity="medium")
    restorer.restore("audio/raw/tiomnaia_noch.wav", "vinyl_clean.wav")

    # Агрессивная обработка (для сильно поврежденных записей)
    restorer_aggressive = AudioRestorer(mode="vinyl", vinyl_intensity="aggressive")
    restorer_aggressive.restore("audio/raw/tiomnaia_noch.wav", "fixed_vinyl.wav")