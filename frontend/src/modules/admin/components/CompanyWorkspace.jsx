import React, { useState } from 'react';
import { Building2, Archive, X, ImagePlus, Plus, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Modal } from '../../../components/ui/Modal';
import { DataRow } from '../../../components/ui/DataRow';
import { EmptyState } from '../../../components/ui/EmptyState';
import { adminApi } from '../adminApi';
import { Input, FilePicker, downloadCsvFile, parseCsv } from '../utils/adminHelpers';

/**
 * Companies workspace: full-width list with dividers; create/edit lives in a
 * right-side drawer opened from the page header, CSV import in a modal.
 */
export function CompanyWorkspace({ companies, loading, editCompany, archive }) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="pf-admin-list pf-admin-single">
      <div className="pf-admin-toolbar">
        <input type="search" className="pf-admin-filter pf-admin-filter--grow" placeholder="Search companies..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>
      {loading ? <EmptyState text="Loading companies..." /> : filteredCompanies.length === 0 ? (
        <EmptyState icon={Building2} title={searchTerm ? 'No companies found' : 'No companies yet'} text={searchTerm ? 'No hiring partner matches that search.' : 'Add your first hiring partner to start posting roles.'} />
      ) : filteredCompanies.map(company => (
        <DataRow
          key={company.id}
          icon={company.logoUrl
            ? <img className="pf-admin-company-logo" src={company.logoUrl} alt={`${company.name} logo`} />
            : <span className="pf-admin-company-logo-fallback"><Building2 size={18} /></span>}
          title={company.name}
          meta={company.website || 'No website added'}
          aside={
            <div className="pf-admin-item-actions">
              <Button variant="ghost" size="sm" onClick={() => editCompany(company)}>Edit</Button>
              <button className="pf-admin-icon-button" title="Archive company" aria-label={`Archive ${company.name}`} onClick={() => archive(company.id)}><Archive size={16} /></button>
            </div>
          }
        />
      ))}
    </div>
  );
}

/** Create/edit company form in a right-side drawer. */
export function CompanyFormDrawer({ open, saving, editingCompany, companyForm, setCompanyForm, logoFile, setLogoFile, update, onClose, onSubmit }) {
  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={editingCompany ? 'Edit company' : 'Add a company'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="pf-admin-company-form" loading={saving} icon={editingCompany ? Save : Plus}>{editingCompany ? 'Save changes' : 'Add company'}</Button>
        </>
      }
    >
      <form id="pf-admin-company-form" className="pf-admin-form" onSubmit={onSubmit}>
        <Input label="Company name" full>
          <input required value={companyForm.name} onChange={update(setCompanyForm, 'name')} placeholder="e.g. Acme Systems" />
        </Input>
        <Input label="Website" full>
          <input type="url" value={companyForm.website} onChange={update(setCompanyForm, 'website')} placeholder="https://company.com" />
        </Input>
        <Input label="Description" full>
          <textarea rows="4" value={companyForm.description} onChange={update(setCompanyForm, 'description')} placeholder="What the company does, products, engineering culture..." />
        </Input>
        <Input label="Company logo" full>
          <LogoDropZone logoFile={logoFile} setLogoFile={setLogoFile} companyForm={companyForm} setCompanyForm={setCompanyForm} />
        </Input>
      </form>
    </Drawer>
  );
}

function LogoDropZone({ logoFile, setLogoFile, companyForm, setCompanyForm }) {
  const [dragging, setDragging] = useState(false);
  const logoPreview = logoFile ? URL.createObjectURL(logoFile) : companyForm.logoUrl || null;
  const accept = file => { if (file && file.type.startsWith('image/')) setLogoFile(file); };
  const onDrop = e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files?.[0]); };
  const onDragOver = e => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  if (logoPreview) return (
    <div className="pf-admin-logo-preview">
      <img src={logoPreview} alt="Logo preview" />
      <button type="button" className="pf-admin-logo-remove" onClick={() => { setLogoFile(null); setCompanyForm(v => ({ ...v, logoUrl: '', logoPublicId: '' })); }} aria-label="Remove logo"><X size={14} /></button>
    </div>
  );
  return (
    <label className={`pf-admin-logo-upload${dragging ? ' is-dragging' : ''}`} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
      <ImagePlus size={20} />
      <span className="pf-admin-logo-upload__text">{dragging ? 'Drop image here' : 'Drag & drop or click to choose'}</span>
      <span className="pf-file-picker pf-file-picker--subtle">Choose file<input type="file" accept="image/*" onChange={e => accept(e.target.files?.[0])} /></span>
    </label>
  );
}

/** CSV import for companies, opened from a modal. */
export function CompanyImport({ open, saving, reload, onClose }) {
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importSummary, setImportSummary] = useState(null);

  const readImport = event => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ''));
        const errors = rows.flatMap((row, index) => (row.name ? [] : [{ row: index + 2, message: 'Company name is required.' }]));
        setImportRows(rows); setImportErrors(errors); setImportSummary(null);
      } catch (err) { setImportRows([]); setImportErrors([{ row: 0, message: err.message }]); }
    };
    reader.readAsText(file);
  };

  const importCompanies = async () => {
    if (!importRows.length || importErrors.length) return;
    try {
      const result = await adminApi.importCompanies(importRows);
      setImportSummary(result.summary); setImportRows([]);
      await reload?.();
    } catch { /* surfaced via row errors */ }
  };

  const downloadTemplate = () => downloadCsvFile('pathfolio-companies-template.csv', 'name,website,description,logo_url\nAcme Systems,https://acme.example,Technology company,https://logo.example/acme.png\n');

  const close = () => { setImportRows([]); setImportErrors([]); setImportSummary(null); onClose(); };

  return (
    <Modal isOpen={open} onClose={close} title="Import companies from CSV"
      footer={<>
        <Button variant="ghost" onClick={close} disabled={saving}>Close</Button>
        <Button loading={saving} disabled={importRows.length === 0 || importErrors.length > 0} icon={Plus} onClick={importCompanies}>Import {importRows.length} companies</Button>
      </>}>
      <p className="pf-admin-import-copy">Upload a CSV, review the rows, then import valid companies in one step.</p>
      <div className="pf-admin-import-actions">
        <FilePicker accept=".csv,text/csv" onFile={readImport}>Choose CSV file</FilePicker>
        <Button variant="secondary" size="sm" onClick={downloadTemplate}>Download template</Button>
      </div>
      {importRows.length > 0 && (
        <div className="pf-admin-import-preview">
          <strong>Preview: {importRows.length} rows</strong>
          {importRows.slice(0, 5).map((row, index) => <span key={index}>{row.name || 'Missing name'}{row.website ? ` · ${row.website}` : ''}{(row.logo_url || row.logourl) ? ' · 🖼️' : ''}</span>)}
          {importRows.length > 5 && <small>Showing first 5 rows</small>}
        </div>
      )}
      {importErrors.length > 0 && <div className="pf-admin-import-errors">{importErrors.map((item, index) => <span key={index}>Row {item.row}: {item.message}</span>)}</div>}
      {importSummary && <div className="pf-admin-import-summary"><b>Imported {importSummary.imported}</b><span>{importSummary.duplicates} duplicates skipped</span><span>{importSummary.errors.length} validation errors</span></div>}
    </Modal>
  );
}
