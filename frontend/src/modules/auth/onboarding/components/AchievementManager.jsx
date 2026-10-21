import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { ACHIEVEMENT_CATEGORIES } from '../types/config';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { AchievementIcon } from '../../../../components/ui/AchievementIcon';
import './AchievementManager.css';

export const AchievementManager = forwardRef(function AchievementManager({ achievements = [], onChange }, ref) {
  const [isAdding, setIsAdding] = useState(achievements.length === 0);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(ACHIEVEMENT_CATEGORIES[0]);
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const draftPromptRef = useRef(null);
  const titleInputRef = useRef(null);
  const hasDraft = isAdding && Boolean(
    title.trim() || year.trim() || description.trim() || category !== ACHIEVEMENT_CATEGORIES[0]
  );

  useImperativeHandle(ref, () => ({
    requestNavigation(action) {
      if (hasDraft) setPendingNavigation(() => action);
      else action();
    }
  }));

  useEffect(() => {
    if (pendingNavigation) draftPromptRef.current?.focus();
  }, [pendingNavigation]);

  const resetDraft = () => {
    setTitle('');
    setDescription('');
    setYear('');
    setCategory(ACHIEVEMENT_CATEGORIES[0]);
    setError('');
    setIsAdding(false);
    setPendingNavigation(null);
  };

  const keepEditing = () => {
    setPendingNavigation(null);
    titleInputRef.current?.focus();
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title or name for your achievement.');
      titleInputRef.current?.focus();
      return;
    }

    const newItem = {
      id: `ach_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: title.trim(),
      category,
      year: year.trim(),
      description: description.trim()
    };

    onChange([...achievements, newItem]);

    resetDraft();
    pendingNavigation?.();
  };

  const handleRemove = (id) => {
    onChange(achievements.filter(a => a.id !== id));
  };

  return (
    <div className="pf-achievement-mgr animate-fade-in">
      {/* List of existing achievements */}
      {achievements.length > 0 && (
        <div className="pf-achievement-list">
          {achievements.map((item) => (
            <div key={item.id} className="pf-achievement-card">
              <AchievementIcon category={item.category} size={20} variant="badge" />
              <div className="pf-achievement-card__content">
                <div className="pf-achievement-card__header">
                  <h4 className="pf-achievement-card__title">{item.title}</h4>
                  <Badge variant="sage" size="sm">{item.category}</Badge>
                </div>
                {item.description && (
                  <p className="pf-achievement-card__desc">{item.description}</p>
                )}
                {item.year && (
                  <div className="pf-achievement-card__meta">
                    <Calendar size={13} />
                    <span>{item.year}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="pf-achievement-card__delete"
                aria-label={`Remove achievement ${item.title}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Achievement Form */}
      {isAdding ? (
        <div className="pf-achievement-form-card">
          <h4 className="pf-achievement-form__heading">Add a milestone or achievement</h4>
          
          <div className="pf-form-group">
            <label htmlFor="milestone-title" className="pf-form-label">Milestone title *</label>
            <input
              id="milestone-title"
              ref={titleInputRef}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "milestone-title-error" : undefined}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. 1st Place at Regional Hackathon, Dean's List, High School Valedictorian"
              className={`pf-input ${error ? 'is-error' : ''}`}
              maxLength={100}
            />
            {error && <span id="milestone-title-error" className="pf-form-error" role="alert">{error}</span>}
          </div>

          <div className="pf-form-row">
            <div className="pf-form-group" style={{ flex: 2 }}>
              <label className="pf-form-label">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="pf-select"
              >
                {ACHIEVEMENT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="pf-form-group" style={{ flex: 1 }}>
              <label className="pf-form-label">Year / Date (Optional)</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2023 or Grade 12"
                className="pf-input"
                maxLength={20}
              />
            </div>
          </div>

          <div className="pf-form-group">
            <label className="pf-form-label">Brief Summary (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any context, role, or impact..."
              rows={2}
              className="pf-textarea"
              maxLength={280}
            />
          </div>

          <div className="pf-achievement-form__actions">
            {achievements.length > 0 && (
              <Button variant="ghost" size="sm" onClick={resetDraft}>
                Cancel
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleAdd} icon={Plus}>
              Save milestone
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="pf-achievement-add-trigger"
        >
          <Plus size={18} />
          <span>{achievements.length > 0 ? 'Add another milestone' : 'Add a milestone'}</span>
        </button>
      )}
      {pendingNavigation && (
        <div className="pf-milestone-draft-prompt" ref={draftPromptRef} tabIndex={-1} role="region" aria-labelledby="milestone-draft-title">
          <h4 id="milestone-draft-title">You have an unsaved milestone</h4>
          <p>Save this milestone or discard the draft before leaving this step.</p>
          <div className="pf-milestone-draft-prompt__actions">
            <Button size="sm" onClick={handleAdd}>Save milestone</Button>
            <Button variant="secondary" size="sm" onClick={() => { const action = pendingNavigation; resetDraft(); action(); }}>Discard draft</Button>
            <Button variant="ghost" size="sm" onClick={keepEditing}>Keep editing</Button>
          </div>
        </div>
      )}
    </div>
  );
});
