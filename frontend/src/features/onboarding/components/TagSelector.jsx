import React, { useState } from 'react';
import { Plus, X, Check, Search } from 'lucide-react';
import './TagSelector.css';

export function TagSelector({
  suggestedTags = [],
  selectedTags = [],
  onChange,
  placeholder = 'Add custom tag...',
  searchPlaceholder = 'Search suggestions...',
  allowCustom = true,
  maxTags = 15
}) {
  const [customInput, setCustomInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      if (selectedTags.length >= maxTags) return;
      onChange([...selectedTags, tag]);
    }
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selectedTags.includes(trimmed) && selectedTags.length < maxTags) {
      onChange([...selectedTags, trimmed]);
    }
    setCustomInput('');
  };

  const handleRemoveTag = (tag) => {
    onChange(selectedTags.filter(t => t !== tag));
  };

  const filteredSuggestions = suggestedTags.filter(t =>
    t.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="pf-tag-selector animate-fade-in">
      {/* Selected Items summary chips */}
      {selectedTags.length > 0 && (
        <div className="pf-tag-selector__selected-block">
          <span className="pf-tag-selector__label">Selected ({selectedTags.length}):</span>
          <div className="pf-tag-selector__chips">
            {selectedTags.map(tag => (
              <span key={tag} className="pf-tag-chip pf-tag-chip--active">
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="pf-tag-chip__remove"
                  aria-label={`Remove ${tag}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search Filter for suggestions */}
      {suggestedTags.length > 8 && (
        <div className="pf-tag-selector__search">
          <Search size={16} className="pf-tag-selector__search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pf-tag-selector__search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="pf-tag-selector__search-clear"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Suggested Tag Grid */}
      <div className="pf-tag-selector__grid">
        {filteredSuggestions.map(tag => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => handleToggleTag(tag)}
              className={`pf-tag-chip pf-tag-chip--selectable ${isSelected ? 'is-selected' : ''}`}
              aria-pressed={isSelected}
            >
              {isSelected ? <Check size={14} className="pf-tag-chip__icon" /> : <Plus size={14} className="pf-tag-chip__icon" />}
              <span>{tag}</span>
            </button>
          );
        })}
        {filteredSuggestions.length === 0 && (
          <p className="pf-tag-selector__empty">No matching suggestions. You can add it below as a custom item.</p>
        )}
      </div>

      {/* Custom item entry form */}
      {allowCustom && (
        <form onSubmit={handleAddCustom} className="pf-tag-selector__custom-form">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={placeholder}
            className="pf-tag-selector__custom-input"
            maxLength={40}
          />
          <button
            type="submit"
            disabled={!customInput.trim() || selectedTags.length >= maxTags}
            className="pf-tag-selector__custom-btn"
          >
            <Plus size={16} />
            <span>Add</span>
          </button>
        </form>
      )}
    </div>
  );
}
