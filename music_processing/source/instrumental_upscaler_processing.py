# AudioSR

import subprocess
import logging
from pathlib import Path
import sys
from pydub import AudioSegment
import time
import os

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')


class AudioRestorer:
    @staticmethod
    def _split_audio(audio_path, chunk_size=5000):
        audio_path = Path(audio_path).resolve()
        audio = AudioSegment.from_wav(audio_path)

        stem = audio_path.stem
        chunk_dir = Path(f"audio/restored/tmp/raw_chunks/{stem}")
        chunk_dir.mkdir(parents=True, exist_ok=True)

        chunk_paths = []
        for i, start in enumerate(range(0, len(audio), chunk_size)):
            chunk = audio[start:start + chunk_size]
            chunk_file = chunk_dir / f"{stem}_chunk_{i:04d}.wav"
            chunk.export(chunk_file, format="wav")
            chunk_paths.append(chunk_file)
            logger.debug(f"[Split] Saved chunk: {chunk_file}")

        return chunk_paths

    @staticmethod
    def _create_file_list(chunk_paths: list[Path], list_path: str = "audio/restored/tmp/file_list.lst") -> Path:
        list_path = Path(list_path).resolve()
        list_path.parent.mkdir(parents=True, exist_ok=True)

        with open(list_path, "w", encoding="utf-8") as f:
            for path in chunk_paths:
                f.write(str(path.resolve()) + "\n")

        logger.info(f"[List] File list saved to: {list_path}")
        return list_path

    @staticmethod
    def _collect_chunks(chunks_path: str, output_path: str) -> str:
        chunks_dir = Path(chunks_path).resolve()
        output_path = Path(output_path).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        chunk_files = sorted(chunks_dir.rglob("*.wav"))
        if not chunk_files:
            raise FileNotFoundError(f"No WAV chunks found in: {chunks_dir}")

        combined = AudioSegment.empty()
        for chunk_file in chunk_files:
            segment = AudioSegment.from_wav(chunk_file)
            combined += segment
            logger.debug(f"[Collect] Appended chunk: {chunk_file.name}")

        combined.export(output_path, format="wav")
        logger.info(f"[Collect] Combined file saved to: {output_path}")
        return str(output_path)

    def upscale(self, input_wav: str, save_dir: str, model_name="basic", device="cuda:0"):
        input_path = Path(input_wav).resolve()
        save_dir = Path(save_dir).resolve()
        save_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"[AudioRestorer] Upscaling: {input_path} → {save_dir}")

        chunks = self._split_audio(input_path)
        file_list = self._create_file_list(chunks)

        if device.startswith("cuda:"):
            device_id = device.split(":")[1]
            os.environ["CUDA_VISIBLE_DEVICES"] = device_id
            logger.info(f"[AudioRestorer] Using GPU: {device}")

        command = [
            sys.executable, "-m", "audiosr",
            "-il", str(file_list),
            "--model_name", model_name,
            "--seed", str(42),
            "--ddim_steps", str(100),
            "--guidance_scale", str(3.5),
            "--device", device,
            "-s", str(save_dir),
            "--suffix", "",
        ]

        logger.info("[AudioRestorer] Processing all chunks in batch mode...")
        start_time = time.time()
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in process.stdout:
            logger.debug(line.strip())
        process.wait()
        elapsed = time.time() - start_time
        logger.info(f"[AudioRestorer] Finished in {elapsed:.2f} seconds")

    def restore(self, input_wav: str, output_path: str = None, model_name="basic", device="cuda") -> str:
        try:
            stem = Path(input_wav).stem
            upscaled_dir = f"audio/restored/tmp/upscaled_chunks/{stem}"
            if output_path is None:
                output_path = f"audio/restored/{stem}_restored.wav"

            self.upscale(input_wav, save_dir=upscaled_dir, model_name=model_name, device=device)
            return self._collect_chunks(upscaled_dir, output_path)

        except Exception as e:
            logger.error(e)


if __name__ == "__main__":
    restorer = AudioRestorer()
    result = restorer.restore(
        input_wav="audio/denoised/tiomnaia_noch_vocals_denoised.wav",
        output_path="audio/restored/tmp/cleaned_output.wav"
    )
    logger.info(f"[Done] Final restored file: {result}")
