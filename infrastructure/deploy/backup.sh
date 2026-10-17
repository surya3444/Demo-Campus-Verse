#!/bin/bash
set -e

# ===========================================
# Campus Verse - Database Backup Script
# Add to cron: 0 2 * * * /opt/campusverse/infrastructure/deploy/backup.sh
# ===========================================

APP_DIR="/opt/campusverse"
BACKUP_DIR="/opt/campusverse/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

echo ">>> Starting backup at $(date)"

# Create backup directory
mkdir -p $BACKUP_DIR

# MongoDB backup
echo ">>> Backing up MongoDB..."
docker exec campusverse-mongo mongodump \
  --archive=/data/db/backup_$DATE.archive \
  --gzip \
  --db=campus_verse

# Copy backup from container
docker cp campusverse-mongo:/data/db/backup_$DATE.archive $BACKUP_DIR/

# Remove backup from container
docker exec campusverse-mongo rm /data/db/backup_$DATE.archive

# Redis backup (RDB snapshot)
echo ">>> Backing up Redis..."
docker exec campusverse-redis redis-cli BGSAVE
sleep 5
docker cp campusverse-redis:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Clean old backups
echo ">>> Cleaning backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -name "backup_*.archive" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "redis_*.rdb" -mtime +$RETENTION_DAYS -delete

# List current backups
echo ""
echo ">>> Current backups:"
ls -lh $BACKUP_DIR

echo ""
echo ">>> Backup completed at $(date)"

# Optional: Upload to S3 (uncomment and configure)
# aws s3 cp $BACKUP_DIR/backup_$DATE.archive s3://your-backup-bucket/mongodb/
# aws s3 cp $BACKUP_DIR/redis_$DATE.rdb s3://your-backup-bucket/redis/
