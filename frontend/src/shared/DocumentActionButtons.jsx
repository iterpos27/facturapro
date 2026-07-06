import React from 'react';

const toneClass = {
  info: 'btn-info text-white',
  primary: 'btn-outline-primary',
  warning: 'btn-warning',
  success: 'btn-success',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
};

const iconPaths = {
  detail: (
    <>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h10" />
    </>
  ),
  ride: (
    <>
      <path d="M7 3h10l4 4v14H7z" />
      <path d="M17 3v5h4" />
      <path d="M4 8h3" />
      <path d="M4 13h3" />
      <path d="M10 13h7" />
      <path d="M10 17h7" />
    </>
  ),
  pdf: (
    <>
      <path d="M7 3h10l4 4v14H7z" />
      <path d="M17 3v5h4" />
      <path d="M4 14h8" />
      <path d="M4 18h5" />
    </>
  ),
  xml: (
    <>
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m14 5-4 14" />
    </>
  ),
  sri: (
    <>
      <path d="M13 2 4 14h7l-1 8 10-13h-7z" />
    </>
  ),
  email: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  cancel: (
    <>
      <path d="M6 7h12" />
      <path d="M10 7V5h4v2" />
      <path d="M8 7l1 13h6l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l11-11-4-4L4 16z" />
      <path d="m13 7 4 4" />
    </>
  ),
};

function getIconKey(label = '') {
  const normalized = label.toLowerCase();
  if (normalized.includes('detalle')) return 'detail';
  if (normalized.includes('ride')) return 'ride';
  if (normalized.includes('pdf')) return 'pdf';
  if (normalized.includes('xml')) return 'xml';
  if (normalized.includes('sri') || normalized.includes('procesar')) return 'sri';
  if (normalized.includes('email') || normalized.includes('correo')) return 'email';
  if (normalized.includes('anular') || normalized.includes('eliminar')) return 'cancel';
  if (normalized.includes('editar')) return 'edit';
  return 'detail';
}

export default function DocumentActionButtons({ actions }) {
  return (
    <div className="document-action-toolbar">
      {actions.filter(Boolean).map((action) => {
        const iconKey = getIconKey(action.label);
        return (
          <button
            key={action.label}
            type="button"
            className={`btn document-icon-btn ${toneClass[action.tone] || toneClass.secondary}`}
            onClick={action.onClick}
            title={action.label}
            aria-label={action.label}
            disabled={action.disabled}
          >
            <svg className="document-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {iconPaths[iconKey]}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
