const express = require('express');
const router = express.Router();
const db = require('../db');

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
  const { ruc, razon_social, nombre_comercial, direccion_matriz, obligado_contabilidad, contribuyente_especial, regimen } = req.body;

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
             obligado_contabilidad = $5, contribuyente_especial = $6, regimen = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id_empresa = $8
         RETURNING *`,
        [ruc, razon_social, nombre_comercial, direccion_matriz, obligado_contabilidad, contribuyente_especial, regimen, companyId]
      );
    } else {
      // Insertar nuevo registro
      result = await db.query(
        `INSERT INTO empresas (ruc, razon_social, nombre_comercial, direccion_matriz, obligado_contabilidad, contribuyente_especial, regimen)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [ruc, razon_social, nombre_comercial, direccion_matriz, obligado_contabilidad, contribuyente_especial, regimen]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al guardar datos de la empresa:', error);
    res.status(500).json({ error: 'Error al procesar la configuración de la empresa.' });
  }
});

module.exports = router;
