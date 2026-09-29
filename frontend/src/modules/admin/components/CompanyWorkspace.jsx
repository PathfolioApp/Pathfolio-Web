import React, { useState } from 'react';
import { Building2, Archive, X, ImagePlus, Plus, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input, PanelHeading, Empty, FilePicker, downloadCsvFile } from '../utils/adminHelpers';

export function CompanyWorkspace({ companies, companyForm, setCompanyForm, editingCompany, resetCompany, saveCompany, loading, editCompany, archive, saving, update, logoFile, setLogoFile }) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <section className="pf-admin-workspace">
      <div className="pf-admin-panel">
        <PanelHeading eyebrow="Hiring partners" title={editingCompany ? 'Edit company' : 'Add a company'} action={editingCompany && <Button variant="ghost" size="sm" onClick={resetCompany}>Cancel</Button>} />
        <form className="pf-admin-form" onSubmit={saveCompany}>
          <Input label="Company name"><input required value={companyForm.name} onChange={update(setCompanyForm, 'name')} /></Input>
          <Input label="Website"><input type="url" value={companyForm.website} onChange={update(setCompanyForm, 'website')} placeholder="https://company.com" /></Input>
          <Input label="Description" full><textarea rows="4" value={companyForm.description} onChange={update(setCompanyForm, 'description')} /></Input>
          <Input label="Company logo" full><LogoDropZone logoFile={logoFile} setLogoFile={setLogoFile} companyForm={companyForm} setCompanyForm={setCompanyForm} /></Input>
          <Button type="submit" loading={saving} icon={editingCompany ? Save : Plus}>{editingCompany ? 'Save changes' : 'Add company'}</Button>
        </form>
      </div>
      <div className="pf-admin-list">
        <div className="pf-admin-panel-heading">
          <div><p className="pf-admin-eyebrow">Hiring partners</p><h2>Companies <span>{filteredCompanies.length}</span></h2></div>
          <input type="search" className="pf-admin-filter" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        {loading ? <Empty text="Loading companies..." /> : filteredCompanies.length === 0 ? <Empty text={searchTerm ? 'No companies found matching search.' : 'No companies yet. Add your first hiring partner.'} /> : filteredCompanies.map(company => (
          <article className="pf-admin-list-item" key={company.id}>
            <div className="pf-admin-company-info">
              {company.logoUrl ? <img className="pf-admin-company-logo" src={company.logoUrl} alt={`${company.name} logo`} /> : <span className="pf-admin-company-logo-fallback"><Building2 size={18} /></span>}
              <div><h3>{company.name}</h3><p>{company.website || 'No website added'}</p></div>
            </div>
            <div className="pf-admin-item-actions">
              <Button variant="ghost" size="sm" onClick={() => editCompany(company)}>Edit</Button>
              <button className="pf-admin-icon-button" title="Archive company" onClick={() => archive(company.id)}><Archive size={16} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
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
      <button type="button" className="pf-admin-logo-remove" onClick={() => { setLogoFile(null); setCompanyForm(v => ({ ...v, logoUrl: '', logoPublicId: '' })); }}><X size={14} /></button>
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

export function CompanyImport({ importRows, importErrors, importSummary, readImport, importCompanies, downloadTemplate, saving }) {
  return (
    <section className="pf-admin-import">
      <div>
        <PanelHeading eyebrow="Bulk directory setup" title="Import companies" />
        <p className="pf-admin-import-copy">Upload a CSV, review the rows, then import valid companies in one step.</p>
        <div className="pf-admin-import-actions">
          <FilePicker accept=".csv,text/csv" onFile={readImport}>Choose CSV file</FilePicker>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button>
        </div>
      </div>
      {importRows.length > 0 && (
        <div className="pf-admin-import-preview">
          <strong>Preview: {importRows.length} rows</strong>
          {importRows.slice(0, 5).map((row, index) => <span key={index}>{row.name || 'Missing name'}{row.website ? ` · ${row.website}` : ''}{(row.logo_url || row.logourl) ? ' · 🖼️' : ''}</span>)}
          {importRows.length > 5 && <small>Showing first 5 rows</small>}
        </div>
      )}
      {importErrors.length > 0 && <div className="pf-admin-import-errors">{importErrors.map((item, index) => <span key={index}>Row {item.row}: {item.message}</span>)}</div>}
      {importRows.length > 0 && <Button loading={saving} disabled={importErrors.length > 0} icon={Plus} onClick={importCompanies}>Import {importRows.length} companies</Button>}
      {importSummary && <div className="pf-admin-import-summary"><b>Imported {importSummary.imported}</b><span>{importSummary.duplicates} duplicates skipped</span><span>{importSummary.errors.length} validation errors</span></div>}
    </section>
  );
}
