import { FileUp as FileUpIcon } from 'lucide-react';
import { adminApi } from '../adminApi';

/** Small form primitives shared by admin workspaces. */
export function Input({ label, children, full = false }) {
  return <label className={full ? 'pf-admin-full-field' : ''}>{label}{children}</label>;
}

export function PanelHeading({ eyebrow, title, action }) {
  return (
    <div className="pf-admin-panel-heading">
      <div><p className="pf-admin-eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      {action}
    </div>
  );
}

export function Empty({ text }) {
  return <p className="pf-admin-empty">{text}</p>;
}

export function FilePicker({ accept, onFile, children, chosenName, subtle = false }) {
  return (
    <>
      <span className={`pf-file-picker${subtle ? ' pf-file-picker--subtle' : ''}`}>
        <FileUpIcon size={15} />{children}
        <input type="file" accept={accept} onChange={event => { onFile(event); event.target.value = ''; }} />
      </span>
      {chosenName && <span className="pf-admin-import-chosen">{chosenName}</span>}
    </>
  );
}

/** Direct-to-Cloudinary upload using the admin signature endpoint. */
export async function uploadToCloudinary(file) {
  const signed = await adminApi.uploadSignature();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signed.apiKey);
  formData.append('timestamp', signed.timestamp);
  formData.append('folder', signed.folder);
  if (signed.accessMode) formData.append('access_mode', signed.accessMode);
  formData.append('signature', signed.signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`, { method: 'POST', body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Unable to upload ${file.name}.`);
  return { name: file.name, url: data.secure_url, publicId: data.public_id, type: file.type || 'application/octet-stream' };
}

/** Minimal RFC-4180-ish CSV parser used by the admin import flows. */
export function parseCsv(text) {
  const rows = []; let row = []; let value = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]; const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; value = '';
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(header => header.toLowerCase().replace(/\s+/g, ''));
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

export const formatISTDate = dateString => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date(dateString));
};

/** Triggers a client-side CSV download. */
export function downloadCsvFile(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
