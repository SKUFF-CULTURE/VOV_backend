import os
import subprocess
import logging

# Настройка логирования
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def check_nfs_server(nfs_mount_point="/mnt/nfs_share" ):
    logging.info(f"Searching for NFS server...")
    try:
        if os.path.ismount(nfs_mount_point):
            logging.info(f"NFS server is already available at {nfs_mount_point}")
            return True
        else:
            # Если нет, пытаемся смонтировать его (с использованием команды mount)
            logging.info(f"Mounting directory...")
            result = subprocess.run(['mount', nfs_mount_point], capture_output=True,
                                    text=True)
            if result.returncode == 0:
                logging.info(f"NFS server directory was successfully mounted.")
                return True
            else:
                logging.error(f"Error while connecting to nfs server: {result.stderr}")
                return False
    except Exception as e:
        logging.error(f"NFS server-check issue was caught: {e}")
        return False