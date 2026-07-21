const express = require('express');
const router = express.Router();
const { loadRide, renderRideHtml, generateRidePdf, normalizeType } = require('../services/ride_service');
const { authorizePermissions } = require('./auth');

const RIDE_PERMISSION_BY_TYPE = {
  invoice: 'INVOICES_CRUD',
  proforma: 'PROFORMAS_CRUD',
  'credit-note': 'CREDIT_NOTES_CRUD',
  withholding: 'WITHHOLDINGS_CRUD',
};

function authorizeRideType(req, res, next) {
  try {
    const type = normalizeType(req.params.type);
    const permission = RIDE_PERMISSION_BY_TYPE[type];
    if (!permission) return res.status(400).json({ error: 'Tipo de RIDE no soportado.' });
    return authorizePermissions(permission)(req, res, next);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Tipo de RIDE no soportado.' });
  }
}

function filenameFor(type, ride, extension) {
  const cleanNumber = String(ride.number || 'documento').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${type}_${cleanNumber}_RIDE.${extension}`;
}

router.get('/:type/:id.html', authorizeRideType, async (req, res) => {
  try {
    const type = normalizeType(req.params.type);
    const payload = await loadRide(type, req.params.id);
    const html = renderRideHtml(payload);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filenameFor(type, payload.ride, 'html')}"`);
    res.send(html);
  } catch (error) {
    console.error('Error al generar RIDE HTML:', error);
    res.status(400).json({ error: error.message || 'No se pudo generar el RIDE.' });
  }
});

router.get('/:type/:id.pdf', authorizeRideType, async (req, res) => {
  try {
    const type = normalizeType(req.params.type);
    const payload = await loadRide(type, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filenameFor(type, payload.ride, 'pdf')}"`);
    generateRidePdf(payload, res);
  } catch (error) {
    console.error('Error al generar RIDE PDF:', error);
    if (!res.headersSent) {
      res.status(400).json({ error: error.message || 'No se pudo generar el RIDE PDF.' });
    } else {
      res.end();
    }
  }
});

module.exports = router;
