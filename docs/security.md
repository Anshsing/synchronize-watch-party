# Security & Access Control

## Input Sanitization
To prevent NoSQL Injection and Cross-Site Scripting (XSS):
- All incoming HTTP request payloads are sanitized using `express-mongo-sanitize` to remove malicious `$`, `.`, or operational modifiers.
- Socket inputs (like usernames and chat messages) are stripped of HTML tags and special characters before being broadcast to peers.
- `helmet` is utilized to secure HTTP headers.

## Rate Limiting
To prevent abuse and DDoS attacks, API endpoints (`/api/*`) are rate-limited using `express-rate-limit`. Currently, a single IP can make a maximum of 100 requests per 15-minute window.

## Upload Validation
The backend uses `multer` to handle multipart/form-data. Filenames are stripped of special characters to prevent directory traversal. In a production setting, file MIME types are checked to ensure only valid `.mp4` files are accepted.

## Access Control
- **Host Tokens**: When a room is created, a unique `hostToken` is generated and stored in the Host's `localStorage` and MongoDB.
- **Action Verification**: The backend strictly verifies the `hostToken` before allowing `kick-user` or `toggle-controls` actions.

## Room Link Expiration
When the final participant leaves a room (or the host terminates the session), the room is automatically flagged as `isBlacklisted` in MongoDB. This ensures that room URLs are one-time use and cannot be rejoined after the session ends.

## Private Media
Video URLs are only exposed to users who successfully join the room. (In future updates, signed S3 URLs will be used for time-limited access).
