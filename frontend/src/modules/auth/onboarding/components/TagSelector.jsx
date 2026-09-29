import React, { useState } from 'react';
import { Plus, X, Check, Search } from 'lucide-react';
import './TagSelector.css';

const nameOf = item => (typeof item === 'string' ? item : item?.name);
const levelOf = (item, fallback) => (typeof item === 'string' ? fallback : item?.proficiency);

/**
 * Chip-based selection of interests/curiosities. Items are structured
 * objects ({ name, proficiency, reason }); proficiency is defaulted when a
 * chip is selected so validation has a baseline before the detail editor runs.
 */
export function TagSelector({
  suggestedTags = [],
  selectedTags = [],
  onChange,
  placeholder = 'Add custom tag...',
  searchPlaceholder = 'Search suggestions...',
  allowCustom = true,
  maxTags = 15,
  defaultLevel = 'beginner'
}) {
  const [customInput, setCustomInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleTag = (tag) => {
    if (selectedTags.some(item => nameOf(item) === tag)) {
      onChange(selectedTags.filter(item => nameOf(item) !== tag));
    } else {
      if (selectedTags.length >= maxTags) return;
      onChange([...selectedTags, { name: tag, proficiency: defaultLevel, reason: '' }]);
    }
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selectedTags.some(item => nameOf(item) === trimmed) && selectedTags.length < maxTags) {
      onChange([...selectedTags, { name: trimmed, proficiency: defaultLevel, reason: '' }]);
    }
    setCustomInput('');
  };

  const handleRemoveTag = (tag) => {
    onChange(selectedTags.filter(item => nameOf(item) !== tag));
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
            {selectedTags.map(item => {
              const name = nameOf(item);
              return (
                <span key={name} className="pf-tag-chip pf-tag-chip--active">
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(name)}
                    className="pf-tag-chip__remove"
                    aria-label={`Remove ${name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
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
          const isSelected = selectedTags.some(item => nameOf(item) === tag);
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
