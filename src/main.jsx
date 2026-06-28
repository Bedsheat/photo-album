import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Heart,
  ImagePlus,
  LockKeyhole,
  LogOut,
  Moon,
  Shuffle,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  addAlbumItem,
  deleteAlbumItem,
  firebaseIsConfigured,
  getAlbumItems,
  signInAlbum,
  signOutAlbum,
} from "./services/firebase";
import { cloudinaryIsConfigured, uploadAlbumFile } from "./services/cloudinary";
import "./styles.css";

const STORAGE_KEY = "our-album-unlocked";
const DARK_MODE_KEY = "our-album-dark-mode";
let albumAudio;

function getAlbumAudio() {
  if (!albumAudio) {
    albumAudio = new Audio("/audio/login-theme.mp3");
    albumAudio.loop = true;
    albumAudio.preload = "auto";
    albumAudio.volume = 0.25;
  }

  return albumAudio;
}

function App() {
  const [isUnlocked, setIsUnlocked] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === "true",
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicNeedsStart, setMusicNeedsStart] = useState(false);
  const [status, setStatus] = useState("");
  const [randomItem, setRandomItem] = useState(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem(DARK_MODE_KEY) === "true",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem(DARK_MODE_KEY, darkMode ? "true" : "false");
  }, [darkMode]);

  useEffect(() => {
    if (!isUnlocked) return;

    let isMounted = true;
    setStatus(firebaseIsConfigured ? "Loading album..." : "");

    getAlbumItems()
      .then((albumItems) => {
        if (isMounted) {
          setItems(albumItems);
          setStatus(firebaseIsConfigured ? "" : "Add Firebase details to save your real album.");
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatus("Could not load Firebase items yet. Check your Firebase setup.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isUnlocked]);

  const photoCount = useMemo(
    () => items.filter((item) => item.type === "photo").length,
    [items],
  );

  const videoCount = items.length - photoCount;

  async function handleLogin(event) {
    event.preventDefault();
    setAuthenticating(true);
    setLoginError("");
    const audioStart = playAlbumMusic();

    try {
      await signInAlbum(passwordInput);
      sessionStorage.setItem(STORAGE_KEY, "true");
      setIsUnlocked(true);
      setPasswordInput("");
      await audioStart;
    } catch (error) {
      stopAlbumMusic();
      setLoginError("Tch tch tch... the real one would know ᗜ⩊ᗜ");
    } finally {
      setAuthenticating(false);
    }
  }

  async function handleLogout() {
    await signOutAlbum();
    stopAlbumMusic();
    sessionStorage.removeItem(STORAGE_KEY);
    setIsUnlocked(false);
    setItems([]);
    closeUploadModal();
    setRandomItem(null);
    setConfirmDeleteItem(null);
  }

  async function handleDownload(item) {
    try {
      const response = await fetch(item.downloadUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = getDownloadName(item);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      setStatus("Download failed. Try right-clicking the image and saving manually.");
    }
  }

  async function playAlbumMusic() {
    const audio = getAlbumAudio();

    try {
      audio.muted = false;
      audio.currentTime = audio.currentTime || 0;
      await audio.play();
      setMusicPlaying(true);
      setMusicNeedsStart(false);
      return true;
    } catch (error) {
      setMusicPlaying(false);
      setMusicNeedsStart(true);
      return false;
    }
  }

  function pauseAlbumMusic() {
    const audio = getAlbumAudio();

    audio.pause();
    setMusicPlaying(false);
    setMusicNeedsStart(false);
  }

  function stopAlbumMusic() {
    const audio = getAlbumAudio();

    audio.pause();
    audio.currentTime = 0;
    setMusicPlaying(false);
    setMusicNeedsStart(false);
  }

  async function toggleAlbumMusic() {
    if (musicPlaying) {
      pauseAlbumMusic();
      return;
    }

    const didPlay = await playAlbumMusic();
    if (!didPlay) {
      setStatus("Tap Start our song once and the album music will play.");
    }
  }

  function handleFilePick(event) {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles((currentFiles) => [
      ...currentFiles,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
      })),
    ]);
    event.target.value = "";
  }

  function updateCaption(id, caption) {
    setSelectedFiles((currentFiles) =>
      currentFiles.map((entry) => (entry.id === id ? { ...entry, caption } : entry)),
    );
  }

  function removeSelectedFile(id) {
    setSelectedFiles((currentFiles) => {
      const removed = currentFiles.find((entry) => entry.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return currentFiles.filter((entry) => entry.id !== id);
    });
  }

  function closeUploadModal() {
    setUploadModalOpen(false);
    setSelectedFiles((currentFiles) => {
      currentFiles.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
      return [];
    });
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!firebaseIsConfigured) {
      setStatus("Add Firebase environment values before saving captions.");
      return;
    }

    if (!cloudinaryIsConfigured) {
      setStatus("Add Cloudinary cloud name and upload preset before uploading.");
      return;
    }

    if (!selectedFiles.length) {
      setStatus("Pick at least one photo or video first.");
      return;
    }

    setUploading(true);
    setStatus("Saving our memory...");

    try {
      const uploadedItems = [];

      for (const entry of selectedFiles) {
        const uploaded = await uploadAlbumFile(entry.file);
        const item = await addAlbumItem({
          caption: entry.caption.trim(),
          downloadUrl: uploaded.downloadUrl,
          fileName: entry.file.name,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
          type: entry.file.type.startsWith("video/") ? "video" : "photo",
        });
        uploadedItems.push(item);
        URL.revokeObjectURL(entry.previewUrl);
      }

      setItems((currentItems) => [...uploadedItems, ...currentItems]);
      setSelectedFiles([]);
      setUploadModalOpen(false);
      setStatus("Saved to our album.");
    } catch (error) {
      setStatus(error.message || "Upload failed. Check Firebase permissions.");
    } finally {
      setUploading(false);
    }
  }

  function openRandomItem() {
    if (!items.length) {
      setStatus("Add one of our memories first, then random can surprise us.");
      return;
    }

    setRandomItem(items[Math.floor(Math.random() * items.length)]);
  }

  function openRelativeMemory(direction) {
    if (!randomItem || !items.length) return;

    const currentIndex = items.findIndex((item) => item.id === randomItem.id);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (safeIndex + direction + items.length) % items.length;
    setRandomItem(items[nextIndex]);
  }

  function getDownloadName(item) {
    if (item.fileName) return item.fileName;
    const extension = item.type === "video" ? "mp4" : "jpg";
    return `our-memory.${extension}`;
  }

  async function confirmDelete() {
    if (!confirmDeleteItem) return;

    setDeletingId(confirmDeleteItem.id);
    setStatus("Removing this from our album...");

    try {
      await deleteAlbumItem(confirmDeleteItem.id);
      setItems((currentItems) => currentItems.filter((item) => item.id !== confirmDeleteItem.id));
      if (randomItem?.id === confirmDeleteItem.id) {
        setRandomItem(null);
      }
      setConfirmDeleteItem(null);
      setStatus("Removed from our album.");
    } catch (error) {
      setStatus(error.message || "Could not delete this memory.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <>
      {!isUnlocked ? (
      <main className="auth-screen">
        <button
          className="icon-button dark-toggle-auth"
          type="button"
          onClick={() => setDarkMode((d) => !d)}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="brand-mark">
            <Heart size={34} />
          </div>
          <p className="eyebrow">You know who this is for. Get out if it ain't you ╰（‵□′）╯</p>
          <h1 id="auth-title">A way to remember our time.</h1>
          <form onSubmit={handleLogin} className="auth-form">
            <label htmlFor="album-password">Password is the song that I dedicated to you on our first month (no caps, with spaces)</label>
            <div className="password-row">
              <LockKeyhole size={20} />
              <input
                id="album-password"
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="Enter your password"
                autoFocus
              />
            </div>
            {loginError ? <p className="form-error">{loginError}</p> : null}
            <button
              type="submit"
              className="primary-button"
              disabled={authenticating}
              onClick={playAlbumMusic}
              onPointerDown={playAlbumMusic}
            >
              <Sparkles size={18} />
              {authenticating ? "Opening..." : "Open album"}
            </button>
          </form>
        </section>
      </main>
      ) : (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">For when you want to reminisce</p>
          <h1>Me and my dearest</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={toggleAlbumMusic}
            aria-label={musicPlaying ? "Pause music" : "Resume music"}
          >
            {musicPlaying ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button className="icon-button" type="button" onClick={handleLogout} aria-label="Log out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <section className="hero-band">
        <div className="hero-copy">
          <p>A private place for the photos, videos, and small pieces of forever that belong to only us.</p>
          <div className="stats-row">
            <span><Camera size={18} /> {photoCount} photos</span>
            <span><Film size={18} /> {videoCount} videos</span>
          </div>
        </div>
        <button type="button" className="random-button" onClick={openRandomItem}>
          <Shuffle size={20} />
          Open a random memory
        </button>
      </section>

      {musicNeedsStart && !musicPlaying ? (
        <section className="music-nudge" aria-label="Start music">
          <div>
            <p className="eyebrow">Our song is waiting</p>
            <h2>Browser said "ask nicely first."</h2>
          </div>
          <button type="button" className="primary-button" onClick={playAlbumMusic}>
            <Volume2 size={18} />
            Start our song
          </button>
        </section>
      ) : null}

      <section className="note-strip" aria-label="Album note">
        <Heart size={18} />
        <p>Try putting the volume a bit up too hehehe.</p>
      </section>

      <section className="gallery-section" aria-labelledby="gallery-title">
        <div className="section-heading">
          <div>
            <h2 id="gallery-title">Our Memories</h2>
            <p>{items.length ? `${items.length} memories saved` : "Nothing saved yet"}</p>
          </div>
          <button type="button" className="primary-button" onClick={() => setUploadModalOpen(true)}>
            <ImagePlus size={18} />
            Add memory
          </button>
        </div>

        {items.length ? (
          <div className="gallery-grid">
            {items.map((item) => (
              <AlbumCard
                key={item.id}
                item={item}
                onDelete={() => setConfirmDeleteItem(item)}
                onOpen={() => setRandomItem(item)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-gallery">
            <Heart size={30} />
            <p>Our first saved memory will appear here.</p>
          </div>
        )}
      </section>

      {randomItem ? (
        <div className="lightbox" role="dialog" aria-modal="true">
          <button
            className="lightbox-close"
            type="button"
            onClick={() => setRandomItem(null)}
            aria-label="Close"
          >
            <X size={22} />
          </button>
          {items.length > 1 ? (
            <>
              <button
                className="lightbox-arrow lightbox-arrow-left"
                type="button"
                onClick={() => openRelativeMemory(-1)}
                aria-label="Previous memory"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                className="lightbox-arrow lightbox-arrow-right"
                type="button"
                onClick={() => openRelativeMemory(1)}
                aria-label="Next memory"
              >
                <ChevronRight size={26} />
              </button>
            </>
          ) : null}
          <div className="lightbox-content">
            <MediaPreview item={randomItem} />
            {randomItem.caption?.trim() ? <p>{randomItem.caption}</p> : null}
            <div className="lightbox-actions">
              <button
                type="button"
                className="lightbox-download"
                onClick={() => handleDownload(randomItem)}
              >
                <Download size={18} />
                Download
              </button>
              {items.length > 1 ? (
                <button type="button" className="lightbox-random" onClick={openRandomItem}>
                  <Shuffle size={18} />
                  Open another random memory
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {uploadModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-close-row">
            <button
              className="modal-close"
              type="button"
              onClick={closeUploadModal}
              aria-label="Close upload"
              disabled={uploading}
            >
              <X size={20} />
            </button>
          </div>
          <section className="upload-modal" aria-labelledby="upload-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Add to us</p>
                <h2 id="upload-title">New memory</h2>
              </div>
              <label className="file-picker">
                <ImagePlus size={19} />
                Choose files
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFilePick}
                />
              </label>
            </div>

            <form onSubmit={handleUpload}>
              {selectedFiles.length ? (
                <div className="draft-grid">
                  {selectedFiles.map((entry) => (
                    <article className="draft-card" key={entry.id}>
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => removeSelectedFile(entry.id)}
                        aria-label={`Remove ${entry.file.name}`}
                        disabled={uploading}
                      >
                        <X size={16} />
                      </button>
                      <MediaPreview item={{ ...entry, downloadUrl: entry.previewUrl, type: entry.file.type.startsWith("video/") ? "video" : "photo" }} />
                      <label>
                        Caption
                        <textarea
                          value={entry.caption}
                          onChange={(event) => updateCaption(entry.id, event.target.value)}
                          placeholder="What should we remember about this?"
                          rows={3}
                        />
                      </label>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-upload">
                  <Upload size={28} />
                  <p>Choose photos or videos from us, then write a caption if you want &lt;3.</p>
                </div>
              )}

              <div className="upload-actions">
                {status ? <p className="status-text">{status}</p> : <span />}
                <button type="submit" className="primary-button" disabled={uploading || !selectedFiles.length}>
                  <Upload size={18} />
                  {uploading ? "Uploading..." : "Upload selected"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {confirmDeleteItem ? (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <section className="confirm-panel" aria-labelledby="delete-title">
            <h2 id="delete-title">Aww, sure you wanna delete this? I'm pretty sure this is a cute photo.</h2>
            <p>
              This removes it from our album view. But who knows even if you delete it, it might be still lurking somewhere muahahaha ╰(*°▽°*)╯
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmDeleteItem(null)}
                disabled={Boolean(deletingId)}
              >
                Keep it
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirmDelete}
                disabled={Boolean(deletingId)}
              >
                <Trash2 size={18} />
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
      )}
    </>
  );
}

function AlbumCard({ item, onDelete, onOpen }) {
  return (
    <article className="album-card">
      <button className="album-open" type="button" onClick={onOpen}>
        <MediaPreview item={item} />
        {item.caption?.trim() ? <span>{item.caption}</span> : null}
      </button>
      <button className="album-delete" type="button" onClick={onDelete} aria-label="Delete memory">
        <Trash2 size={17} />
      </button>
    </article>
  );
}

function MediaPreview({ item }) {
  if (item.type === "video") {
    return <video src={item.downloadUrl} controls muted playsInline />;
  }

  return <img src={item.downloadUrl} alt={item.caption || item.fileName || "Album memory"} />;
}

createRoot(document.getElementById("root")).render(<App />);
