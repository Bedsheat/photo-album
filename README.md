# Our Little Album

A private React photo and video album for the two of you. It supports:

- password-only entry
- Cloudinary uploads for photos and videos
- Firestore metadata with captions
- multi-file upload with a caption per file
- a random memory opener

## Run Locally

```bash
npm.cmd install
npm.cmd run dev
```

For local-only testing, keep `.env.local` with:

```bash
VITE_ALBUM_PASSWORD=your-local-test-password
```

## Firebase Setup

1. Create a Firebase project.
2. Enable Firestore Database.
3. Enable Authentication, then enable the Email/Password provider.
4. Create one user in Authentication, for example `album-owner@example.com`, with the password you want to type into the app.
5. Copy `.env.example` to `.env.local` and fill in your Firebase web app values.
6. Set `VITE_FIREBASE_AUTH_EMAIL` to that one Auth user's email.

With Firebase configured, the app still asks only for a password. The email stays hidden in `.env.local`, and the password is checked by Firebase Auth.

## Firestore Rules

Replace `YOUR_FIREBASE_AUTH_UID` with the UID of the one Auth user you created.
If delete says "Missing or insufficient permissions", your deployed Firestore rules probably do not include `delete` yet. Publish these rules:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /albumItems/{itemId} {
      allow read, create, delete: if request.auth != null
        && request.auth.uid == "YOUR_FIREBASE_AUTH_UID";
      allow update: if false;
    }
  }
}
```

## Cloudinary Setup

Cloudinary stores the actual photo and video files. Firestore stores captions and the Cloudinary URLs.

1. Create a Cloudinary account.
2. Go to Settings > Upload.
3. Add an unsigned upload preset.
4. Set the preset signing mode to Unsigned.
5. Restrict the preset if you want, for example set an upload folder like `our-memory-album`.
6. Copy your cloud name and preset name into `.env.local`.

```bash
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-upload-preset
VITE_CLOUDINARY_FOLDER=our-memory-album
```

Unsigned presets are visible to the browser, so keep the preset constrained in Cloudinary. For a private personal app, the Firebase password gate keeps ordinary visitors away from the upload screen, and Cloudinary preset restrictions keep the upload endpoint less open.
