import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#b08af0", marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontFamily: "'EB Garamond',serif", fontSize: 15, color: "#888", marginBottom: 24, fontStyle: "italic" }}>
              {this.state.error.message || "An unexpected error occurred."}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              style={{ background: "transparent", border: "1px solid #b08af0", borderRadius: 4, color: "#b08af0", fontFamily: "monospace", fontSize: 13, padding: "8px 20px", cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
