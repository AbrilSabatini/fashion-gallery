const ENV = window.location.hostname === 'localhost' ? 'development' : 'production';

const CONFIG = {
  development: {
    API: 'http://localhost:8080/api/images'
  },
  production: {
    API: 'https://fashion-gallery-api-1.onrender.com'
  }
};

const API = CONFIG[ENV].API;

//  STATE 
let stagedFiles = [];

//  ELEMENTS 
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const stagingSection = document.getElementById('staging-section');
const stagingGrid = document.getElementById('staging-grid');
const stagingCount = document.getElementById('staging-count');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const uploadProgress = document.getElementById('upload-progress');
const galleryGrid = document.getElementById('gallery-grid');
const galleryCount = document.getElementById('gallery-count');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');

//  DRAG & DROP 
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) addToStaging(files);
});

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  if (files.length) addToStaging(files);
  fileInput.value = '';
});

//  STAGING 
function addToStaging(files) {
  stagedFiles = [...stagedFiles, ...files];
  renderStaging();
}

function renderStaging() {
  stagingGrid.innerHTML = '';
  stagingCount.textContent = stagedFiles.length;
  stagingSection.classList.toggle('visible', stagedFiles.length > 0);

  stagedFiles.forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'staging-item';
    item.innerHTML = `
        <img src="${url}" alt="${file.name}" loading="lazy">
        <button class="staging-remove" data-idx="${idx}" title="Remove">✕</button>
        <div class="staging-filename">${file.name}</div>
      `;
    stagingGrid.appendChild(item);
  });

  stagingGrid.querySelectorAll('.staging-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      stagedFiles.splice(idx, 1);
      renderStaging();
    });
  });
}

clearBtn.addEventListener('click', () => {
  stagedFiles = [];
  renderStaging();
});

//  SAVE 
saveBtn.addEventListener('click', async () => {
  if (!stagedFiles.length) return;

  saveBtn.disabled = true;
  uploadProgress.classList.add('visible');

  const formData = new FormData();
  stagedFiles.forEach(f => formData.append('files', f));

  try {
    const res = await fetch(`${API}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Error ${res.status}`);
    }

    const saved = await res.json();
    toast(`${saved.length} image${saved.length > 1 ? 's' : ''} saved`, 'success');
    stagedFiles = [];
    renderStaging();
    loadGallery();

  } catch (err) {
    toast(err.message || 'Failed to save images', 'error');
  } finally {
    saveBtn.disabled = false;
    uploadProgress.classList.remove('visible');
  }
});

//  GALLERY 
async function loadGallery() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const images = await res.json();
    renderGallery(images);
  } catch (err) {
    galleryGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-glyph">!</div>
        <div class="empty-state-text">Could not load gallery</div>
      </div>`;
  }
}

function renderGallery(images) {
  galleryCount.textContent = images.length ? `${images.length} piece${images.length > 1 ? 's' : ''}` : '';

  if (!images.length) {
    galleryGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-glyph">0</div>
        <div class="empty-state-text">Your archive is empty</div>
      </div>`;
    return;
  }

  galleryGrid.innerHTML = '';
  const isMobile = window.innerWidth <= 768;

  images.forEach(img => {
    const src = isMobile && img.thumbnailUrl ? img.thumbnailUrl : img.originalUrl;
    const date = img.uploadedAt ? new Date(img.uploadedAt).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }) : '';

    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
        <img src="${src}" alt="${img.filename || ''}" loading="lazy">
        <div class="gallery-overlay">
          <div class="gallery-meta">
            <div class="gallery-meta-name">${img.filename || 'Untitled'}</div>
            <div class="gallery-meta-date">${date}</div>
          </div>
        </div>
        <button class="gallery-delete" data-id="${img.id}" title="Delete">
          <img src="img/trash.svg" alt="delete" width="10" height="10">
        </button>
      `;

    item.querySelector('img').addEventListener('click', () => openLightbox(img.originalUrl));
    item.querySelector('.gallery-delete').addEventListener('click', e => {
      e.stopPropagation();
      deleteImage(img.id, item);
    });

    galleryGrid.appendChild(item);
  });
}

//  DELETE 
async function deleteImage(id, el) {
  el.style.opacity = '0.4';
  el.style.pointerEvents = 'none';

  try {
    const res = await fetch(API, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([id])
    });

    if (!res.ok) throw new Error(`Error ${res.status}`);

    el.style.transition = 'all 0.4s ease';
    el.style.transform = 'scale(0.9)';
    el.style.opacity = '0';
    setTimeout(() => { el.remove(); updateCount(); }, 400);
    toast('Image removed', 'success');

  } catch (err) {
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    toast('Failed to delete image', 'error');
  }
}

function updateCount() {
  const count = galleryGrid.querySelectorAll('.gallery-item').length;
  galleryCount.textContent = count ? `${count} piece${count > 1 ? 's' : ''}` : '';
  if (!count) renderGallery([]);
}

//  LIGHTBOX 
function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  lightboxImg.src = '';
}

//  TOAST 
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-dot"></span>${msg}`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

//  INIT 
loadGallery();