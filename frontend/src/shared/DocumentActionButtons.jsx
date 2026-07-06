import React from 'react';
import CIcon from '@coreui/icons-react';

const toneClass = {
  info: 'btn-info text-white',
  primary: 'btn-outline-primary',
  warning: 'btn-warning',
  success: 'btn-success',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
};

export default function DocumentActionButtons({ actions }) {
  return (
    <div className="document-action-toolbar">
      {actions.filter(Boolean).map((action) => (
        <button
          key={action.label}
          type="button"
          className={`btn document-icon-btn ${toneClass[action.tone] || toneClass.secondary}`}
          onClick={action.onClick}
          title={action.label}
          aria-label={action.label}
          disabled={action.disabled}
        >
          <CIcon icon={action.icon} size="sm" />
        </button>
      ))}
    </div>
  );
}
