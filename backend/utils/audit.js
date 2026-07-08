const writeAudit = async (client, { entity, entityId, action, userId, detail = {} }) => {
  try {
    await client.query(
      `INSERT INTO auditoria_eventos (entidad, entidad_id, accion, id_usuario, detalle)
       VALUES ($1, $2, $3, $4, $5)`,
      [entity, entityId ? String(entityId) : null, action, userId || null, JSON.stringify(detail)]
    );
  } catch (error) {
    if (error.code === '42P01') {
      return;
    }
    throw error;
  }
};

module.exports = { writeAudit };
