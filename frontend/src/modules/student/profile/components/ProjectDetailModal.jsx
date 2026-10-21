import React from 'react';
import { Calendar, Globe, ExternalLink, Eye, Code2, Star, CheckCircle2, FileText, Layers, FolderGit2 } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { PdfIcon } from '../../../../components/ui/PdfIcon';
import { formatProjectTimeline } from '../utils/projectUtils';
import '../styles/ProjectStyles.css';

export function ProjectDetailModal({ isOpen, onClose, project, className = '' }) {
  if (!project) return null;

  const timelineStr = formatProjectTimeline(project.startDate, project.endDate, project.currentlyWorking);

  return (
    <Modal
      isOpen={isOpen}
      className={className}
      onClose={onClose}
      title="Project Details"
      maxWidth="780px"
      footer={
        <button type="button" className="pf-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="pf-detail-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Hero */}
        <div className="pf-project-detail-hero">
          {project.thumbnail ? (
            <img src={project.thumbnail} alt={project.projectName} className="pf-project-detail-thumb" />
          ) : (
            <div className="pf-project-detail-hero-icon">
              <FolderGit2 size={32} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: '#143521' }}>
                {project.projectName}
              </h3>
              {project.featured && (
                <span className="pf-project-pill pf-project-pill--featured">
                  <Star size={12} style={{ fill: '#f59e0b' }} /> Featured
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {project.projectType && (
                <span className="pf-project-pill pf-project-pill--type">
                  {project.projectType}
                </span>
              )}
              {project.currentlyWorking ? (
                <span className="pf-project-pill pf-project-pill--present">
                  <span className="pf-pulse-dot" /> Ongoing / In Active Development
                </span>
              ) : (
                <span className="pf-project-pill" style={{ background: '#f4f7f4', color: '#384d3e', border: '1px solid #dce5dc' }}>
                  Completed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Timeline & Quick Links */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '12px 16px', background: '#f8faf8', border: '1px solid #e2ebe2', borderRadius: '10px' }}>
          <div className="pf-project-meta-item">
            <Calendar size={15} style={{ color: '#1b4d3e' }} />
            <span style={{ fontWeight: 500, color: '#274330', fontSize: '0.9rem' }}>{timelineStr || 'Timeline not specified'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {project.projectUrl && (
              <a
                href={project.projectUrl.startsWith('http') ? project.projectUrl : `https://${project.projectUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pf-btn-subtle"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', padding: '5px 12px' }}
              >
                <Globe size={14} /> Live Demo <ExternalLink size={12} />
              </a>
            )}
            {project.repoUrl && (
              <a
                href={project.repoUrl.startsWith('http') ? project.repoUrl : `https://${project.repoUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pf-btn-subtle"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', padding: '5px 12px' }}
              >
                <Code2 size={14} /> View Code <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {/* Overview */}
        {project.description && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1b4d3e' }}>
              Project Overview
            </span>
            <p style={{ margin: 0, fontSize: '0.94rem', color: '#273c2e', lineHeight: 1.6 }}>
              {project.description}
            </p>
          </div>
        )}

        {/* Key Contributions */}
        {Array.isArray(project.contributions) && project.contributions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1b4d3e' }}>
              Key Contributions & Architecture
            </span>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {project.contributions.map((bullet, idx) => (
                <li key={idx} style={{ fontSize: '0.92rem', color: '#29402f', lineHeight: 1.55 }}>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Technologies / Skills */}
        {Array.isArray(project.technologies) && project.technologies.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1b4d3e' }}>
              Technologies & Frameworks
            </span>
            <div className="pf-project-tags">
              {project.technologies.map((tech, idx) => (
                <span key={idx} className="pf-project-tag" style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Document attachment */}
        {project.document && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 18px', background: '#f5f9f5', border: '1px solid #d3e2d4', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1b4d3e' }}>
              Documentation & Report
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <PdfIcon size={28} />
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#183a24', display: 'block' }}>
                    {project.document.filename || 'Project Report.pdf'}
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#57705e' }}>
                    {project.document.size ? `${(project.document.size / 1024).toFixed(1)} KB · ` : ''}PDF Document
                  </span>
                </div>
              </div>
              {project.document.fileUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    href={project.document.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pf-doc-btn"
                  >
                    <Eye size={13} /> View Document
                  </a>
                  {project.document.downloadUrl && (
                    <a
                      href={project.document.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pf-doc-btn"
                    >
                      Download
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
