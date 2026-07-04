const DOCUMENT_TYPES = {
  FACTURA: { sriCode: '01' },
  NOTA_CREDITO: { sriCode: '04' },
  RETENCION: { sriCode: '07' },
};

function formatSequential(value) {
  return String(Number(value) || 0).padStart(9, '0');
}

function formatDocumentNumber(branch, sequential) {
  return `${branch.codigo_establecimiento}-${branch.punto_emision}-${formatSequential(sequential)}`;
}

async function getDefaultBranch(client) {
  const branchRes = await client.query(`
    SELECT s.id_sucursal, s.codigo_establecimiento, s.punto_emision
    FROM sucursales s
    WHERE s.activo = true
    ORDER BY s.codigo_establecimiento ASC, s.punto_emision ASC, s.id_sucursal ASC
    LIMIT 1
  `);

  if (branchRes.rows.length === 0) {
    throw new Error('No hay sucursales activas configuradas.');
  }

  return branchRes.rows[0];
}

async function nextDocumentSequential(client, idSucursal, tipoComprobante) {
  if (!DOCUMENT_TYPES[tipoComprobante]) {
    throw new Error(`Tipo de comprobante no soportado: ${tipoComprobante}`);
  }

  const seqRes = await client.query(`
    SELECT id_secuencial, secuencial_actual, activo
    FROM secuenciales
    WHERE id_sucursal = $1 AND tipo_comprobante = $2
    FOR UPDATE
  `, [idSucursal, tipoComprobante]);

  if (seqRes.rows.length > 0) {
    const seq = seqRes.rows[0];
    if (!seq.activo) {
      throw new Error(`El secuencial ${tipoComprobante} esta inactivo para el punto de emision seleccionado.`);
    }

    await client.query(`
      UPDATE secuenciales
      SET secuencial_actual = secuencial_actual + 1
      WHERE id_secuencial = $1
    `, [seq.id_secuencial]);

    return Number(seq.secuencial_actual);
  }

  await client.query(`
    INSERT INTO secuenciales (id_sucursal, tipo_comprobante, secuencial_actual, activo)
    VALUES ($1, $2, 2, true)
  `, [idSucursal, tipoComprobante]);

  return 1;
}

async function ensureBranchSequentials(client, idSucursal) {
  for (const tipo of Object.keys(DOCUMENT_TYPES)) {
    await client.query(`
      INSERT INTO secuenciales (id_sucursal, tipo_comprobante, secuencial_actual, activo)
      VALUES ($1, $2, 1, true)
      ON CONFLICT (id_sucursal, tipo_comprobante) DO NOTHING
    `, [idSucursal, tipo]);
  }
}

module.exports = {
  DOCUMENT_TYPES,
  formatSequential,
  formatDocumentNumber,
  getDefaultBranch,
  nextDocumentSequential,
  ensureBranchSequentials,
};
