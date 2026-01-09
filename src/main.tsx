
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Handle Google OAuth callback
  // If we're in a popup and have an access_token in the URL hash, send it to the parent window
  if (window.location.hash.includes("access_token")) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get("access_token");
    
    if (accessToken && window.opener) {
      // Send the token to the parent window
      window.opener.postMessage(
        { type: "GOOGLE_AUTH_SUCCESS", access_token: accessToken },
        window.location.origin
      );
      // Close this popup
      window.close();
    }
  } else {
    // Normal app render
    createRoot(document.getElementById("root")!).render(<App />);
  }
  