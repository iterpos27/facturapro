function publicCompany(company) {
  const { certificado_clave, ...safe } = company;
  return { ...safe, certificado_configurado: Boolean(certificado_clave) };
}

function certificateSecretForUpdate(current, incoming) {
  return typeof incoming === 'string' && incoming.trim() ? incoming : (current || '');
}

function environmentForCompanySave(current) {
  return current === 'PRODUCCION' ? 'PRODUCCION' : 'PRUEBAS';
}

module.exports = { publicCompany, certificateSecretForUpdate, environmentForCompanySave };
