KAFKA_BROKER = "kafka:9092"

KAFKA_TOPICS = {
    "nettools": "app.main.nettools",
}

KAFKA_CONSUMER_GROUPS = {
    # Group for net producers
    "nettools_group_p": "app.nettools.group.producer",
}

ACTOR_GRACE_PERIOD = 20

NFS_MOUNT_POINT = "/mnt/nfs_share"

'''
DOWNLOAD_FOLDER = NFS_MOUNT_POINT + "/downloads/archives/"
PICTURE_FOLDER = NFS_MOUNT_POINT + "/downloads/img/"
UPLOAD_FOLDER = NFS_MOUNT_POINT + "/uploads/img"
'''