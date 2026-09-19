import React, { useState } from 'react';
import './FolderFloat.css';

export interface FolderFloatItem {
  id: string;
  title: string;
  type?: string;
  subtitle?: string;
  badge?: string;
  dataUrl?: string;
  onClick?: () => void;
}

export interface FolderFloatProps {
  id: string;
  label: string;
  sublabel?: string;
  color?: string;
  items: FolderFloatItem[];
  maxDisplayItems?: number;
  onOpenFolder?: () => void;
  onSelectItem?: (item: FolderFloatItem) => void;
  trigger?: 'hover' | 'click';
}

const FolderFloat: React.FC<FolderFloatProps> = ({
  id: _id,
  label,
  sublabel,
  color = '#007aff',
  items,
  maxDisplayItems = 5,
  onOpenFolder,
  onSelectItem,
  trigger = 'hover'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const displayItems = items.slice(0, maxDisplayItems);

  // Compute lighter and darker shades from the base color
  const baseColor = color;
  // CSS style variables
  const containerStyle = {
    '--folder-base-color': baseColor,
    '--folder-front-color': baseColor,
  } as React.CSSProperties;

  const handleContainerClick = () => {
    if (trigger === 'click') {
      setIsOpen(prev => !prev);
    } else if (onOpenFolder) {
      onOpenFolder();
    }
  };

  const handlePaperClick = (e: React.MouseEvent, item: FolderFloatItem) => {
    e.stopPropagation();
    if (item.onClick) {
      item.onClick();
    } else if (onSelectItem) {
      onSelectItem(item);
    }
  };

  return (
    <div
      className={`folder-float-wrapper ${isOpen ? 'is-open' : ''}`}
      style={containerStyle}
      onClick={handleContainerClick}
      onMouseEnter={() => trigger === 'hover' && setIsOpen(true)}
      onMouseLeave={() => trigger === 'hover' && setIsOpen(false)}
      tabIndex={0}
      role="button"
      aria-label={`Folder ${label}, contains ${items.length} items`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onOpenFolder) onOpenFolder();
        }
      }}
    >
      <div className="folder-float-card">
        {/* Back folder tab and shell */}
        <div className="folder-back-tab" />
        <div className="folder-back-body" />

        {/* Papers stage: floating cards */}
        <div className="folder-papers-stage">
          {displayItems.length > 0 ? (
            displayItems.map((item, idx) => {
              const fileType = (item.type || item.title.split('.').pop() || 'doc').toLowerCase();
              return (
                <div
                  key={item.id || idx}
                  className={`folder-paper-item paper-${idx}`}
                  onClick={(e) => handlePaperClick(e, item)}
                  title={`Open ${item.title}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      handlePaperClick(e as any, item);
                    }
                  }}
                >
                  <div className="folder-paper-title">{item.title}</div>
                  <div className="folder-paper-footer">
                    <span>{item.subtitle || `Item ${idx + 1}`}</span>
                    <span className={`folder-paper-type-badge ${fileType}`}>
                      {fileType}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="folder-paper-item paper-0" style={{ pointerEvents: 'none' }}>
              <div className="folder-empty-hint">Empty folder</div>
            </div>
          )}
        </div>

        {/* Front Folder Flap */}
        <div className="folder-front-flap">
          <div className="folder-front-header">
            <div className="folder-front-label">{label}</div>
            <span className="folder-count-chip">{items.length}</span>
          </div>

          <div className="folder-front-footer">
            <div className="folder-front-sublabel">
              {sublabel || `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
            </div>
            {onOpenFolder && (
              <button
                className="folder-open-action"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFolder();
                }}
                title={`Explore ${label}`}
              >
                <span>View</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FolderFloat;
