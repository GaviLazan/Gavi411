import Card from "../components/Card";

// Installation help for iOS
function InstallHelp() {
  return (
    <Card style={{ width: "100%", textAlign: "start" }}>
      <h2>Installing on iPhone</h2>
      <p>
        iPhone doesn't offer to install this automatically like Android does
        — a couple of taps and you're set.
      </p>
      <ol>
        <li>
          Open the site in <strong>Safari</strong> (not Chrome or Firefox on
          iOS — only Safari can install PWAs).
        </li>
        <li>
          Tap the <strong>Share</strong> icon (the square with an arrow
          pointing up).
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </li>
        <li>
          Tap <strong>Add</strong> in the top-right corner.
        </li>
      </ol>
      <p>
        The app icon now appears on your home screen and opens without
        Safari's address bar.
      </p>
      <p className="meta">
        One thing to know: notifications only work on iPhone once it's
        installed this way.
      </p>
    </Card>
  );
}

export default InstallHelp;
