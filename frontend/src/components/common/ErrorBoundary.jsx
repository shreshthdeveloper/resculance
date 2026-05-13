import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-white to-background-card flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-hover p-8 max-w-2xl w-full">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              <h1 className="text-3xl font-display font-bold mt-5 mb-2">Something Went Wrong</h1>
              <p className="text-secondary mb-6">
                We apologize for the inconvenience. An unexpected error has occurred.
              </p>

              <Button onClick={this.handleReset} className="mb-6">
                Return to Dashboard
              </Button>

              {/* Error Details (only in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="w-full text-left">
                  <summary className="cursor-pointer font-medium text-red-600 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 overflow-auto">
                    <p className="text-sm font-mono text-red-800 mb-2">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <pre className="text-xs text-red-700 overflow-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
