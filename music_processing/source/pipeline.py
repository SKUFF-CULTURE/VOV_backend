from noisereduce_processing import AudioRestorer
from demucs_processing import DemucsProcessor
from convertor import AudioConverter
from toolbox.common import make_name
import logging
import os

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

def run(input_path, nfs_dir, uuid: 0):

    logger.info("Starting...")

    work_dir = nfs_dir + str(uuid) + '/'
    os.makedirs(work_dir, exist_ok=True)

    # Setting up the instances of processing tools
    audio_converter = AudioConverter()
    restorer = AudioRestorer(mode="vinyl", vinyl_intensity="aggressive")
    track_splitter = DemucsProcessor()


    # Starting pipeline

    # 0. Convertion
    s_path = audio_converter.convert_name(input_path)
    audio_path = str(audio_converter.to_wav(input_path=str(s_path)))

    logger.info("Step 0 done")

    # 1. Noise reduction
    denoised_path = work_dir + make_name(audio_path, suffix='-denoised')
    restorer.restore(
        input_path=audio_path,
        output_path=denoised_path
    )
    logger.info("Step 1 done")

    # 2. Track splitting
    track_splitter.separate(input_path=denoised_path, output_dir=work_dir, model="hdemucs_mmi", mode='vintage')
    logger.info("Step 2 done")

    logger.info("All done!")

if __name__ == '__main__':
    run(input_path='audio/raw/Тёмная ночь.mp3', nfs_dir="audio", uuid=3)
