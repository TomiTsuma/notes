import React, { useState } from 'react';
import './BranchedMenu.css';

export interface BranchedMenuChild {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  color?: string;
  onClick?: () => void;
}

export interface BranchedMenuItem {
  id?: string;
  label: string;
  value?: string;
  icon?: React.ReactNode;
  children?: BranchedMenuChild[];
  action?: {
    icon: React.ReactNode;
    title: string;
    onClick: (e: React.MouseEvent) => void;
  };
}

export interface BranchedMenuProps {
  items: BranchedMenuItem[];
  defaultOpen?: number[];
  defaultActive?: string;
  activeValue?: string;
  onSelect?: (value: string, item: BranchedMenuChild | BranchedMenuItem) => void;
  onToggle?: (index: number, open: boolean) => void;
  accentColor?: string;
  lineColor?: string;
  indent?: number;
  trunk?: number;
  radius?: number;
  rowHeight?: number;
  lineWidth?: number;
}

const BranchedMenu: React.FC<BranchedMenuProps> = ({
  items,
  defaultOpen = [0, 1],
  activeValue,
  defaultActive,
  onSelect,
  onToggle,
  accentColor = 'var(--accent-color)',
  lineColor = 'var(--border-color)',
  indent = 26,
  trunk = 12,
  radius = 6,
  rowHeight = 34,
  lineWidth = 1.5,
}) => {
  const [openIndexes, setOpenIndexes] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    defaultOpen.forEach(idx => { initial[idx] = true; });
    return initial;
  });

  const [active, setActive] = useState<string>(activeValue || defaultActive || '');

  const currentActive = activeValue !== undefined ? activeValue : active;

  const handleToggle = (index: number) => {
    setOpenIndexes(prev => {
      const nextOpen = !prev[index];
      if (onToggle) onToggle(index, nextOpen);
      return { ...prev, [index]: nextOpen };
    });
  };

  const handleChildSelect = (child: BranchedMenuChild) => {
    setActive(child.value);
    if (child.onClick) child.onClick();
    if (onSelect) onSelect(child.value, child);
  };

  const handleParentSelect = (item: BranchedMenuItem, index: number) => {
    if (item.children && item.children.length > 0) {
      handleToggle(index);
    } else if (item.value) {
      setActive(item.value);
      if (onSelect) onSelect(item.value, item);
    }
  };

  return (
    <div
      className="branched-menu-container"
      style={{
        ['--bm-accent' as string]: accentColor,
        ['--bm-line' as string]: lineColor,
      }}
    >
      {items.map((item, groupIndex) => {
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isOpen = Boolean(openIndexes[groupIndex]);
        const childrenCount = item.children?.length || 0;
        const totalHeight = childrenCount * rowHeight;

        return (
          <div
            key={item.id || item.label || groupIndex}
            className={`branched-menu-group ${isOpen ? 'is-open' : ''}`}
          >
            {/* Group Header / Parent Item */}
            <div
              className={`branched-menu-parent ${currentActive === item.value ? 'is-active' : ''}`}
              onClick={() => handleParentSelect(item, groupIndex)}
            >
              <div className="branched-menu-parent-left">
                {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
                <span>{item.label}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {item.action && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      item.action?.onClick(e);
                    }}
                    title={item.action.title}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--accent-color)',
                      padding: 2,
                    }}
                  >
                    {item.action.icon}
                  </button>
                )}
                {hasChildren && (
                  <button
                    type="button"
                    aria-label="Toggle group"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(groupIndex);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 2,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <svg
                      className="branched-menu-chevron"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Branch Connector Lines & Children */}
            {hasChildren && (
              <div
                className="branched-menu-children-wrapper"
                style={{
                  maxHeight: isOpen ? `${totalHeight + 10}px` : '0px',
                  opacity: isOpen ? 1 : 0,
                  pointerEvents: isOpen ? 'auto' : 'none',
                }}
              >
                {/* SVG Branch Tree Lines */}
                <svg
                  className="branched-menu-svg"
                  width={indent}
                  height={totalHeight}
                  style={{ width: `${indent}px` }}
                >
                  {/* Vertical Trunk Line */}
                  {childrenCount > 0 && (
                    <line
                      x1={trunk}
                      y1={0}
                      x2={trunk}
                      y2={(childrenCount - 1) * rowHeight + rowHeight / 2 - radius}
                      className="branched-menu-line"
                      strokeWidth={lineWidth}
                    />
                  )}

                  {/* Branch Curvature into each Child Item */}
                  {item.children?.map((_, childIndex) => {
                    const cy = childIndex * rowHeight + rowHeight / 2;
                    // Path: trunk -> corner radius -> horizontal line into child row
                    const pathD = `M ${trunk} ${Math.max(0, cy - radius)} Q ${trunk} ${cy} ${trunk + radius} ${cy} L ${indent - 4} ${cy}`;
                    return (
                      <path
                        key={childIndex}
                        d={pathD}
                        className="branched-menu-line"
                        strokeWidth={lineWidth}
                      />
                    );
                  })}
                </svg>

                {/* Children Items */}
                <div
                  className="branched-menu-children"
                  style={{ paddingLeft: `${indent}px` }}
                >
                  {item.children?.map((child) => {
                    const isChildActive = currentActive === child.value;

                    return (
                      <div
                        key={child.value}
                        className={`branched-menu-child ${isChildActive ? 'active' : ''}`}
                        style={{ height: `${rowHeight}px` }}
                        onClick={() => handleChildSelect(child)}
                      >
                        <div className="branched-menu-child-left">
                          {child.color && (
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: child.color,
                                flexShrink: 0,
                              }}
                            />
                          )}
                          {child.icon && (
                            <span className="branched-menu-child-icon">
                              {child.icon}
                            </span>
                          )}
                          <span className="branched-menu-child-label">
                            {child.label}
                          </span>
                        </div>

                        {child.badge !== undefined && (
                          <span className="branched-menu-child-badge">
                            {child.badge}
                          </span>
                        )}

                        {isChildActive && !child.badge && (
                          <div className="branched-menu-active-dot" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BranchedMenu;
