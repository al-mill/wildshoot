<template>
  <form class="form" @submit.prevent="handleSubmit">
    <div
      class="drop-zone"
      :class="{ 'has-file': previewUrl, dragging: isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <img v-if="previewUrl" :src="previewUrl" alt="Preview" class="preview" />
      <div v-else class="placeholder">
        <span class="icon">📷</span>
        <p>Click or drag a photo here</p>
        <p class="hint">JPEG, PNG, WEBP — max 10 MB</p>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    />

    <label class="field">
      Location <span class="req">*</span>
      <input
        v-model="location"
        type="text"
        class="input"
        placeholder="e.g. Yosemite National Park, CA"
        required
      />
    </label>

    <label class="field">
      Description
      <textarea
        v-model="description"
        class="input"
        rows="3"
        placeholder="Optional caption…"
      />
    </label>

    <p v-if="error" class="msg error">{{ error }}</p>
    <p v-if="success" class="msg success">Photo uploaded!</p>

    <button
      type="submit"
      class="btn-submit"
      :disabled="!selectedFile || !location || isSubmitting"
    >
      {{ isSubmitting ? 'Uploading…' : 'Upload Photo' }}
    </button>
  </form>
</template>

<script setup lang="ts">
const emit = defineEmits<{ uploaded: [] }>();

const photos = usePhotosStore();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const location = ref('');
const description = ref('');
const isDragging = ref(false);
const isSubmitting = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) setFile(file);
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file?.type.startsWith('image/')) setFile(file);
}

function setFile(file: File) {
  if (file.size > 10 * 1024 * 1024) {
    error.value = 'File exceeds the 10 MB limit';
    return;
  }
  selectedFile.value = file;
  error.value = null;
  const reader = new FileReader();
  reader.onload = e => {
    previewUrl.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

async function handleSubmit() {
  if (!selectedFile.value || !location.value) return;
  isSubmitting.value = true;
  error.value = null;
  success.value = false;
  try {
    await photos.uploadPhoto(
      selectedFile.value,
      location.value,
      description.value
    );
    success.value = true;
    selectedFile.value = null;
    previewUrl.value = null;
    location.value = '';
    description.value = '';
    emit('uploaded');
  } catch {
    error.value = 'Upload failed — please try again';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 560px;
}

.drop-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  cursor: pointer;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--color-primary);
  background: #eff6ff;
}

.drop-zone.has-file {
  border-style: solid;
}

.placeholder {
  text-align: center;
  color: var(--color-text-muted);
  padding: 40px;
}

.icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 12px;
}

.hint {
  font-size: 0.8rem;
  margin-top: 6px;
}

.preview {
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  display: block;
}

.hidden {
  display: none;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.req {
  color: var(--color-danger);
}

.input {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 0.9rem;
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color 0.15s;
  resize: vertical;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.msg {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
}

.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: var(--color-danger);
}

.success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.btn-submit {
  padding: 10px 24px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.15s;
  align-self: flex-start;
}

.btn-submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
