function evaluateSriReadiness(companies) {
  const problems = [];
  if (companies.length !== 1) {
    problems.push(`Se requiere exactamente una empresa configurada; hay ${companies.length}.`);
  }
  const company = companies[0];
  if (company) {
    if (company.ambiente_sri !== 'PRUEBAS') {
      problems.push('El ambiente SRI debe ser PRUEBAS para esta validación.');
    }
    if (!String(company.ruc || '').trim()) {
      problems.push('Falta el RUC de la empresa.');
    }
    if (!String(company.certificado_path || '').trim() || !String(company.certificado_clave || '').trim()) {
      problems.push('Falta la ruta o la clave del certificado de firma.');
    }
  }
  return { ok: problems.length === 0, problems };
}

function requireSingleCompany(companies) {
  if (companies.length !== 1) {
    throw new Error(`Se requiere exactamente una empresa configurada para emitir; hay ${companies.length}.`);
  }
  return companies[0];
}

module.exports = { evaluateSriReadiness, requireSingleCompany };
