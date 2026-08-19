import './App.css'
import Button from './components/Button'
import Card from './components/Card'
import Input from './components/Input'

// Temporary preview of the base components (G411-17). Replace with real
// routes/pages once G411-12 frontend work starts — this just proves the
// design foundation renders and gives Gavi something to look at.
function App() {
  return (
    <div className="design-preview">
      <h1>Gavi411</h1>
      <Card>
        <h2>New request</h2>
        <Input label="What do you need?" placeholder="Find me a flight home tonight" />
        <div className="design-preview-actions">
          <Button variant="primary">Send request</Button>
        </div>
      </Card>
    </div>
  )
}

export default App
