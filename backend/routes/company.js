const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizePermissions } = require('./auth');

const certificatesDir = path.resolve(__dirname, '..', 'certificates');
if (!fs.existsSync(certificatesDir)) {
  fs.mkdirSync(certificatesDir, { recursive: true });
}
const logosDir = path.resolve(__dirname, '..', 'uploads', 'company');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const certificateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, certificatesDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `firma-${Date.now()}${extension}`);
  },
});

const certificateUpload = multer({
  storage: certificateStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!['.p12', '.pfx'].includes(extension)) {
      return cb(new Error('Solo se permiten certificados .p12 o .pfx.'));
    }
    return cb(null, true);
  },
});

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logosDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${Date.now()}${extension}`);
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
      return cb(new Error('Solo se permiten logos .png, .jpg, .jpeg o .webp.'));
    }
    return cb(null, true);
  },
});

// Proteger todas las rutas del enrutador de empresa
router.use(authenticateToken);

// 1. Obtener datos de la empresa (GET /api/company)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM empresas LIMIT 1');
    if (result.rows.length === 0) {
      // Retornar un objeto vacío o iniciar con valores por defecto
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener datos de la empresa:', error);
    res.status(500).json({ error: 'Error al consultar los datos de la empresa.' });
  }
});

// 2. Guardar o actualizar datos de la empresa (POST /api/company)
router.post('/', async (req, res) => {
  const {
    ruc,
    razon_social,
    nombre_comercial,
    direccion_matriz,
    obligado_contabilidad,
    contribuyente_especial,
    regimen,
    logo_url,
    ambiente_sri,
    tipo_emision,
    certificado_path,
    certificado_alias,
    certificado_clave,
    sri_endpoint_recepcion,
    sri_endpoint_autorizacion,
  } = req.body;

  if (!ruc || !razon_social || !direccion_matriz) {
    return res.status(400).json({ error: 'El RUC, Razón Social y Dirección Matriz son obligatorios.' });
  }

  try {
    // Verificar si ya existe una empresa registrada
    const checkCompany = await db.query('SELECT id_empresa FROM empresas LIMIT 1');
    
    let result;
    if (checkCompany.rows.length > 0) {
      // Actualizar registro existente
      const companyId = checkCompany.rows[0].id_empresa;
      result = await db.query(
        `UPDATE empresas 
         SET ruc = $1, razon_social = $2, nombre_comercial = $3, direccion_matriz = $4,
             obligado_contabilidad = $5, contribuyente_especial = $6, regimen = $7,
             logo_url = $8, ambiente_sri = $9, tipo_emision = $10, certificado_path = $11,
             certificado_alias = $12, certificado_clave = $13,
             sri_endpoint_recepcion = $14, sri_endpoint_autorizacion = $15,
             updated_at = CURRENT_TIMESTAMP
         WHERE id_empresa = $16
         RETURNING *`,
        [
          ruc, razon_social, nombre_comercial, direccion_matriz,
          obligado_contabilidad, contribuyente_especial, regimen,
          logo_url || '', ambiente_sri || 'PRUEBAS', tipo_emision || 'NORMAL',
          certificado_path || '', certificado_alias || '', certificado_clave || '',
          sri_endpoint_recepcion || '', sri_endpoint_autorizacion || '', companyId,
        ]
      );
    } else {
      // Insertar nuevo registro
      result = await db.query(
        `INSERT INTO empresas (
          ruc, razon_social, nombre_comercial, direccion_matriz, obligado_contabilidad,
          contribuyente_especial, regimen, logo_url, ambiente_sri, tipo_emision,
          certificado_path, certificado_alias, certificado_clave,
          sri_endpoint_recepcion, sri_endpoint_autorizacion
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          ruc, razon_social, nombre_comercial, direccion_matriz,
          obligado_contabilidad, contribuyente_especial, regimen,
          logo_url || '', ambiente_sri || 'PRUEBAS', tipo_emision || 'NORMAL',
          certificado_path || '', certificado_alias || '', certificado_clave || '',
          sri_endpoint_recepcion || '', sri_endpoint_autorizacion || '',
        ]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al guardar datos de la empresa:', error);
    res.status(500).json({ error: 'Error al procesar la configuración de la empresa.' });
  }
});

router.post('/certificate', certificateUpload.single('certificate'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Seleccione un certificado .p12 o .pfx.' });
  }

  try {
    const relativePath = path.relative(path.resolve(__dirname, '..'), req.file.path).replace(/\\/g, '/');
    const checkCompany = await db.query('SELECT id_empresa FROM empresas LIMIT 1');
    if (checkCompany.rows.length > 0) {
      await db.query(
        'UPDATE empresas SET certificado_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id_empresa = $2',
        [relativePath, checkCompany.rows[0].id_empresa]
      );
    }

    res.status(201).json({
      certificado_path: relativePath,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error('Error al cargar certificado:', error);
    res.status(500).json({ error: 'No se pudo guardar el certificado.' });
  }
});

router.post('/logo', logoUpload.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Seleccione una imagen para el logo.' });
  }

  try {
    const relativePath = `/${path.relative(path.resolve(__dirname, '..'), req.file.path).replace(/\\/g, '/')}`;
    const checkCompany = await db.query('SELECT id_empresa FROM empresas LIMIT 1');
    if (checkCompany.rows.length > 0) {
      await db.query(
        'UPDATE empresas SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id_empresa = $2',
        [relativePath, checkCompany.rows[0].id_empresa]
      );
    }

    res.status(201).json({
      logo_url: relativePath,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error('Error al cargar logo:', error);
    res.status(500).json({ error: 'No se pudo guardar el logo.' });
  }
});

/**
 * POST /api/company/switch-environment
 * Cambia el ambiente SRI de la empresa (PRUEBAS <-> PRODUCCION).
 * Requiere el campo "confirmacion" con el valor exacto del nuevo ambiente
 * para prevenir cambios accidentales.
 *
 * Body: { nuevo_ambiente: 'PRODUCCION' | 'PRUEBAS', confirmacion: 'PRODUCCION' | 'PRUEBAS' }
 */
router.post('/switch-environment', authenticateToken, authorizePermissions('PRODUCTION_SWITCH'), async (req, res) => {
  const { nuevo_ambiente, confirmacion } = req.body || {};
  const target = String(nuevo_ambiente || '').toUpperCase().trim();

  if (!['PRUEBAS', 'PRODUCCION'].includes(target)) {
    return res.status(400).json({ error: 'nuevo_ambiente debe ser PRUEBAS o PRODUCCION.' });
  }

  if (String(confirmacion || '').toUpperCase().trim() !== target) {
    return res.status(400).json({
      error: `Para cambiar a ${target} debes confirmar escribiendo exactamente "${target}" en el campo de confirmacion.`,
    });
  }

  try {
    const checkCompany = await db.query('SELECT id_empresa, ambiente_sri FROM empresas LIMIT 1');
    if (checkCompany.rows.length === 0) {
      return res.status(400).json({ error: 'Configure primero los datos de la empresa.' });
    }

    const company = checkCompany.rows[0];
    if (company.ambiente_sri === target) {
      return res.json({ mensaje: `El ambiente ya es ${target}. No se realizaron cambios.`, ambiente_sri: target });
    }

    await db.query(
      'UPDATE empresas SET ambiente_sri = $1, updated_at = CURRENT_TIMESTAMP WHERE id_empresa = $2',
      [target, company.id_empresa]
    );

    return res.json({
      mensaje: `Ambiente SRI cambiado a ${target} correctamente.`,
      ambiente_sri: target,
      advertencia: target === 'PRODUCCION'
        ? 'ATENCION: Todos los comprobantes emitidos desde ahora se enviaran al SRI de PRODUCCION y tendran validez legal y fiscal.'
        : null,
    });
  } catch (error) {
    console.error('Error al cambiar ambiente SRI:', error);
    return res.status(500).json({ error: 'Error al cambiar el ambiente SRI.' });
  }
});

module.exports = router;
