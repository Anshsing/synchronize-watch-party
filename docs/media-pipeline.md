# Media Pipeline

## Current Implementation
1. **Upload**: Users upload MP4 files directly to the Node.js server via `multer`.
2. **Serving**: Files are served statically via Express.

## Phase 5 Evolution (FFmpeg & HLS)
*Planned for future scaling:*
1. **Queue**: Uploads will be pushed to an AWS SQS queue.
2. **FFmpeg Processing**: Worker nodes will pick up jobs, transcoding MP4s into HLS chunks (m3u8).
3. **Storage**: Chunks will be uploaded to AWS S3 / Cloudflare R2.
4. **Delivery**: Video will be delivered via a CDN to prevent server bottlenecking.
5. **Failure Recovery**: Dead-letter queues will handle failed transcode jobs for manual retry.
