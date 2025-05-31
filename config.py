KAFKA_BROKER = "kafka:9092"

KAFKA_TOPICS = {
    "nettools": "app.main.nettools",
    "audio_raw": "app.main.audio_raw",
    "audio_buffed": "app.main.audio_buffed",
    "audio_recognised": "app.main.audio_recognised",
    "audio_processed": "app.main.audio_processed",
}

KAFKA_CONSUMER_GROUPS = {
    # Group for net producers
    "nettools_group": "app.nettools.group",
    "audio_voicefixers_group": "app.main.audio.voicefixers.group",
    "audio_recognisers_group": "app.main.audio.recognisers.group",
    "audio_compositors_group": "app.main.audio.compositors.group",
}

ACTOR_GRACE_PERIOD = 20

NFS_MOUNT_POINT = "/mnt/nfs_share/"

'''
DOWNLOAD_FOLDER = NFS_MOUNT_POINT + "/downloads/archives/"
PICTURE_FOLDER = NFS_MOUNT_POINT + "/downloads/img/"
UPLOAD_FOLDER = NFS_MOUNT_POINT + "/uploads/img"
'''