# Demucs is used to divide vocals and instruments

import demucs.separate
import platform
import shlex
import shutil
import logging
from pathlib import Path


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

class DemucsProcessor:
    def __init__(self):
        import torchaudio
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
            # Linux/macOS — скорее всего, sox_io будет работать
            try:
                torchaudio.set_audio_backend("sox_io")
                logger.info("[Audio] Using 'sox_io' backend for torchaudio")
            except RuntimeError:
                logger.warning("[Audio] 'sox_io' backend unavailable. Falling back to default.")



    def separate_vocals(self, input_path, output_path, model="htdemucs") -> dict:
        input_path = Path(input_path).resolve()
        output_path = Path(output_path).resolve()
        output_path.mkdir(parents=True, exist_ok=True)

        logger.info(f"[Demucs] Processing file: {input_path}")
        args = shlex.split(f'--two-stems vocals -n {model} "{input_path}"')

        try:
            demucs.separate.main(args)
        except Exception as e:
            logger.exception("Error while separating audio with Demucs")
            raise RuntimeError(f"[Demucs] Separation failed: {e}")

        stem_name = input_path.stem
        base_dir = Path(f"separated/{model}/{stem_name}").resolve()

        vocals_path = base_dir / "vocals.wav"
        no_vocals_path = base_dir / "no_vocals.wav"

        if not vocals_path.exists() or not no_vocals_path.exists():
            logger.error("Expected output files not found.")
            raise FileNotFoundError("Demucs output files missing.")

        # Копируем в output/
        final_vocals = output_path / f"{stem_name}_vocals.wav"
        final_instr = output_path / f"{stem_name}_instrumental.wav"

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
    print(d_p.separate_vocals(input_path="audio/raw/tiomnaia_noch.wav", output_path="audio/demucs_vocals"))
