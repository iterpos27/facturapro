import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    console.error('Error capturado por ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="module-shell">
          <div className="app-error-boundary">
            <div>
              <p className="app-error-kicker">Error del modulo</p>
              <h1>No se pudo mostrar esta pantalla</h1>
              <p>
                Ocurrio un error inesperado. Puedes intentar recargar el modulo o volver al panel principal.
              </p>
              <pre>{this.state.error.message}</pre>
            </div>
            <div className="app-error-actions">
              <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
                Reintentar
              </button>
              {this.props.onBack && (
                <button type="button" className="btn btn-secondary" onClick={this.props.onBack}>
                  Ir al Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
