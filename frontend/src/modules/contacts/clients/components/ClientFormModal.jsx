import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../../../lib/api';
import { showToast } from '../../../../lib/toast';

const CONSUMIDOR_FINAL_ID = '9999999999999';

function validateCedulaEcuador(value) {
  if (!/^\d{10}$/.test(value)) return false;
  const province = parseInt(value.slice(0, 2), 10);
  const thirdDigit = parseInt(value[2], 10);

  if (province < 1 || province > 24 || thirdDigit > 5) return false;

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const total = coefficients.reduce((sum, coefficient, index) => {
    let result = parseInt(value[index], 10) * coefficient;
    if (result >= 10) result -= 9;
    return sum + result;
  }, 0);

  const verifier = (10 - (total % 10)) % 10;
  return verifier === parseInt(value[9], 10);
}

function validateRucEcuador(value) {
  if (!/^\d{13}$/.test(value)) return false;
  if (value === CONSUMIDOR_FINAL_ID) return true;

  const province = parseInt(value.slice(0, 2), 10);
  const thirdDigit = parseInt(value[2], 10);

  if (province < 1 || province > 24) return false;

  if (thirdDigit < 6) {
    return validateCedulaEcuador(value.slice(0, 10)) && value.slice(10) !== '000';
  }

  if (thirdDigit === 6) {
    const coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
    const total = coefficients.reduce((sum, coefficient, index) => sum + parseInt(value[index], 10) * coefficient, 0);
    const verifier = 11 - (total % 11);
    const expected = verifier === 11 ? 0 : verifier;
    return expected === parseInt(value[8], 10) && value.slice(9) !== '0000';
  }

  if (thirdDigit === 9) {
    const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const total = coefficients.reduce((sum, coefficient, index) => sum + parseInt(value[index], 10) * coefficient, 0);
    const verifier = 11 - (total % 11);
    const expected = verifier === 11 ? 0 : verifier;
    return expected === parseInt(value[9], 10) && value.slice(10) !== '000';
  }

  return false;
}

function getIdentificationLabel(value) {
  if (!value) return 'Identificacion';
  if (value === CONSUMIDOR_FINAL_ID) return 'Consumidor final';
  if (value.length === 10) return 'Cedula';
  if (value.length === 13) return 'RUC';
  return 'Identificacion';
}

export default function ClientFormModal({
  isOpen,
  onClose,
  editingClient,
  onSaveSuccess,
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [identificationNumber, setIdentificationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [observation, setObservation] = useState('');
  const [personType, setPersonType] = useState('NATURAL');

  // Inicializar o resetear campos
  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        setName(editingClient.name || '');
        setIdentificationNumber(editingClient.identification_number || '');
        setEmail(editingClient.email || '');
        setPhone(editingClient.phone || '');
        setAddress(editingClient.address || '');
        setObservation(editingClient.observation || '');
        setPersonType(editingClient.person_type || 'NATURAL');
      } else {
        setName('');
        setIdentificationNumber('');
        setEmail('');
        setPhone('');
        setAddress('');
        setObservation('');
        setPersonType('NATURAL');
      }
    }
  }, [editingClient, isOpen]);

  // Manejar escape key para cerrar modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const validateForm = () => {
    if (!name.trim()) return 'La razon social o nombre es obligatoria.';
    if (!email.trim()) return 'El correo electronico es obligatorio.';
    if (!identificationNumber.trim()) return 'El numero de identificacion es obligatorio.';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'El correo electronico no tiene un formato valido.';

    if (identificationNumber === CONSUMIDOR_FINAL_ID) return null;
    if (identificationNumber.length === 10 && !validateCedulaEcuador(identificationNumber)) {
      return 'La cedula ecuatoriana no es valida.';
    }
    if (identificationNumber.length === 13 && !validateRucEcuador(identificationNumber)) {
      return 'El RUC ecuatoriano no es valido.';
    }
    if (![10, 13].includes(identificationNumber.length)) {
      return 'La identificacion debe ser una cedula de 10 digitos o un RUC de 13 digitos.';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const clientData = {
      name,
      identification_number: identificationNumber,
      email,
      phone,
      address,
      observation,
      person_type: personType,
    };

    const url = editingClient
      ? apiUrl(`/api/clients/${editingClient.id}`)
      : apiUrl('/api/clients');
    const method = editingClient ? 'PUT' : 'POST';

    try {
      setSaving(true);
      const response = await apiFetch(url.replace(/^https?:\/\/[^/]+/, ''), {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ocurrio un error inesperado.');
      }

      showToast(
        editingClient
          ? 'Cliente actualizado correctamente.'
          : 'Cliente registrado exitosamente.',
        'success'
      );
      onSaveSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal-container modal-container-clean compact-modal"
        style={{ maxWidth: '780px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          onClick={() => !saving && onClose()}
          aria-label="Cerrar formulario"
          disabled={saving}
        >
          X
        </button>
        <h2>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
        <div style={{ height: '1.5rem' }}></div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label className="form-label">
                {getIdentificationLabel(identificationNumber)} *
              </label>
              <input
                type="text"
                className="form-control"
                value={identificationNumber}
                onChange={(e) =>
                  setIdentificationNumber(e.target.value.replace(/\D/g, '').slice(0, 13))
                }
                placeholder="Identificación"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 8' }}>
              <label className="form-label">Razon social *</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ingrese razon social o nombres completos"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 8' }}>
              <label className="form-label">Correo electronico *</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ingrese correo electrónico"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label className="form-label">Telefono</label>
              <input
                type="text"
                className="form-control"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))
                }
                placeholder="Ingrese teléfono"
                disabled={saving}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 8' }}>
              <label className="form-label">Direccion</label>
              <input
                type="text"
                className="form-control"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ingrese la dirección física completa"
                disabled={saving}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label className="form-label">Tipo de Persona</label>
              <select
                className="form-control"
                value={personType}
                onChange={(e) => setPersonType(e.target.value)}
                disabled={saving}
              >
                <option value="NATURAL">NATURAL</option>
                <option value="JURIDICA">JURIDICA</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 12' }}>
              <label className="form-label">Observacion</label>
              <input
                type="text"
                className="form-control"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ingrese alguna observación o detalle adicional"
                disabled={saving}
              />
            </div>
          </div>

          <div className="form-actions-buttons">
            <button
              type="button"
              className="btn btn-danger"
              style={{ backgroundColor: '#f43f5e', color: '#ffffff' }}
              onClick={onClose}
              disabled={saving}
            >
              Cerrar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
