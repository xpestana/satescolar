#!/usr/bin/env bash
# Apply S3 bucket CORS so the app can fetch logos/images directly when needed.
# Requires AWS CLI configured with permission s3:PutBucketCors on the bucket.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUCKET="${S3_BUCKET:-satescolar}"

echo "Applying CORS configuration to s3://${BUCKET}..."
aws s3api put-bucket-cors \
  --bucket "${BUCKET}" \
  --cors-configuration "file://${SCRIPT_DIR}/aws-s3-cors.json"

echo "Done. Current CORS rules:"
aws s3api get-bucket-cors --bucket "${BUCKET}"
