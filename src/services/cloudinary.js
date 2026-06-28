const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const uploadFolder = import.meta.env.VITE_CLOUDINARY_FOLDER || "our-memory-album";

export const cloudinaryIsConfigured = Boolean(cloudName && uploadPreset);

export async function uploadAlbumFile(file) {
  if (!cloudinaryIsConfigured) {
    throw new Error("Add Cloudinary cloud name and unsigned upload preset before uploading.");
  }

  const resourceType = file.type.startsWith("video/") ? "video" : "image";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", uploadFolder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Cloudinary upload failed.");
  }

  return {
    downloadUrl: payload.secure_url,
    publicId: payload.public_id,
    resourceType: payload.resource_type,
  };
}
