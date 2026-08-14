import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Unexpected error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0faf5] px-4">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#d8f3dc] text-center max-w-sm w-full">
            <div className="text-5xl mb-4">🌿</div>
            <h2 className="font-display font-bold text-xl text-[#1a4731] mb-2">Something went wrong.</h2>
            <p className="text-[#95d5b2] text-sm mb-6">
              An unexpected error occurred. You can try again — your data is safe.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full bg-[#2d6a4f] text-white rounded-xl py-3 font-semibold hover:bg-[#1a4731] transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
