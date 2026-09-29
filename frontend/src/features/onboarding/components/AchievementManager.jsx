import React, { useState } from 'react';
import { Plus, Trash2, Award, Calendar, Tag } from 'lucide-react';
import { ACHIEVEMENT_CATEGORIES } from '../types/config';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { AchievementIcon } from '../../../components/AchievementIcon';
import './AchievementManager.css';

export function AchievementManager({ achievements = [], onChange }) {
  const [isAdding, setIsAdding] = useState(achievements.length === 0);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(ACHIEVEMENT_CATEGORIES[0]);
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title or name for your achievement.');
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

    // Reset form
    setTitle('');
    setDescription('');
    setYear('');
    setError('');
    setIsAdding(false);
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
            <label className="pf-form-label">Achievement Title *</label>
            <input
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
            {error && <span className="pf-form-error">{error}</span>}
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
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleAdd} icon={Plus}>
              Save Milestone
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
          <span>Add another achievement or milestone</span>
        </button>
      )}
    </div>
  );
}
