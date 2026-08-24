import { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";

// Renders client/public/install-ios.md as a real page (G411-67 — the
// file existed with content but nothing linked to it). Plain <pre>, no
// markdown-render dependency — this is intentionally low-priority
// polish, not worth adding a library for.
function InstallHelp({ onBack }) {
  const [text, setText] = useState("");

  useEffect(() => {
    fetch("/install-ios.md")
      .then((res) => res.text())
      .then(setText)
      .catch(() => setText("Couldn't load this page."));
  }, []);

  return (
    <Card style={{ width: "100%", textAlign: "start" }}>
      <Button variant="secondary" onClick={onBack}>
        ← Back
      </Button>
      <pre style={{ whiteSpace: "pre-wrap", font: "inherit" }}>{text}</pre>
    </Card>
  );
}

export default InstallHelp;
