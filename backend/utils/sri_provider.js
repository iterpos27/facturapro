/** Normaliza el RUC opcional del proveedor y rechaza formatos que invalidarían el XML. */
function normalizeProviderRuc(value) {
  const ruc = String(value ?? '').trim();
  if (ruc && !/^\d{13}$/.test(ruc)) {
    throw new Error('El RUC del proveedor de software debe tener exactamente 13 dígitos.');
  }
  return ruc || null;
}

/** Genera el campo adicional compartido por factura, nota de crédito y retención. */
function buildProviderXml(company) {
  const ruc = normalizeProviderRuc(company.ruc_proveedor_software);
  // Un valor ausente conserva la compatibilidad con empresas todavía no configuradas.
  return ruc ? `<campoAdicional nombre="RucProveedorSoftware">${ruc}</campoAdicional>` : '';
}

module.exports = { normalizeProviderRuc, buildProviderXml };
