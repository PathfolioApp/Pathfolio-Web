import React from 'react';
import { Building2, Calendar, MapPin, Globe, ExternalLink, Eye, Award, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { PdfIcon } from '../components/PdfIcon';
import { formatInternshipTimeline } from '../utils/internshipUtils';
import './InternshipStyles.css';

export function InternshipDetailModal({ isOpen, onClose, internship }) {
  if (!internship) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Internship Details"
      maxWidth="800px"
      footer={
        <button type="button" className="pf-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="pf-detail-modal-body">
        {/* Header Hero */}
        <div className="pf-detail-hero">
          {internship.companyLogo ? (
            <img src={internship.companyLogo} alt={internship.companyName} className="pf-company-logo" style={{ width: 56, height: 56 }} />
          ) : (
            <div className="pf-company-monogram" style={{ width: 56, height: 56, fontSize: '1.3rem' }}>
              {internship.companyName ? internship.companyName.slice(0, 2).toUpperCase() : <Building2 size={24} />}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 4px 0', fontFamily: 'var(--font-serif)', fontSize: '1.35rem', color: '#143521' }}>
              {internship.role}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem', color: '#2d4534' }}>{internship.companyName}</span>
              {internship.companyWebsite && (
                <a
                  href={internship.companyWebsite.startsWith('http') ? internship.companyWebsite : `https://${internship.companyWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-company-link"
                >
                  <Globe size={13} /> Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Badges & Timeline Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {internship.internshipType && (
            <span className="pf-internship-pill pf-internship-pill--type">
              {internship.internshipType}
            </span>
          )}
          {internship.workMode && (
            <span className="pf-internship-pill pf-internship-pill--mode">
              {internship.workMode}
            </span>
          )}
          {internship.currentlyWorking ? (
            <span className="pf-internship-pill pf-internship-pill--present">
              <span className="pf-pulse-dot" /> Currently Working (Present)
            </span>
          ) : (
            <span className="pf-internship-pill" style={{ background: '#f4f7f4', color: '#384d3e', border: '1px solid #dce5dc' }}>
              Completed
            </span>
          )}
        </div>

        {/* Dates & Location */}
        <div className="pf-internship-meta-row">
          <div className="pf-internship-meta-item">
            <Calendar size={14} />
            <span>{formatInternshipTimeline(internship.startDate, internship.endDate, internship.currentlyWorking)}</span>
          </div>
          {internship.location && (
            <div className="pf-internship-meta-item">
              <MapPin size={14} />
              <span>{internship.location}</span>
            </div>
          )}
        </div>

        {/* Overview */}
        {internship.description && (
          <div className="pf-detail-section">
            <span className="pf-detail-section-title">Overview</span>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#2b3f31', lineHeight: 1.55 }}>
              {internship.description}
            </p>
          </div>
        )}

        {/* Responsibilities */}
        {Array.isArray(internship.responsibilities) && internship.responsibilities.length > 0 && (
          <div className="pf-detail-section">
            <span className="pf-detail-section-title">Key Responsibilities & Contributions</span>
            <ul className="pf-internship-bullets">
              {internship.responsibilities.map((resp, i) => (
                <li key={i}>{resp}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Skills */}
        {Array.isArray(internship.skills) && internship.skills.length > 0 && (
          <div className="pf-detail-section">
            <span className="pf-detail-section-title">Technologies & Skills</span>
            <div className="pf-internship-tags">
              {internship.skills.map((skill, i) => (
                <span key={i} className="pf-internship-tag">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Projects / Work Done */}
        {(internship.projects?.projectName || internship.projectUrl || internship.projects?.projectUrl) && (
          <div className="pf-detail-section">
            <span className="pf-detail-section-title">Projects / Deliverables</span>
            <div className="pf-project-card-mini">
              {internship.projects?.projectName && (
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#163623' }}>
                  {internship.projects.projectName}
                </div>
              )}
              {internship.projects?.projectDescription && (
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#45584b', lineHeight: 1.45 }}>
                  {internship.projects.projectDescription}
                </p>
              )}
              {(internship.projects?.projectUrl || internship.projectUrl) && (
                <a
                  href={internship.projects?.projectUrl || internship.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-company-link"
                  style={{ alignSelf: 'flex-start', marginTop: '2px' }}
                >
                  <ExternalLink size={13} /> View project artifact / repository
                </a>
              )}
            </div>
          </div>
        )}

        {/* Verified Certificate */}
        {internship.certificate?.fileUrl && (
          <div className="pf-detail-section">
            <span className="pf-detail-section-title">Verified Certificate</span>
            <div className="pf-cert-uploader-box" style={{ background: '#f6fbf7', borderColor: '#cbe4d1' }}>
              <div className="pf-cert-file-info">
                <PdfIcon size={28} />
                <div>
                  <div className="pf-cert-filename">{internship.certificate.filename}</div>
                  <div className="pf-cert-filesize">
                    {internship.certificate.size ? `${(internship.certificate.size / 1024).toFixed(1)} KB · ` : ''}
                    Verified Document (PDF)
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={internship.certificate.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-cert-btn"
                >
                  <Eye size={13} /> View Document (PDF)
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
